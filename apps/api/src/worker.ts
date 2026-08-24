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
  });

  let stopping = false;
  const stop = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    await services.durableRuntime.stop();
    await disconnectMongo();
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());

  console.info("[atellier-worker] Durable orchestration worker started.");
  await services.durableRuntime.startPolling();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
