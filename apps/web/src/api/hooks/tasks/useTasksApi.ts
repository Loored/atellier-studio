import { useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type { CreateTaskInput, Task, UpdateTaskInput } from "@atellier/shared";
import { useApiAlerts } from "../../alerts/useApiAlerts";
import { queryKeys } from "../../query/queryKeys";
import { useMutationInstance } from "../../query/useMutationInstance";
import { useQueryInstance } from "../../query/useQueryInstance";
import { tasksService } from "../../services/tasks.service";

export function useTasksApi() {
  return useQueryInstance<Task[]>({
    queryKey: queryKeys.tasks.all,
    queryFn: tasksService.list,
  });
}

export type UseCreateTaskApiOptions = UseMutationOptions<Task, Error, CreateTaskInput>;

export function useCreateTaskApi(options: UseCreateTaskApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<Task, Error, CreateTaskInput>(
    {
      mutationFn: (input) => tasksService.create(input),
      ...options,
    },
    {
      onSuccess: async () => {
        notifySuccess("Task created");
        await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type UpdateTaskVariables = {
  taskId: string;
  input: UpdateTaskInput;
};

export type UseUpdateTaskApiOptions = UseMutationOptions<Task, Error, UpdateTaskVariables>;

export function useUpdateTaskApi(options: UseUpdateTaskApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError } = useApiAlerts();

  return useMutationInstance<Task, Error, UpdateTaskVariables>(
    {
      mutationFn: ({ taskId, input }) => tasksService.update(taskId, input),
      ...options,
    },
    {
      onSuccess: async (task) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(task.id) }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}
