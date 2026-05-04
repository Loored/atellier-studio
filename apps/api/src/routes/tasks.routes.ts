import type { FastifyInstance } from "fastify";
import { TASK_PRIORITIES, TASK_STATUSES, type CreateTaskInput, type UpdateTaskInput } from "@atellier/shared";
import type { AppServices } from "../services/app-services";
import {
  badRequest,
  bodyRecord,
  isOneOf,
  notFound,
  optionalStringField,
  stringArrayField,
  stringField,
} from "./route-utils";

export async function tasksRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/tasks", async () => services.tasks.list());

  fastify.post("/tasks", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    const title = stringField(body, "title");
    if (!title) {
      return badRequest(reply, "Task title is required.");
    }

    if (body.status !== undefined && !isOneOf(body.status, TASK_STATUSES)) {
      return badRequest(reply, "Task status is invalid.");
    }

    if (body.priority !== undefined && !isOneOf(body.priority, TASK_PRIORITIES)) {
      return badRequest(reply, "Task priority is invalid.");
    }

    const input: CreateTaskInput = {
      title,
      description: optionalStringField(body, "description"),
      status: body.status,
      priority: body.priority,
      clientId: optionalStringField(body, "clientId"),
      projectId: optionalStringField(body, "projectId"),
      sourceIds: stringArrayField(body, "sourceIds"),
      assignedAgentId: optionalStringField(body, "assignedAgentId"),
    };

    return reply.code(201).send(await services.tasks.create(input));
  });

  fastify.patch("/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    if (body.status !== undefined && !isOneOf(body.status, TASK_STATUSES)) {
      return badRequest(reply, "Task status is invalid.");
    }

    if (body.priority !== undefined && !isOneOf(body.priority, TASK_PRIORITIES)) {
      return badRequest(reply, "Task priority is invalid.");
    }

    const update: UpdateTaskInput = {
      title: optionalStringField(body, "title"),
      description: optionalStringField(body, "description"),
      status: body.status,
      priority: body.priority,
      clientId: optionalStringField(body, "clientId"),
      projectId: optionalStringField(body, "projectId"),
      sourceIds: stringArrayField(body, "sourceIds"),
      assignedAgentId: optionalStringField(body, "assignedAgentId"),
    };

    const task = await services.tasks.update(id, update);
    return task ?? notFound(reply, "Task not found.");
  });
}
