import mongoose, { Schema } from "mongoose";
import {
  AGENT_ROLES,
  REVIEW_LEARNING_SIGNALS,
  RUN_EXECUTION_KINDS,
  RUN_EXECUTION_PHASES,
  RUN_LOG_LEVELS,
  RUN_REVIEW_STATUSES,
  RUN_STATUSES,
  RUN_TYPES,
  type Run,
} from "@atellier/shared";

const RunLogEntrySchema = new Schema(
  {
    timestamp: { type: String, required: true },
    level: { type: String, enum: RUN_LOG_LEVELS, default: "info", required: true },
    message: { type: String, required: true },
  },
  { _id: false },
);

const RunExecutionSchema = new Schema(
  {
    schemaVersion: { type: Number, required: true },
    kind: { type: String, enum: RUN_EXECUTION_KINDS, required: true },
    phase: { type: String, enum: RUN_EXECUTION_PHASES, required: true },
    definitionHash: { type: String, required: true },
    definitionSnapshot: { type: Schema.Types.Mixed, required: true },
    idempotencyKey: { type: String, required: true },
    attempt: { type: Number, default: 0, required: true },
    maxAttempts: { type: Number, default: 3, required: true },
    nextEventSequence: { type: Number, default: 0, required: true },
    availableAt: { type: String, required: true },
    leaseOwner: String,
    leaseExpiresAt: String,
    heartbeatAt: String,
    cancelRequestedAt: String,
    startedAt: String,
    finishedAt: String,
    lastError: String,
    currentStepId: String,
  },
  { _id: false },
);

const ReviewLearningSchema = new Schema(
  {
    runId: { type: String, required: true },
    taskId: String,
    role: { type: String, enum: AGENT_ROLES, required: true },
    lesson: { type: String, required: true },
    memoryPath: { type: String, required: true },
    roleMemoryPath: { type: String, required: true },
    logPath: { type: String, required: true },
    signal: { type: String, enum: REVIEW_LEARNING_SIGNALS, required: false },
    signalPath: String,
    capturedAt: { type: String, required: true },
  },
  { _id: false },
);

const RunMemoryCaptureSchema = new Schema(
  {
    wikiPath: { type: String, required: true },
    logPath: { type: String, required: true },
    summary: { type: String, required: true },
    capturedAt: { type: String, required: true },
    learning: { type: ReviewLearningSchema, required: false },
  },
  { _id: false },
);

const RunSchema = new Schema<Run>(
  {
    taskId: String,
    agentId: String,
    type: { type: String, enum: RUN_TYPES, required: true },
    status: { type: String, enum: RUN_STATUSES, default: "queued", required: true },
    reviewStatus: { type: String, enum: RUN_REVIEW_STATUSES, required: false },
    deliverablePath: String,
    memory: { type: RunMemoryCaptureSchema, required: false },
    input: Schema.Types.Mixed,
    output: Schema.Types.Mixed,
    execution: { type: RunExecutionSchema, required: false },
    logs: { type: [RunLogEntrySchema], default: [] },
  },
  { timestamps: true },
);

RunSchema.index({ agentId: 1, createdAt: -1 });
RunSchema.index({ "input.orchestrationRunId": 1 });
RunSchema.index({
  type: 1,
  status: 1,
  "execution.kind": 1,
  "execution.availableAt": 1,
  "execution.leaseExpiresAt": 1,
});
RunSchema.index({ "execution.idempotencyKey": 1 }, { unique: true, sparse: true });

RunSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    const output = ret as { _id?: unknown; id?: string };
    output.id = String(output._id);
    delete output._id;
    return output;
  },
});

export const RunModel = mongoose.models.Run || mongoose.model<Run>("Run", RunSchema);
