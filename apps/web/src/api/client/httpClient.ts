import axios from "axios";
import { toApiError } from "./apiError";

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000",
  headers: {
    "Content-Type": "application/json",
  },
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
);
