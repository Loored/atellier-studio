import path from "node:path";
import { AgentService } from "./agent.service";
import { RunService } from "./run.service";
import { TaskService } from "./task.service";
import { WikiService } from "./wiki.service";
import { type StorageMode } from "./service-utils";

export type AppServices = {
  agents: AgentService;
  tasks: TaskService;
  runs: RunService;
  wiki: WikiService;
};

export type CreateAppServicesOptions = {
  storageMode?: StorageMode;
  atelierRoot?: string;
};

export function resolveAtellierRoot(input?: string): string {
  if (input) {
    return path.resolve(process.cwd(), input);
  }

  return path.resolve(process.cwd(), "../../atelier");
}

export function createAppServices(options: CreateAppServicesOptions = {}): AppServices {
  const storageMode = options.storageMode ?? "mongo";
  const wiki = new WikiService(resolveAtellierRoot(options.atelierRoot));

  return {
    agents: new AgentService(storageMode),
    tasks: new TaskService(storageMode),
    runs: new RunService(storageMode, wiki),
    wiki,
  };
}
