import { useCallback, useEffect, useState } from "react";

function readParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function writeParams(params: URLSearchParams): void {
  const search = params.toString();
  const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

export function useUrlState<T extends string>(
  key: string,
  defaultValue: T,
  options?: { isValid?: (raw: string) => raw is T },
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = readParams().get(key);
    if (raw === null) return defaultValue;
    if (options?.isValid && !options.isValid(raw)) return defaultValue;
    return raw as T;
  });

  useEffect(() => {
    const params = readParams();
    if (value === defaultValue) {
      if (params.has(key)) {
        params.delete(key);
        writeParams(params);
      }
      return;
    }
    if (params.get(key) === value) return;
    params.set(key, value);
    writeParams(params);
  }, [key, value, defaultValue]);

  return [value, setValue];
}

export function useUrlSetState<T extends string>(
  key: string,
  defaultValue: ReadonlyArray<T>,
  options: { allValues: ReadonlyArray<T> },
): [Set<T>, (next: Set<T>) => void] {
  const [value, setValue] = useState<Set<T>>(() => {
    const raw = readParams().get(key);
    if (raw === null) return new Set(defaultValue);
    const parts = raw
      .split(",")
      .map((part) => part.trim())
      .filter((part): part is T => (options.allValues as ReadonlyArray<string>).includes(part));
    return parts.length > 0 ? new Set(parts) : new Set(defaultValue);
  });

  const setSet = useCallback((next: Set<T>) => {
    setValue(new Set(next));
  }, []);

  useEffect(() => {
    const params = readParams();
    const arr = [...value].sort();
    const isDefault =
      arr.length === defaultValue.length && arr.every((v) => defaultValue.includes(v));
    if (isDefault) {
      if (params.has(key)) {
        params.delete(key);
        writeParams(params);
      }
      return;
    }
    const serialized = arr.join(",");
    if (params.get(key) === serialized) return;
    params.set(key, serialized);
    writeParams(params);
  }, [key, value, defaultValue]);

  return [value, setSet];
}

export function useUrlNullable<T extends string>(
  key: string,
): [T | null, (next: T | null) => void] {
  const [value, setValue] = useState<T | null>(() => (readParams().get(key) as T | null) ?? null);

  useEffect(() => {
    const params = readParams();
    if (value === null) {
      if (params.has(key)) {
        params.delete(key);
        writeParams(params);
      }
      return;
    }
    if (params.get(key) === value) return;
    params.set(key, value);
    writeParams(params);
  }, [key, value]);

  return [value, setValue];
}
