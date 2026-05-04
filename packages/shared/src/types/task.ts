export const TASK_STATUSES = ["inbox", "active", "blocked", "review", "done"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  clientId?: string;
  projectId?: string;
  sourceIds?: string[];
  assignedAgentId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  clientId?: string;
  projectId?: string;
  sourceIds?: string[];
  assignedAgentId?: string;
};

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, "sourceIds">> & {
  sourceIds?: string[];
};
