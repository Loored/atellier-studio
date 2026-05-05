import type { HealthStatus } from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const systemService = {
  async readHealth(): Promise<HealthStatus> {
    const response = await httpClient.get<HealthStatus>("/health");
    return response.data;
  },
};
