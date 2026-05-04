import { useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type { AppendWikiLogInput, AppendWikiLogResponse, WikiPageResponse } from "@atellier/shared";
import { useApiAlerts } from "../../alerts/useApiAlerts";
import { queryKeys } from "../../query/queryKeys";
import { useMutationInstance } from "../../query/useMutationInstance";
import { useQueryInstance } from "../../query/useQueryInstance";
import { wikiService } from "../../services/wiki.service";

export function useWikiIndexApi() {
  return useQueryInstance<WikiPageResponse>({
    queryKey: queryKeys.wiki.index,
    queryFn: wikiService.readIndex,
  });
}

export function useWikiLogApi() {
  return useQueryInstance<WikiPageResponse>({
    queryKey: queryKeys.wiki.log,
    queryFn: wikiService.readLog,
  });
}

export type UseAppendWikiLogApiOptions = UseMutationOptions<AppendWikiLogResponse, Error, AppendWikiLogInput>;

export function useAppendWikiLogApi(options: UseAppendWikiLogApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<AppendWikiLogResponse, Error, AppendWikiLogInput>(
    {
      mutationFn: (input) => wikiService.appendLog(input),
      ...options,
    },
    {
      onSuccess: async () => {
        notifySuccess("Wiki log updated");
        await queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log });
      },
      onError: (error) => notifyError(error),
    },
  );
}
