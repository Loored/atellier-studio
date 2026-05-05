import mongoose, { Schema } from "mongoose";
import { AGENT_ROLES, AGENT_STATUSES, type Agent } from "@atellier/shared";

const AgentAvatarSchema = new Schema(
  {
    sprite: String,
    room: String,
    x: Number,
    y: Number,
  },
  { _id: false },
);

const AgentSchema = new Schema<Agent>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: AGENT_ROLES, required: true },
    status: { type: String, enum: AGENT_STATUSES, default: "idle", required: true },
    instructions: String,
    currentTaskId: String,
    lastRunId: String,
    avatar: AgentAvatarSchema,
  },
  { timestamps: true },
);

AgentSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    const output = ret as { _id?: unknown; id?: string };
    output.id = String(output._id);
    delete output._id;
    return output;
  },
});

export const AgentModel = mongoose.models.Agent || mongoose.model<Agent>("Agent", AgentSchema);
