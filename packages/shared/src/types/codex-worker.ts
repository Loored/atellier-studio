export const CODEX_WORKER_MODES = ["dry_run", "approved_step", "monitored_run"] as const;
export type CodexWorkerMode = (typeof CODEX_WORKER_MODES)[number];

export const CODEX_WORKER_PROFILES = ["cheap", "standard", "deep"] as const;
export type CodexWorkerProfile = (typeof CODEX_WORKER_PROFILES)[number];

export const CODEX_WORKER_STEP_STATUSES = ["pending", "approved", "running", "completed", "failed", "blocked"] as const;
export type CodexWorkerStepStatus = (typeof CODEX_WORKER_STEP_STATUSES)[number];

export type CodexWorkerStepEvidenceArtifact = {
  label: string;
  path: string;
};

export type CodexWorkerStepEvidence = {
  summary: string;
  capturedAt: string;
  command: string;
  workingDirectory: string;
  notes: string[];
  artifacts: CodexWorkerStepEvidenceArtifact[];
};

export type CodexWorkerFinalizeEvidence = {
  completedSteps: number;
  totalSteps: number;
  changedFiles: string[];
  testEvidence: string[];
};

export type CodexWorkerStep = {
  id: string;
  summary: string;
  command: string;
  workingDirectory: string;
  riskLevel: "low" | "medium" | "high";
  needsApproval: boolean;
  status: CodexWorkerStepStatus;
  approvedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  output?: string;
  stdoutPath?: string;
  stderrPath?: string;
  evidence?: CodexWorkerStepEvidence;
};
