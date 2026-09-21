import type { ModelProfile } from "./health";

export type ControlBundle = {
  id: string;
  version: number;
  status: "draft" | "inactive";
  modelProfiles: Record<ModelProfile, string>;
  limits: { executionTimeoutMs: number; maxRetries: number; contextBytes: number };
  allowedTools: string[];
  fingerprint: string;
  createdAt: string;
  path: string;
};

export type CreateControlBundleInput = Omit<ControlBundle, "id" | "version" | "status" | "fingerprint" | "createdAt" | "path"> & { note: string };

export const CONTROL_BUNDLE_PROPOSAL_STATUSES = ["pending-approval", "evidence-stale", "approved", "canary-planned", "canary-rolled-back"] as const;

export type ControlBundleProposalStatus = (typeof CONTROL_BUNDLE_PROPOSAL_STATUSES)[number];

export type ControlBundleProposal = {
  id: string;
  experimentId: string;
  bundleId: string;
  bundleFingerprint: string;
  /** Digest of the paired Evaluation Ledger evidence used to make this eligible. */
  evidenceDigest: string;
  fingerprint: string;
  status: ControlBundleProposalStatus;
  rationale: string;
  createdAt: string;
  path: string;
};

export type ControlBundleCanary = {
  id: string;
  proposalId: string;
  proposalFingerprint: string;
  bundleId: string;
  bundleFingerprint: string;
  approvalId: string;
  /** Fingerprint of the frozen proposal, approval, sample, and bundle snapshot. */
  fingerprint: string;
  frozenBundle: Pick<ControlBundle, "modelProfiles" | "limits" | "allowedTools">;
  samplePercent: number;
  status: "planned" | "rolled-back";
  rollbackReason?: string;
  createdAt: string;
  path: string;
};

export type ControlBundleApproval = {
  id: string;
  proposalId: string;
  proposalFingerprint: string;
  bundleFingerprint: string;
  scope: "control-bundle-canary";
  status: "active" | "expired";
  grantedAt: string;
  expiresAt: string;
  note: string;
  path: string;
};

export type GrantControlBundleApprovalInput = {
  proposalId: string;
  scope: ControlBundleApproval["scope"];
  expiresAt: string;
  note: string;
};

export type ExecutionBudgetReceipt = {
  id: string;
  canaryId: string;
  canaryFingerprint: string;
  proposalFingerprint: string;
  bundleId: string;
  bundleFingerprint: string;
  runId: string;
  selectionBucket: number;
  /** Binds this run to the exact frozen canary configuration. */
  assignmentFingerprint: string;
  modelProfiles: ControlBundle["modelProfiles"];
  limits: ControlBundle["limits"];
  allowedTools: string[];
  status: "reserved" | "blocked";
  reason?: string;
  createdAt: string;
  path: string;
};
