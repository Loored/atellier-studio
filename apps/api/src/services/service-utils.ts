export type StorageMode = "mongo" | "memory";

export function toIso(value: Date | string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function cleanUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

export function toJsonRecord<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
