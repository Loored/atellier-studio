import mongoose, { Schema } from "mongoose";
import { AGENT_MESSAGE_ROLES, type AgentMessage } from "@atellier/shared";

const MessageSchema = new Schema<AgentMessage>(
  {
    agentId: { type: String, required: true, index: true },
    runId: String,
    role: { type: String, enum: AGENT_MESSAGE_ROLES, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true },
);

MessageSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    const output = ret as { _id?: unknown; id?: string };
    output.id = String(output._id);
    delete output._id;
    return output;
  },
});

export const MessageModel = mongoose.models.Message || mongoose.model<AgentMessage>("Message", MessageSchema);
