import mongoose, { Schema } from "mongoose";
import { RUN_EVENT_TYPES, RUN_EXECUTION_PHASES, type RunEvent } from "@atellier/shared";

const RunEventSchema = new Schema<RunEvent>(
  {
    runId: { type: String, required: true, index: true },
    sequence: { type: Number, required: true },
    type: { type: String, enum: RUN_EVENT_TYPES, required: true },
    phase: { type: String, enum: RUN_EXECUTION_PHASES, required: false },
    stepId: String,
    message: String,
    payload: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

RunEventSchema.index({ runId: 1, sequence: 1 }, { unique: true });

RunEventSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    const output = ret as { _id?: unknown; id?: string };
    output.id = String(output._id);
    delete output._id;
    return output;
  },
});

export const RunEventModel =
  mongoose.models.RunEvent || mongoose.model<RunEvent>("RunEvent", RunEventSchema);
