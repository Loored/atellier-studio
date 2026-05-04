import type { CreateTaskInput, Task, UpdateTaskInput } from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const tasksService = {
  async list(): Promise<Task[]> {
    const response = await httpClient.get<Task[]>("/tasks");
    return response.data;
  },

  async create(input: CreateTaskInput): Promise<Task> {
    const response = await httpClient.post<Task>("/tasks", input);
    return response.data;
  },

  async update(taskId: string, input: UpdateTaskInput): Promise<Task> {
    const response = await httpClient.patch<Task>(`/tasks/${taskId}`, input);
    return response.data;
  },
};
