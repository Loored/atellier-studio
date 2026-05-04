import { useMutation, type UseMutationOptions, type UseMutationResult } from "@tanstack/react-query";

export type MutationHookCallbacks<TData, TError, TVariables, TContext> = Pick<
  UseMutationOptions<TData, TError, TVariables, TContext>,
  "onSuccess" | "onError" | "onSettled"
>;

export function useMutationInstance<TData, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  hookCallbacks?: MutationHookCallbacks<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { onSuccess, onError, onSettled, ...mutationOptions } = options;

  return useMutation({
    ...mutationOptions,
    onSuccess: async (...args) => {
      await hookCallbacks?.onSuccess?.(...args);
      await onSuccess?.(...args);
    },
    onError: async (...args) => {
      await hookCallbacks?.onError?.(...args);
      await onError?.(...args);
    },
    onSettled: async (...args) => {
      await hookCallbacks?.onSettled?.(...args);
      await onSettled?.(...args);
    },
  });
}
