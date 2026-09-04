#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MINIMUM_NODE_MAJOR,
  choosePackageManager,
  createLauncherConfig,
  createServiceSpecs,
  formatCommand,
  findAtellierWorkerProcesses,
  isSupportedNodeVersion,
  parseCliArgs,
} from "./dev-local-core.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const activeChildren = new Map();
let shuttingDown = false;
let reportUnexpectedExit;
const unexpectedExit = new Promise((resolveExit) => {
  reportUnexpectedExit = resolveExit;
});

function log(message) {
  console.info(`[atellier-local] ${message}`);
}

function fail(message) {
  throw new Error(`[atellier-local] ${message}`);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    env: process.env,
  });
}

function probe(command, args) {
  const result = run(command, args);
  return {
    ok: result.status === 0,
    version: result.status === 0 ? result.stdout.trim() : "",
  };
}

function commandExists(command) {
  return spawnSync(command, ["--version"], {
    cwd: repositoryRoot,
    stdio: "ignore",
  }).status === 0;
}

function resolvePackageManager() {
  const packageManager = choosePackageManager({
    corepack: probe("corepack", ["pnpm", "--version"]),
    pnpm: probe("pnpm", ["--version"]),
  });
  log(`Using pnpm ${packageManager.version} via ${packageManager.source}.`);
  return packageManager;
}

function assertNodeVersion() {
  if (!isSupportedNodeVersion(process.version)) {
    fail(
      `Node ${MINIMUM_NODE_MAJOR}+ is required; found ${process.version}. Run \`nvm use\` in the repository.`,
    );
  }
  log(`Node ${process.version} is ready.`);
}

function assertDependenciesInstalled() {
  if (!existsSync(resolve(repositoryRoot, "node_modules", ".pnpm"))) {
    fail(
      "Workspace dependencies are missing. Run `corepack pnpm install --frozen-lockfile`; the launcher will not install them silently.",
    );
  }
  log("Workspace dependencies are installed.");
}

function assertNoDuplicateWorkers() {
  if (process.platform === "win32") {
    log("Worker process preflight is unavailable on Windows; durable leases still protect claims.");
    return;
  }
  const result = run("ps", ["-Ao", "pid=,command="]);
  if (result.status !== 0) fail("Could not inspect local processes for duplicate Atellier workers.");
  const workers = findAtellierWorkerProcesses(result.stdout, repositoryRoot);
  if (workers.length > 0) {
    fail(
      `Found ${workers.length} existing Atellier worker process(es) for this repository (${workers.map((worker) => worker.pid).join(", ")}). Stop the prior worker or launcher before starting another; no process was killed.`,
    );
  }
  log("No duplicate Atellier worker process is running for this repository.");
}

function loadRepositoryEnvironment() {
  const environmentPath = resolve(repositoryRoot, ".env");
  if (!existsSync(environmentPath)) return;
  process.loadEnvFile(environmentPath);
  log("Loaded repository .env; explicit shell overrides retain priority.");
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function inspectPort(host, port) {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.unref();
    server.once("error", (error) => {
      resolvePort({ available: false, error });
    });
    server.listen({ host, port, exclusive: true }, () => {
      server.close(() => resolvePort({ available: true }));
    });
  });
}

async function assertPortsAvailable(config) {
  for (const [label, host, port] of [
    ["API", config.apiHost, config.apiPort],
    ["Web", config.webHost, config.webPort],
  ]) {
    const result = await inspectPort(host, port);
    if (!result.available) {
      fail(
        `${label} port ${host}:${port} is already in use. Stop that process or choose another ${label === "API" ? "API_PORT" : "WEB_PORT"}; no process was killed.`,
      );
    }
    log(`${label} port ${host}:${port} is available.`);
  }
}

function assertDockerCli() {
  if (!commandExists("docker")) {
    fail("Docker CLI is unavailable. Install Docker CLI, Docker Compose, and Colima first.");
  }
  const compose = run("docker", ["compose", "version"]);
  if (compose.status !== 0) {
    fail("Docker Compose is unavailable. Verify the Docker Compose CLI plugin installation.");
  }
  log("Docker CLI and Compose are available.");
}

function dockerIsRunning() {
  return run("docker", ["info"]).status === 0;
}

async function waitForMongo(timeoutMilliseconds = 30_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const ping = run("docker", [
      "exec",
      "atellier-mongo",
      "mongosh",
      "--quiet",
      "--eval",
      "db.runCommand({ ping: 1 })",
    ]);
    if (ping.status === 0) return;
    await delay(500);
  }
  fail("Mongo did not become healthy within 30 seconds. Inspect `docker compose ps` and container logs.");
}

async function ensureMongo({ start }) {
  assertDockerCli();

  if (!dockerIsRunning()) {
    if (!start) {
      fail("Docker is not running. Start Colima with `colima start`.");
    }
    if (!commandExists("colima")) {
      fail("Docker is not running and Colima is unavailable. Start a compatible Docker daemon.");
    }
    log("Docker is offline; starting Colima.");
    const colima = run("colima", ["start"], { inherit: true });
    if (colima.status !== 0 || !dockerIsRunning()) {
      fail("Colima did not start a reachable Docker daemon.");
    }
  }
  log("Docker daemon is ready.");

  if (start) {
    log("Ensuring the Mongo service is running.");
    const compose = run("docker", ["compose", "up", "-d", "mongo"], { inherit: true });
    if (compose.status !== 0) {
      fail("Docker Compose could not start the Mongo service.");
    }
  }

  await waitForMongo();
  log("Mongo responded to ping.");
}

function signalProcessGroup(child, signal) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform === "win32") {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function startService(specification) {
  log(`Starting ${specification.label}: ${formatCommand(specification.command, specification.args)}`);
  const child = spawn(specification.command, specification.args, {
    cwd: repositoryRoot,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      ...specification.environment,
    },
    stdio: "inherit",
  });
  activeChildren.set(specification.label, child);
  child.once("exit", (code, signal) => {
    activeChildren.delete(specification.label);
    if (!shuttingDown) {
      reportUnexpectedExit({
        label: specification.label,
        code,
        signal,
      });
    }
  });
  child.once("error", (error) => {
    if (!shuttingDown) {
      reportUnexpectedExit({
        label: specification.label,
        error,
      });
    }
  });
  return child;
}

async function waitForHttp(url, predicate, timeoutMilliseconds = 45_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) {
        const payload = await response.text();
        if (!predicate || predicate(payload, response)) return payload;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(350);
  }
  fail(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : "."}`);
}

async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (activeChildren.size === 0) return;
  log(`Stopping launcher-owned services (${reason}). Mongo will remain running.`);

  const children = [...activeChildren.values()];
  for (const child of children) signalProcessGroup(child, "SIGTERM");

  const deadline = Date.now() + 10_000;
  while (activeChildren.size > 0 && Date.now() < deadline) {
    await delay(100);
  }
  for (const child of activeChildren.values()) signalProcessGroup(child, "SIGKILL");
}

function printHelp() {
  console.info(`Atellier Studio local launcher

Usage:
  ./scripts/dev-local
  ./scripts/dev-local --check

Environment overrides:
  API_HOST   API bind host (default 127.0.0.1)
  API_PORT   API port (default 4000)
  WEB_HOST   Vite bind host (default 127.0.0.1)
  WEB_PORT   Vite port (default 5174)
  MONGO_URI  Mongo connection string

The launcher never installs dependencies, kills existing port owners, or stops Mongo on exit.`);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  loadRepositoryEnvironment();
  const config = createLauncherConfig(process.env);
  assertNodeVersion();
  const packageManager = resolvePackageManager();
  assertDependenciesInstalled();
  assertNoDuplicateWorkers();
  await assertPortsAvailable(config);
  await ensureMongo({ start: !options.check });

  if (options.check) {
    log("Preflight passed. No services were started.");
    return;
  }

  process.once("SIGINT", () => {
    void shutdown("SIGINT").then(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM").then(() => process.exit(0));
  });

  const serviceSpecs = createServiceSpecs(config, packageManager);
  for (const specification of serviceSpecs) startService(specification);

  const apiHealthPromise = waitForHttp(`${config.apiUrl}/health`, (body) => {
    try {
      const payload = JSON.parse(body);
      return payload.status === "ok" && payload.service === "atellier-api";
    } catch {
      return false;
    }
  });
  const webHealthPromise = waitForHttp(config.webUrl, (_body, response) => {
    return response.headers.get("content-type")?.includes("text/html") ?? false;
  });

  const readiness = Promise.all([apiHealthPromise, webHealthPromise]);
  const earlyExit = unexpectedExit.then((event) => {
    fail(
      `${event.label} exited before readiness${event.error ? `: ${event.error.message}` : ` (code=${event.code}, signal=${event.signal})`}.`,
    );
  });
  const [apiHealth] = await Promise.race([readiness, earlyExit]);
  const health = JSON.parse(apiHealth);

  log(`Ready: Web ${config.webUrl}`);
  log(`Ready: API ${config.apiUrl} (${health.storageMode}, executor=${health.executorMode})`);
  log("Ready: Worker is running. Press Ctrl+C to stop launcher-owned services.");

  const exit = await unexpectedExit;
  fail(
    `${exit.label} exited unexpectedly${exit.error ? `: ${exit.error.message}` : ` (code=${exit.code}, signal=${exit.signal})`}.`,
  );
}

main().catch(async (error) => {
  await shutdown("startup failure");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
