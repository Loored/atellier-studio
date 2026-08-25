import assert from "node:assert/strict";
import test from "node:test";
import {
  choosePackageManager,
  createLauncherConfig,
  createServiceSpecs,
  isSupportedNodeVersion,
  parseCliArgs,
  parsePort,
} from "./dev-local-core.mjs";

test("parses supported CLI options and rejects unknown flags", () => {
  assert.deepEqual(parseCliArgs(["--check"]), { check: true, help: false });
  assert.deepEqual(parseCliArgs(["-h"]), { check: false, help: true });
  assert.throws(() => parseCliArgs(["--force"]), /Unknown option/);
});

test("validates launcher ports", () => {
  assert.equal(parsePort(undefined, "API_PORT", 4000), 4000);
  assert.equal(parsePort("5174", "WEB_PORT", 5173), 5174);
  assert.throws(() => parsePort("0", "API_PORT", 4000), /between 1 and 65535/);
  assert.throws(() => parsePort("abc", "API_PORT", 4000), /between 1 and 65535/);
});

test("requires the supported Node major", () => {
  assert.equal(isSupportedNodeVersion("v22.11.0"), true);
  assert.equal(isSupportedNodeVersion("23.1.0"), true);
  assert.equal(isSupportedNodeVersion("v20.18.0"), false);
  assert.equal(isSupportedNodeVersion("unknown"), false);
});

test("prefers pinned pnpm through Corepack and falls back to PATH", () => {
  assert.deepEqual(
    choosePackageManager({
      corepack: { ok: true, version: "9.15.4" },
      pnpm: { ok: true, version: "11.19.0" },
    }),
    {
      command: "corepack",
      prefix: ["pnpm"],
      version: "9.15.4",
      source: "Corepack",
    },
  );
  assert.equal(
    choosePackageManager({
      corepack: { ok: false, version: "" },
      pnpm: { ok: true, version: "9.15.4" },
    }).command,
    "pnpm",
  );
  assert.throws(
    () => choosePackageManager({ corepack: { ok: false }, pnpm: { ok: false } }),
    /Enable Corepack/,
  );
});

test("builds fixed local URLs and isolated service commands", () => {
  const config = createLauncherConfig({
    API_PORT: "4001",
    WEB_PORT: "5175",
    MONGO_URI: "mongodb://127.0.0.1:27017/launcher_test",
  });
  assert.equal(config.apiUrl, "http://127.0.0.1:4001");
  assert.equal(config.webUrl, "http://127.0.0.1:5175");

  const services = createServiceSpecs(config, {
    command: "corepack",
    prefix: ["pnpm"],
  });
  assert.deepEqual(services.map((service) => service.label), ["api", "worker", "web"]);
  assert.deepEqual(services[0].args, ["pnpm", "--filter", "@atellier/api", "dev"]);
  assert.equal(services[0].environment.API_STORAGE, "mongo");
  assert.equal(services[1].environment.MONGO_URI, config.mongoUri);
  assert.equal(services[2].environment.VITE_API_URL, config.apiUrl);
  assert.equal(services[2].args.at(-1), "--strictPort");
});

test("rejects overlapping API and Web endpoints", () => {
  assert.throws(
    () => createLauncherConfig({ API_PORT: "4000", WEB_PORT: "4000" }),
    /must be different/,
  );
});
