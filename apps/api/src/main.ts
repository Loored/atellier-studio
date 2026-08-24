import "dotenv/config";
import type { AddressInfo } from "node:net";
import { connectMongo } from "./db/mongo";
import { assertRuntimeExecutorConfig, readRuntimeConfig } from "./runtime-config";
import { buildServer } from "./server";

type HealthPayload = {
  status?: string;
  service?: string;
};

async function isAtellierApiRunning(targetHost: string, targetPort: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`http://${targetHost}:${targetPort}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as HealthPayload;
    return payload.status === "ok" && payload.service === "atellier-api";
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const config = readRuntimeConfig();
  assertRuntimeExecutorConfig(config);
  if (config.storageMode === "mongo") {
    await connectMongo(config.mongoUri);
  }

  const server = await buildServer({
    ...config.serviceOptions,
    logger: config.logger,
  });

  try {
    await server.listen({ port: config.port, host: config.host });
    const address = server.server.address() as AddressInfo | null;
    if (address) {
      console.info(`[atellier-api] Listening on http://${config.host}:${address.port}`);
    }
  } catch (error) {
    const listenError = error as NodeJS.ErrnoException;
    if (listenError.code !== "EADDRINUSE") throw error;
    if (await isAtellierApiRunning(config.host, config.port)) {
      console.info(
        `[atellier-api] Port ${config.port} is already used by Atellier API on ${config.host}; reusing it.`,
      );
      return;
    }
    throw new Error(
      `[atellier-api] Port ${config.host}:${config.port} is already in use. `
        + "Stop that process or set API_PORT to a free port.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
