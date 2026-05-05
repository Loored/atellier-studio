import mongoose, { Schema } from "mongoose";
import { RUN_LOG_LEVELS, RUN_REVIEW_STATUSES, RUN_STATUSES, RUN_TYPES, type Run } from "@atellier/shared";

const RunLogEntrySchema = new Schema(
  {
    timestamp: { type: String, required: true },
    level: { type: String, enum: RUN_LOG_LEVELS, default: "info", required: true },
    message: { type: String, required: true },
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
    input: Schema.Types.Mixed,
    output: Schema.Types.Mixed,
    logs: { type: [RunLogEntrySchema], default: [] },
  },
  { timestamps: true },
);

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
