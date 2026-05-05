import { Activity, Database, Info, Loader2, Server, Zap } from "lucide-react";
import { useHealthApi } from "../../api/hooks/system/useSystemApi";

function bytesToMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function SettingsView() {
  const { data: health, isLoadingWithoutCache } = useHealthApi();

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-5">
      {/* Header */}
      <div className="mb-6">
        <p className="eyebrow">Configuration</p>
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-ink leading-none">Settings</h1>
      </div>

      {isLoadingWithoutCache ? (
        <p className="flex items-center gap-2 text-ink-faint text-[0.85rem]">
          <Loader2 size={14} className="spin text-purple" />
          Loading system info…
        </p>
      ) : (
        <div className="grid gap-4 max-w-2xl">
          {/* Executor */}
          <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-purple" />
              <div>
                <p className="eyebrow !mb-0">Runtime</p>
                <h2 className="text-[1rem] font-bold text-ink m-0">Executor</h2>
              </div>
              {health && (
                <span
                  className={`ml-auto status-badge ${
                    health.executorMode === "openai"
                      ? "status-badge-running"
                      : "status-badge"
                  }`}
                >
                  {health.executorMode}
                </span>
              )}
            </div>
            {health ? (
              <div className="grid gap-2">
                {[
                  { label: "Mode",    value: health.executorMode },
                  { label: "Model",   value: health.executorModel },
                  { label: "Profile", value: health.modelProfile },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border border-[var(--border-card)] rounded-lg px-3 py-2 bg-white/[0.02]"
                  >
                    <span className="text-[0.8rem] text-ink-muted">{label}</span>
                    <span className="text-[0.82rem] font-semibold text-ink">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.8rem] text-ink-faint">No executor data available.</p>
            )}
            {health?.executorMode === "openai" && (
              <p className="mt-3 text-[0.78rem] text-orange border border-orange/25 rounded-lg px-3 py-2 bg-orange/[0.06]">
                OpenAI execution is active. Review goals and scope before running agents.
              </p>
            )}
          </section>

          {/* Storage */}
          <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Database size={16} className="text-purple" />
              <div>
                <p className="eyebrow !mb-0">Persistence</p>
                <h2 className="text-[1rem] font-bold text-ink m-0">Storage</h2>
              </div>
              {health && (
                <span
                  className={`ml-auto status-badge ${
                    health.mongo.connected ? "status-badge-completed" : "status-badge-blocked"
                  }`}
                >
                  {health.mongo.connected ? "connected" : "disconnected"}
                </span>
              )}
            </div>
            {health ? (
              <div className="grid gap-2">
                {[
                  { label: "Storage mode",  value: health.storageMode },
                  { label: "MongoDB state", value: health.mongo.state },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border border-[var(--border-card)] rounded-lg px-3 py-2 bg-white/[0.02]"
                  >
                    <span className="text-[0.8rem] text-ink-muted">{label}</span>
                    <span className="text-[0.82rem] font-semibold text-ink">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.8rem] text-ink-faint">No storage data available.</p>
            )}
          </section>

          {/* System metrics */}
          <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Server size={16} className="text-purple" />
              <div>
                <p className="eyebrow !mb-0">System</p>
                <h2 className="text-[1rem] font-bold text-ink m-0">Metrics</h2>
              </div>
            </div>
            {health ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Agents total",  value: String(health.metrics.agentsTotal) },
                  { label: "Waiting agents",value: String(health.metrics.waitingAgents) },
                  { label: "Active runs",   value: String(health.metrics.activeRuns) },
                  { label: "RSS memory",    value: `${bytesToMB(health.memory.rssBytes)} MB` },
                  { label: "Heap used",     value: `${bytesToMB(health.memory.heapUsedBytes)} MB` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border border-[var(--border-card)] rounded-lg px-3 py-2 bg-white/[0.02]"
                  >
                    <span className="text-[0.78rem] text-ink-muted">{label}</span>
                    <span className="text-[0.82rem] font-semibold text-ink tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.8rem] text-ink-faint">No metrics available.</p>
            )}
          </section>

          {/* Activity indicator */}
          {health && (
            <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={16} className="text-purple" />
                <div>
                  <p className="eyebrow !mb-0">Status</p>
                  <h2 className="text-[1rem] font-bold text-ink m-0">API Health</h2>
                </div>
                <span className="ml-auto status-badge status-badge-completed">{health.status}</span>
              </div>
              <p className="text-[0.8rem] text-ink-muted">
                Service: <span className="text-ink font-medium">{health.service}</span>
              </p>
            </section>
          )}

          {/* About */}
          <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Info size={16} className="text-purple" />
              <div>
                <p className="eyebrow !mb-0">App</p>
                <h2 className="text-[1rem] font-bold text-ink m-0">About</h2>
              </div>
            </div>
            <div className="grid gap-2">
              {[
                { label: "Name",    value: "Atellier Studio" },
                { label: "Version", value: "1.0.0" },
                { label: "Type",    value: "Local-first AI orchestrator" },
                { label: "Branch",  value: "dev/1.0.0" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between border border-[var(--border-card)] rounded-lg px-3 py-2 bg-white/[0.02]"
                >
                  <span className="text-[0.8rem] text-ink-muted">{label}</span>
                  <span className="text-[0.82rem] font-semibold text-ink">{value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
