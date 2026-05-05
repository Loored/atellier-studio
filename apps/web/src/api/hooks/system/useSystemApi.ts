import type { HealthStatus } from "@atellier/shared";
import { queryKeys } from "../../query/queryKeys";
import { useQueryInstance } from "../../query/useQueryInstance";
import { systemService } from "../../services/system.service";

export function useHealthApi() {
  return useQueryInstance<HealthStatus>({
    queryKey: queryKeys.system.health,
    queryFn: systemService.readHealth,
  });
}
