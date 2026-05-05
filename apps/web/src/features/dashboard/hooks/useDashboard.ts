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
    blockedAgentCount: agentList.filter((agent) => agent.status === "blocked").length,
    needsHumanAgentCount: agentList.filter((agent) => agent.status === "needs-human").length,
    activeTaskCount: taskList.filter((task) => task.status === "active").length,
    recentRunCount: runList.length,
    pendingReviewRunCount: runList.filter((run) => run.reviewStatus === "pending").length,
    wikiLogReady: Boolean(wikiLog?.ready),
    isRefreshingDashboard: isFetchingAgents || isFetchingTasks || isFetchingRuns || isFetchingWikiLog,
  };
}
