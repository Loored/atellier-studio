export type WikiLogEventType =
  | "initialization"
  | "ingest"
  | "query"
  | "wiki_write"
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

export type WikiWritePageInput = {
  path: string;
  content: string;
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

export type WikiIngestInput = {
  title: string;
  content: string;
  sourceType?: "note" | "research" | "client" | "decision" | "other";
  sourcePathHint?: string;
};

export type WikiIngestResponse = {
  rawPath: string;
  summaryPagePath: string;
  logPath: string;
  proposedTasks: string[];
};

export type WikiQueryInput = {
  query: string;
  limit?: number;
  sourceType?: "note" | "research" | "client" | "decision" | "other";
};

export type WikiQueryMatch = {
  path: string;
  snippet: string;
};

export type WikiQueryResponse = {
  query: string;
  matches: WikiQueryMatch[];
};

export type WikiLintIssue = {
  code: "missing_page" | "broken_link" | "stale_index_entry";
  path: string;
  message: string;
};

export type WikiLintResponse = {
  ok: boolean;
  issues: WikiLintIssue[];
  checkedAt: string;
};
