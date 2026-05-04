import { Check, CircleDot, Plus } from "lucide-react";
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
    <section className="panel panel-wide">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Queue</p>
          <h2>Tasks</h2>
        </div>
        <span className="panel-chip">{taskList.length} total</span>
      </div>

      <form className="task-form" onSubmit={handleCreateTask}>
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

      {isLoadingTasksWithoutCache ? <p className="empty-state">Loading tasks</p> : null}
      {!isLoadingTasksWithoutCache && taskList.length === 0 ? <p className="empty-state">No tasks yet</p> : null}

      <ul className="item-list">
        {taskList.map((task) => (
          <li className="item-card task-item" key={task.id}>
            <CircleDot size={18} />
            <div>
              <strong>{task.title}</strong>
              <span className="item-meta">
                <span>{task.priority} priority</span>
                <small className={`status-badge status-badge-${task.status}`}>{task.status}</small>
              </span>
            </div>
            <div className="button-cluster">
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
