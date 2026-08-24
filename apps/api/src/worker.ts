import "dotenv/config";
import { connectMongo, disconnectMongo } from "./db/mongo";
import { assertRuntimeExecutorConfig, readRuntimeConfig } from "./runtime-config";
import { createAppServices } from "./services/app-services";

async function main(): Promise<void> {
  const config = readRuntimeConfig();
  assertRuntimeExecutorConfig(config);
  if (config.storageMode !== "mongo") {
    throw new Error("[atellier-worker] Durable worker requires Mongo storage.");
  }

  await connectMongo(config.mongoUri);
  const services = await createAppServices({
    ...config.serviceOptions,
    inlineDurableRuntime: false,
    runtimeDiagnosticSink: (event) => {
      console.info(`[atellier-worker] ${JSON.stringify(event)}`);
    },
  });

  let stopPromise: Promise<void> | null = null;
  const stop = (signal: NodeJS.Signals): Promise<void> => {
    if (!stopPromise) {
      console.info(`[atellier-worker] Received ${signal}; waiting for active work before disconnecting Mongo.`);
      stopPromise = services.durableRuntime.stop().finally(() => disconnectMongo());
    }
    return stopPromise;
  };
  const handleSignal = (signal: NodeJS.Signals): void => {
    void stop(signal).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));

  await services.durableRuntime.startPolling();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
