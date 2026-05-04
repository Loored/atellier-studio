import "dotenv/config";
import { buildServer } from "./server";
import { connectMongo } from "./db/mongo";
import type { StorageMode } from "./services/service-utils";

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "127.0.0.1";
const mongoUri = process.env.MONGO_URI ?? "mongodb://localhost:27017/atellier_studio";
const storageMode: StorageMode = process.env.API_STORAGE === "memory" ? "memory" : "mongo";

async function main(): Promise<void> {
  if (storageMode === "mongo") {
    await connectMongo(mongoUri);
  }

  const server = await buildServer({
    atelierRoot: process.env.ATELLIER_ROOT,
    logger: process.env.NODE_ENV !== "test",
    storageMode,
  });

  await server.listen({ port, host });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
