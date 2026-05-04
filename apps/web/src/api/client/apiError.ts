import axios from "axios";

export type ApiError = Error & {
  status?: number;
  details?: unknown;
};

export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const apiError = new Error(error.message) as ApiError;
    apiError.status = error.response?.status;
    apiError.details = error.response?.data;
    return apiError;
  }

  if (error instanceof Error) {
    return error as ApiError;
  }

  return new Error("Unknown API error") as ApiError;
}
