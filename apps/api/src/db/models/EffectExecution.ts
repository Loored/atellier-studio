import mongoose, { Schema } from "mongoose";
import {
  EFFECT_EXECUTION_STATUSES,
  TOOL_EFFECT_CLASSIFICATIONS,
  type EffectExecutionRecord,
} from "@atellier/shared";

const EffectExecutionSchema = new Schema<EffectExecutionRecord>(
  {
    toolName: { type: String, required: true },
    classification: {
      type: String,
      enum: TOOL_EFFECT_CLASSIFICATIONS,
      required: true,
    },
    idempotencyKey: { type: String, required: true },
    fingerprint: { type: String, required: true },
    attempt: { type: Number, default: 1, required: true },
    status: {
      type: String,
      enum: EFFECT_EXECUTION_STATUSES,
      required: true,
    },
    result: Schema.Types.Mixed,
    error: String,
    startedAt: { type: String, required: true },
    completedAt: String,
    failedAt: String,
  },
  { timestamps: true },
);

EffectExecutionSchema.index({ idempotencyKey: 1 }, { unique: true });
EffectExecutionSchema.index({ status: 1, updatedAt: -1 });

EffectExecutionSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    const output = ret as { _id?: unknown; id?: string };
    output.id = String(output._id);
    delete output._id;
    return output;
  },
});

export const EffectExecutionModel =
  mongoose.models.EffectExecution
  || mongoose.model<EffectExecutionRecord>("EffectExecution", EffectExecutionSchema);
