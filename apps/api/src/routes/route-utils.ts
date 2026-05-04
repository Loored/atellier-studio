import type { FastifyReply } from "fastify";

const MONGO_OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_CORS_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export function bodyRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function stringField(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function optionalStringField(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value.trim() : undefined;
}

export function stringArrayField(body: Record<string, unknown>, key: string): string[] | undefined {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function isValidObjectId(value: string): boolean {
  return MONGO_OBJECT_ID_PATTERN.test(value) || UUID_PATTERN.test(value);
}

export function isAllowedLocalOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  try {
    const parsedOrigin = new URL(origin);
    return ["http:", "https:"].includes(parsedOrigin.protocol) && LOCAL_CORS_HOSTS.has(parsedOrigin.hostname);
  } catch {
    return false;
  }
}

export function badRequest(reply: FastifyReply, message: string): FastifyReply {
  return reply.code(400).send({ error: message });
}

export function notFound(reply: FastifyReply, message: string): FastifyReply {
  return reply.code(404).send({ error: message });
}
