import { useCallback } from "react";
import type { ApiError } from "../client/apiError";

function extractApiErrorMessage(error: Error): string {
  const apiError = error as ApiError;
  const details = apiError.details;

  if (details && typeof details === "object" && "error" in details) {
    const errorMessage = (details as { error?: unknown }).error;
    if (typeof errorMessage === "string" && errorMessage.trim().length > 0) {
      return errorMessage;
    }
  }

  return error.message || "Unexpected API error";
}

export function useApiAlerts() {
  const notifySuccess = useCallback((message: string) => {
    console.info(message);
  }, []);

  const notifyError = useCallback((error: Error) => {
    console.error(extractApiErrorMessage(error), error);
  }, []);

  return {
    notifySuccess,
    notifyError,
  };
}
