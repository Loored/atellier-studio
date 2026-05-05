import { useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type {
  AppendWikiLogInput,
  AppendWikiLogResponse,
  WikiIngestInput,
  WikiIngestResponse,
  WikiLintResponse,
  WikiPageResponse,
  WikiQueryInput,
  WikiQueryResponse,
} from "@atellier/shared";
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

export function useWikiPageApi(path: string | null) {
  return useQueryInstance<WikiPageResponse>({
    queryKey: queryKeys.wiki.page(path ?? ""),
    queryFn: () => wikiService.readPage(path ?? ""),
    enabled: Boolean(path),
  });
}

export function useWikiQueryApi(
  query: string | null,
  limit = 5,
  sourceType: WikiQueryInput["sourceType"] = undefined,
) {
  return useQueryInstance<WikiQueryResponse>({
    queryKey: queryKeys.wiki.query(query ?? "", limit, sourceType ?? "all"),
    queryFn: () => wikiService.query({ query: query ?? "", limit, sourceType }),
    enabled: Boolean(query && query.trim().length > 0),
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

export type UseWikiIngestApiOptions = UseMutationOptions<WikiIngestResponse, Error, WikiIngestInput>;

export function useWikiIngestApi(options: UseWikiIngestApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<WikiIngestResponse, Error, WikiIngestInput>(
    {
      mutationFn: (input) => wikiService.ingest(input),
      ...options,
    },
    {
      onSuccess: async () => {
        notifySuccess("Source ingested into wiki");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.index }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type UseWikiLintApiOptions = UseMutationOptions<WikiLintResponse, Error, void>;

export function useWikiLintApi(options: UseWikiLintApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<WikiLintResponse, Error, void>(
    {
      mutationFn: () => wikiService.lint(),
      ...options,
    },
    {
      onSuccess: async (result) => {
        notifySuccess(result.ok ? "Wiki lint passed" : "Wiki lint found issues");
        await queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log });
      },
      onError: (error) => notifyError(error),
    },
  );
}
