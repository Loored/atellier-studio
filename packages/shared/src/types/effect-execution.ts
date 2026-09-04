export const TOOL_EFFECT_CLASSIFICATIONS = [
  "read",
  "reversible",
  "irreversible",
] as const;

export type ToolEffectClassification = (typeof TOOL_EFFECT_CLASSIFICATIONS)[number];

export const EFFECT_EXECUTION_STATUSES = [
  "in-progress",
  "completed",
  "failed",
] as const;

export type EffectExecutionStatus = (typeof EFFECT_EXECUTION_STATUSES)[number];

export type EffectExecutionRecord<TResult = unknown> = {
  id: string;
  toolName: string;
  classification: ToolEffectClassification;
  idempotencyKey: string;
  fingerprint: string;
  attempt: number;
  status: EffectExecutionStatus;
  result?: TResult;
  error?: string;
  startedAt: string;
  completedAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExecuteToolEffectInput = {
  toolName: string;
  classification: ToolEffectClassification;
  idempotencyKey?: string;
  fingerprint?: string;
};

export type ToolEffectExecutionOutcome<TResult = unknown> =
  | {
      disposition: "executed";
      result: TResult;
      record?: EffectExecutionRecord<TResult>;
    }
  | {
      disposition: "reused";
      result: TResult;
      record: EffectExecutionRecord<TResult>;
    }
  | {
      disposition: "in-progress";
      record: EffectExecutionRecord<TResult>;
    }
  | {
      disposition: "failed";
      error: string;
      record: EffectExecutionRecord<TResult>;
    };
