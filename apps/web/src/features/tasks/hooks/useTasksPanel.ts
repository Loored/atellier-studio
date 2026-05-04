import { type FormEvent, useState } from "react";
import type { TaskPriority } from "@atellier/shared";
import { useCreateTaskApi, useTasksApi, useUpdateTaskApi } from "../../../api/hooks/tasks/useTasksApi";

export function useTasksPanel() {
  const {
    data: taskList = [],
    isFetching: isFetchingTasks,
    isLoadingWithoutCache: isLoadingTasksWithoutCache,
  } = useTasksApi();
  const createTask = useCreateTaskApi();
  const updateTask = useUpdateTaskApi();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");

  function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = taskTitle.trim();
    if (!title) {
      return;
    }

    createTask.mutate(
      {
        title,
        priority: taskPriority,
        status: "inbox",
      },
      {
        onSuccess: () => setTaskTitle(""),
      },
    );
  }

  return {
    taskList,
    taskTitle,
    taskPriority,
    isFetchingTasks,
    isLoadingTasksWithoutCache,
    isCreatingTask: createTask.isPending,
    isUpdatingTask: updateTask.isPending,
    setTaskTitle,
    setTaskPriority,
    handleCreateTask,
    markTaskActive: (taskId: string) =>
      updateTask.mutate({
        taskId,
        input: { status: "active" },
      }),
    markTaskDone: (taskId: string) =>
      updateTask.mutate({
        taskId,
        input: { status: "done" },
      }),
  };
}
