export const MINIMUM_NODE_MAJOR = 22;

export function parseCliArgs(argv) {
  const options = {
    check: false,
    help: false,
  };

  for (const argument of argv) {
    if (argument === "--check") {
      options.check = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

export function parsePort(rawValue, name, fallback) {
  const value = rawValue === undefined || rawValue === "" ? fallback : Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return value;
}

export function isSupportedNodeVersion(version, minimumMajor = MINIMUM_NODE_MAJOR) {
  const match = /^v?(\d+)/.exec(version);
  return match ? Number(match[1]) >= minimumMajor : false;
}

export function choosePackageManager({ corepack, pnpm }) {
  if (corepack.ok) {
    return {
      command: "corepack",
      prefix: ["pnpm"],
      version: corepack.version,
      source: "Corepack",
    };
  }
  if (pnpm.ok) {
    return {
      command: "pnpm",
      prefix: [],
      version: pnpm.version,
      source: "PATH",
    };
  }
  throw new Error(
    "pnpm is unavailable. Enable Corepack with `corepack enable`, then rerun the launcher.",
  );
}

export function createLauncherConfig(environment = process.env) {
  const apiHost = environment.API_HOST?.trim() || "127.0.0.1";
  const webHost = environment.WEB_HOST?.trim() || "127.0.0.1";
  const apiPort = parsePort(environment.API_PORT, "API_PORT", 4000);
  const webPort = parsePort(environment.WEB_PORT, "WEB_PORT", 5174);

  if (apiHost === webHost && apiPort === webPort) {
    throw new Error("API_PORT and WEB_PORT must be different when both services use the same host.");
  }

  return {
    apiHost,
    apiPort,
    webHost,
    webPort,
    mongoUri: environment.MONGO_URI?.trim() || "mongodb://127.0.0.1:27017/atellier_studio",
    apiUrl: `http://${apiHost}:${apiPort}`,
    webUrl: `http://${webHost}:${webPort}`,
  };
}

export function createServiceSpecs(config, packageManager) {
  const pnpmArgs = (...args) => [...packageManager.prefix, ...args];
  const sharedEnvironment = {
    API_HOST: config.apiHost,
    API_PORT: String(config.apiPort),
    API_STORAGE: "mongo",
    MONGO_URI: config.mongoUri,
  };

  return [
    {
      label: "api",
      command: packageManager.command,
      args: pnpmArgs("--filter", "@atellier/api", "dev"),
      environment: sharedEnvironment,
    },
    {
      label: "worker",
      command: packageManager.command,
      args: pnpmArgs("--filter", "@atellier/api", "dev:worker"),
      environment: sharedEnvironment,
    },
    {
      label: "web",
      command: packageManager.command,
      args: pnpmArgs(
        "--filter",
        "@atellier/web",
        "exec",
        "vite",
        "--host",
        config.webHost,
        "--port",
        String(config.webPort),
        "--strictPort",
      ),
      environment: {
        VITE_API_URL: config.apiUrl,
      },
    },
  ];
}

export function formatCommand(command, args) {
  return [command, ...args]
    .map((part) => (/^[A-Za-z0-9_./:@=-]+$/.test(part) ? part : JSON.stringify(part)))
    .join(" ");
}

export function findAtellierWorkerProcesses(processList, repositoryRoot, currentPid = process.pid) {
  const normalizedRoot = repositoryRoot.replace(/\\/g, "/");
  return processList.split(/\r?\n/).flatMap((line) => {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line);
    if (!match?.[1] || !match[2]) return [];
    const pid = Number(match[1]);
    const command = match[2].replace(/\\/g, "/");
    if (pid === currentPid || !command.includes(normalizedRoot)) return [];
    if (!/(?:src\/worker\.ts|@atellier\/api\s+dev:worker)/.test(command)) return [];
    return [{ pid, command }];
  });
}
