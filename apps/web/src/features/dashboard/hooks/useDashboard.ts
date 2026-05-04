import { useAgentsApi } from "../../../api/hooks/agents/useAgentsApi";
import { useRunsApi } from "../../../api/hooks/runs/useRunsApi";
import { useTasksApi } from "../../../api/hooks/tasks/useTasksApi";
import { useWikiLogApi } from "../../../api/hooks/wiki/useWikiApi";

export function useDashboard() {
  const { data: agentList = [], isFetching: isFetchingAgents } = useAgentsApi();
  const { data: taskList = [], isFetching: isFetchingTasks } = useTasksApi();
  const { data: runList = [], isFetching: isFetchingRuns } = useRunsApi();
  const { data: wikiLog, isFetching: isFetchingWikiLog } = useWikiLogApi();

  return {
    agentCount: agentList.length,
    activeTaskCount: taskList.filter((task) => task.status === "active").length,
    recentRunCount: runList.length,
    wikiLogReady: Boolean(wikiLog?.ready),
    isRefreshingDashboard: isFetchingAgents || isFetchingTasks || isFetchingRuns || isFetchingWikiLog,
  };
}
