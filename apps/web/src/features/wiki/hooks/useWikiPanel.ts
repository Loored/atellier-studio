import { useWikiIndexApi, useWikiLogApi } from "../../../api/hooks/wiki/useWikiApi";

export function useWikiPanel() {
  const {
    data: wikiIndex,
    isFetching: isFetchingWikiIndex,
    isLoadingWithoutCache: isLoadingWikiIndexWithoutCache,
  } = useWikiIndexApi();
  const {
    data: wikiLog,
    isFetching: isFetchingWikiLog,
    isLoadingWithoutCache: isLoadingWikiLogWithoutCache,
  } = useWikiLogApi();

  const latestLog = wikiLog?.content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(-8)
    .join("\n");

  return {
    wikiIndex,
    wikiLog,
    latestLog,
    isFetchingWikiIndex,
    isFetchingWikiLog,
    isLoadingWikiIndexWithoutCache,
    isLoadingWikiLogWithoutCache,
  };
}
