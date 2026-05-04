import { useQuery, type QueryKey, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";

export type UseQueryInstanceResult<TData> = UseQueryResult<TData, Error> & {
  isLoadingWithoutCache: boolean;
};

export function useQueryInstance<TQueryFnData, TData = TQueryFnData>(
  options: UseQueryOptions<TQueryFnData, Error, TData, QueryKey>,
): UseQueryInstanceResult<TData> {
  const query = useQuery({
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    ...options,
  });

  return {
    ...query,
    isLoadingWithoutCache: query.isLoading && query.data === undefined,
  };
}
