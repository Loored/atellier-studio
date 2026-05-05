import { Check, CircleDot, Loader2, Plus } from "lucide-react";
import { TASK_TITLE_MAX_LENGTH } from "@atellier/shared";
import { useTasksPanel } from "../hooks/useTasksPanel";

export function TasksPanel() {
  const {
    taskList,
    taskTitle,
    taskPriority,
    isCreatingTask,
    isLoadingTasksWithoutCache,
    isUpdatingTask,
    setTaskTitle,
    setTaskPriority,
    handleCreateTask,
    markTaskActive,
    markTaskDone,
  } = useTasksPanel();

  return (
    <section className="col-span-12 min-w-0 border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-3.5">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-purple mb-1">Queue</p>
          <h2 className="text-[1.1rem] font-bold text-ink tracking-tight m-0">Tasks</h2>
        </div>
        <span className="inline-flex items-center min-h-6 border border-[var(--border-card)] rounded-full px-2.5 text-ink-muted bg-white/[0.03] text-[0.72rem] font-bold whitespace-nowrap">
          {taskList.length} total
        </span>
      </div>

      {/* Create form */}
      <form
        className="grid grid-cols-[minmax(180px,1fr)_120px_auto] gap-2 mb-3.5"
        onSubmit={handleCreateTask}
      >
        <input
          aria-label="Task title"
          maxLength={TASK_TITLE_MAX_LENGTH}
          value={taskTitle}
          onChange={(event) => setTaskTitle(event.target.value)}
          placeholder="Task title"
        />
        <select
          aria-label="Task priority"
          value={taskPriority}
          onChange={(event) => setTaskPriority(event.target.value as typeof taskPriority)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button type="submit" disabled={isCreatingTask || taskTitle.trim().length === 0} title="Create task">
          <Plus size={18} />
          <span>Create</span>
        </button>
      </form>

      {isLoadingTasksWithoutCache ? (
        <p className="m-0 flex items-center gap-2 border border-[var(--border-card)] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          <Loader2 size={14} className="spin text-purple flex-shrink-0" />
          Loading tasks
        </p>
      ) : null}
      {!isLoadingTasksWithoutCache && taskList.length === 0 ? (
        <p className="m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          No tasks yet
        </p>
      ) : null}

      <ul className="grid gap-2 list-none m-0 p-0">
        {taskList.map((task) => (
          <li
            key={task.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 min-h-14 border border-[var(--border-card)] rounded-lg px-3 py-2.5 bg-white/[0.02] transition-[border-color,background] hover:bg-[var(--bg-card-hover)] hover:border-purple/[0.22]"
          >
            <CircleDot size={18} className="text-ink-faint" />
            <div>
              <strong className="block text-[0.88rem] font-semibold text-ink overflow-wrap-anywhere mb-0.5">
                {task.title}
              </strong>
              <span className="flex items-center flex-wrap gap-1.5 text-ink-muted text-[0.78rem]">
                <span>{task.priority} priority</span>
                <small className={`status-badge status-badge-${task.status}`}>{task.status}</small>
              </span>
            </div>
            <div className="inline-flex gap-1.5">
              <button
                className="icon-only-button"
                type="button"
                onClick={() => markTaskActive(task.id)}
                disabled={isUpdatingTask || task.status === "active"}
                title="Mark active"
                aria-label={`Mark ${task.title} active`}
              >
                <CircleDot size={16} />
              </button>
              <button
                className="icon-only-button"
                type="button"
                onClick={() => markTaskDone(task.id)}
                disabled={isUpdatingTask || task.status === "done"}
                title="Mark done"
                aria-label={`Mark ${task.title} done`}
              >
                <Check size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
