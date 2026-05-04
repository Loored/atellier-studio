import mongoose, { Schema } from "mongoose";
import { TASK_PRIORITIES, TASK_STATUSES, type Task } from "@atellier/shared";

const TaskSchema = new Schema<Task>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    status: { type: String, enum: TASK_STATUSES, default: "inbox", required: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: "medium", required: true },
    clientId: String,
    projectId: String,
    sourceIds: [{ type: String }],
    assignedAgentId: String,
  },
  { timestamps: true },
);

TaskSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    const output = ret as { _id?: unknown; id?: string };
    output.id = String(output._id);
    delete output._id;
    return output;
  },
});

export const TaskModel = mongoose.models.Task || mongoose.model<Task>("Task", TaskSchema);
