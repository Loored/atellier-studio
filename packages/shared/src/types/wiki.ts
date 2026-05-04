export type WikiLogEventType =
  | "initialization"
  | "ingest"
  | "query"
  | "run_completed"
  | "run_log"
  | "wiki_lint"
  | "decision"
  | "manual";

export type WikiPageResponse = {
  path: string;
  content: string;
  ready: boolean;
};

export type WikiLogEntry = {
  timestamp: string;
  eventType: WikiLogEventType;
  title: string;
  summary?: string;
  runId?: string;
  taskId?: string;
  agentId?: string;
};

export type AppendWikiLogInput = {
  eventType: WikiLogEventType;
  title: string;
  summary?: string;
  runId?: string;
  taskId?: string;
  agentId?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
};

export type AppendWikiLogResponse = {
  path: string;
  entry: string;
};
