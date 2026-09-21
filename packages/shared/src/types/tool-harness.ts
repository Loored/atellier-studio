import type { AgentRole } from "./agent";
import type { ToolEffectClassification } from "./effect-execution";

/**
 * The capability contract used by Atellier's internal tool harness.
 *
 * A definition describes an approved capability, not an arbitrary command.
 * The first slice intentionally exposes the catalog and policy before wiring
 * agents to execute any tool adapter.
 */
export const TOOL_AUTONOMY_LEVELS = ["automatic", "approval-required", "human-only"] as const;

export type ToolAutonomyLevel = (typeof TOOL_AUTONOMY_LEVELS)[number];

export const TOOL_EXECUTION_STATES = ["policy-only", "available"] as const;

export type ToolExecutionState = (typeof TOOL_EXECUTION_STATES)[number];

export type ToolDefinition = {
  name: string;
  label: string;
  description: string;
  classification: ToolEffectClassification;
  autonomy: ToolAutonomyLevel;
  executionState: ToolExecutionState;
  allowedRoles: AgentRole[];
  inputSummary: string;
  evidenceSummary: string;
};

export const TOOL_POLICY_ACTIONS = ["allow", "require-approval", "deny"] as const;

export type ToolPolicyAction = (typeof TOOL_POLICY_ACTIONS)[number];

export const TOOL_POLICY_REASON_CODES = [
  "read-only-allowed",
  "approval-granted",
  "approval-required",
  "tool-unregistered",
  "tool-not-executable",
  "role-not-authorized",
  "human-only-tool",
  "budget-tool-denied",
] as const;

export type ToolPolicyReasonCode = (typeof TOOL_POLICY_REASON_CODES)[number];

export type ToolApprovalGrant = {
  toolName: string;
  grantedBy: "human";
  grantedAt: string;
  expiresAt?: string;
};

export type ToolPolicyRequest = {
  toolName: string;
  agentRole: AgentRole;
  approval?: ToolApprovalGrant;
};

export type ToolPolicyDecision = {
  action: ToolPolicyAction;
  reasonCode: ToolPolicyReasonCode;
  reason: string;
  toolName: string;
  agentRole: AgentRole;
  classification?: ToolEffectClassification;
  evidenceRequired: boolean;
};

export type ToolHarnessCatalogResponse = {
  generatedAt: string;
  phase: "catalog-and-policy";
  definitions: ToolDefinition[];
  safetySummary: string;
};

export const TOOL_INVOCATION_STATUSES = ["succeeded", "denied", "failed"] as const;

export type ToolInvocationStatus = (typeof TOOL_INVOCATION_STATUSES)[number];

/**
 * A compact durable receipt. Raw tool output is returned to the immediate
 * caller only; the parent run keeps this bounded evidence record instead.
 */
export type ToolInvocation = {
  id: string;
  parentRunId: string;
  toolName: string;
  agentRole: AgentRole;
  classification?: ToolEffectClassification;
  status: ToolInvocationStatus;
  policy: ToolPolicyDecision;
  inputDigest: string;
  outputSummary: string;
  evidencePaths: string[];
  requestedAt: string;
  completedAt: string;
};

export type InvokeToolInput = {
  parentRunId: string;
  toolName: string;
  agentRole: AgentRole;
  input: Record<string, unknown>;
};

/** A model-originated request that is parsed only when it is the full response. */
export type AgentToolRequest = {
  toolName: string;
  input: Record<string, unknown>;
};

export type ToolInvocationResponse = {
  invocation: ToolInvocation;
  result?: unknown;
};

/** A durable preview; no workspace write occurs until a later approved apply step. */
export type ReversibleWorkspaceChange = {
  id: string;
  path: string;
  before: string;
  after: string;
  beforeDigest: string;
  afterDigest: string;
  fingerprint: string;
  status: "preview" | "approved" | "applied" | "rolled-back";
  /** Present after an atomic apply; required to authorize its exact rollback. */
  rollbackHandle?: string;
  lastEffect?: {
    operation: "apply" | "rollback";
    idempotencyKey: string;
    fingerprint: string;
    recordedAt: string;
  };
  createdAt: string;
  evidencePath: string;
};

export type ReversibleWorkspaceApproval = {
  id: string;
  changeId: string;
  changeFingerprint: string;
  status: "active" | "expired";
  grantedAt: string;
  expiresAt: string;
  note: string;
  path: string;
};

export type ApproveReversibleWorkspaceChangeInput = {
  changeId: string;
  expiresAt: string;
  note: string;
};

export type ApplyReversibleWorkspaceChangeResult = {
  id: string;
  status: "applied";
  rollbackHandle: string;
};

export type RollbackReversibleWorkspaceChangeInput = {
  changeId: string;
  rollbackHandle: string;
};

export type RollbackReversibleWorkspaceChangeResult = {
  id: string;
  status: "rolled-back";
};

export const SUPERVISED_CODE_CHANGE_STATUSES = [
  "prepared",
  "verified",
  "verification-failed",
  "discarded",
] as const;
export type SupervisedCodeChangeStatus = (typeof SUPERVISED_CODE_CHANGE_STATUSES)[number];

export const SUPERVISED_CODE_VERIFICATION_CHECKS = [
  "api-typecheck",
  "web-typecheck",
  "api-tests",
  "web-tests",
] as const;
export type SupervisedCodeVerificationCheck = (typeof SUPERVISED_CODE_VERIFICATION_CHECKS)[number];

export type SupervisedCodeVerificationReceipt = {
  check: SupervisedCodeVerificationCheck;
  command: string;
  status: "passed" | "failed";
  exitCode: number | null;
  durationMs: number;
  termination?: "completed" | "timed-out" | "cancelled";
  stdoutPath: string;
  stderrPath: string;
  idempotencyKey: string;
  fingerprint: string;
  recordedAt: string;
};

/** A code preview applied only inside a disposable, server-owned git worktree. */
export type SupervisedCodeChange = {
  id: string;
  changeId: string;
  changeFingerprint: string;
  targetPath: string;
  worktreePath: string;
  baseRevision: string;
  status: SupervisedCodeChangeStatus;
  verificationPlan: SupervisedCodeVerificationCheck[];
  verificationReceipts: SupervisedCodeVerificationReceipt[];
  createdAt: string;
  evidencePath: string;
  discardedAt?: string;
};

export type CodeChangeVerification = {
  changeId: string;
  changeFingerprint: string;
  commandLabel: "api-typecheck" | "web-typecheck" | "focused-tests";
  passed: boolean;
  summary: string;
  verifiedAt: string;
  path: string;
};

export type RecordCodeChangeVerificationInput = Omit<CodeChangeVerification, "changeFingerprint" | "verifiedAt" | "path">;
