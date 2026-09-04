import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";

export type CodexWorkerExecutionInput = {
  runId: string;
  stepId: string;
  goal: string;
  profile: "cheap" | "standard" | "deep";
  command: string;
  workingDirectory: string;
  signal?: AbortSignal;
};

export type CodexWorkerExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  cancelled?: boolean;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
};

export interface CodexWorkerExecutor {
  readonly mode: "fake" | "real";
  readonly label: string;
  execute(input: CodexWorkerExecutionInput): Promise<CodexWorkerExecutionResult>;
}

export type CodexWorkerCommandEnvelope = {
  executable: string;
  argv: readonly string[];
  action?: "static" | "codex-exec";
};

export type CodexProcessRunnerInput = {
  executable: string;
  argv: readonly string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
  signal?: AbortSignal;
};

export interface CodexProcessRunner {
  run(input: CodexProcessRunnerInput): Promise<CodexWorkerExecutionResult>;
}

export const DEFAULT_CODEX_WORKER_COMMANDS: Readonly<Record<string, CodexWorkerCommandEnvelope>> = {
  "rg --files": { executable: "rg", argv: ["--files"] },
  "codex exec": { executable: "codex", argv: ["exec"], action: "codex-exec" },
  "git diff --no-ext-diff": { executable: "git", argv: ["diff", "--no-ext-diff"] },
  "pnpm typecheck": { executable: "pnpm", argv: ["typecheck"] },
};

const DANGEROUS_ARGUMENTS = new Set([
  "--delete",
  "--add-dir",
  "--config",
  "--dangerously-bypass-approvals-and-sandbox",
  "--dangerously-bypass-hook-trust",
  "--enable",
  "--force",
  "--hard",
  "--ignore-rules",
  "--no-preserve-root",
  "--overwrite",
  "--recursive",
  "--skip-git-repo-check",
  "-c",
  "-f",
  "-fr",
  "-rf",
]);

export class CodexWorkerSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexWorkerSafetyError";
  }
}

export class FakeCodexWorkerExecutor implements CodexWorkerExecutor {
  readonly mode = "fake" as const;
  readonly label = "fake-safe";

  async execute(input: CodexWorkerExecutionInput): Promise<CodexWorkerExecutionResult> {
    if (input.signal?.aborted) {
      return {
        stdout: "",
        stderr: "Codex worker execution cancelled before process start.",
        exitCode: null,
        durationMs: 0,
        timedOut: false,
        cancelled: true,
      };
    }
    const startedAt = Date.now();
    return {
      stdout: `Fake executor completed step: ${input.command}\nCommand: ${input.command}\n`,
      stderr: "",
      exitCode: 0,
      durationMs: Math.max(0, Date.now() - startedAt),
      timedOut: false,
    };
  }
}

export type RealCodexWorkerExecutorOptions = {
  repositoryRoot: string;
  allowedWorkingDirectories?: readonly string[];
  allowedCommands?: Readonly<Record<string, CodexWorkerCommandEnvelope>>;
  timeoutMs?: number;
  maxOutputBytes?: number;
  processRunner?: CodexProcessRunner;
};

/**
 * Executes only pre-declared argv envelopes. Persisted command strings are
 * lookup keys and are never passed to a shell or parsed into arguments.
 */
export class RealCodexWorkerExecutor implements CodexWorkerExecutor {
  readonly mode = "real" as const;
  readonly label = "real-allowlisted";
  private readonly allowedWorkingDirectories: readonly string[];
  private readonly allowedCommands: Readonly<Record<string, CodexWorkerCommandEnvelope>>;
  private readonly timeoutMs: number;
  private readonly maxOutputBytes: number;
  private readonly processRunner: CodexProcessRunner;

  constructor(private readonly options: RealCodexWorkerExecutorOptions) {
    this.allowedWorkingDirectories = options.allowedWorkingDirectories ?? ["."];
    this.allowedCommands = options.allowedCommands ?? DEFAULT_CODEX_WORKER_COMMANDS;
    this.timeoutMs = positiveInteger(options.timeoutMs, 120_000);
    this.maxOutputBytes = positiveInteger(options.maxOutputBytes, 1024 * 1024);
    this.processRunner = options.processRunner ?? new NodeCodexProcessRunner();
  }

  async execute(input: CodexWorkerExecutionInput): Promise<CodexWorkerExecutionResult> {
    if (input.signal?.aborted) {
      return {
        stdout: "",
        stderr: "Codex worker execution cancelled before process start.",
        exitCode: null,
        durationMs: 0,
        timedOut: false,
        cancelled: true,
      };
    }
    const envelope = this.allowedCommands[input.command];
    if (!envelope) {
      throw new CodexWorkerSafetyError(`Command is not allowlisted: ${input.command}`);
    }
    this.assertSafeEnvelope(envelope);
    const cwd = await this.resolveWorkingDirectory(input.workingDirectory);
    const argv = envelope.action === "codex-exec"
      ? [
          ...envelope.argv,
          "--cd",
          cwd,
          "--sandbox",
          "workspace-write",
          "--approve-for-me",
          "--ephemeral",
          buildCodexPrompt(input),
        ]
      : [...envelope.argv];
    this.assertSafeEnvelope({ executable: envelope.executable, argv });
    return this.processRunner.run({
      executable: envelope.executable,
      argv,
      cwd,
      timeoutMs: this.timeoutMs,
      maxOutputBytes: this.maxOutputBytes,
      signal: input.signal,
    });
  }

  private assertSafeEnvelope(envelope: CodexWorkerCommandEnvelope): void {
    if (!envelope.executable || /[\0\r\n]/u.test(envelope.executable)) {
      throw new CodexWorkerSafetyError("Executable is invalid.");
    }
    for (const argument of envelope.argv) {
      if (/[\0\r\n]/u.test(argument)) {
        throw new CodexWorkerSafetyError("Command arguments cannot contain control characters.");
      }
      if (DANGEROUS_ARGUMENTS.has(argument.toLowerCase())) {
        throw new CodexWorkerSafetyError(`Dangerous command argument is forbidden: ${argument}`);
      }
    }
  }

  private async resolveWorkingDirectory(requestedDirectory: string): Promise<string> {
    if (!requestedDirectory || path.isAbsolute(requestedDirectory) || /[\0\r\n]/u.test(requestedDirectory)) {
      throw new CodexWorkerSafetyError("Working directory must be a relative repository path.");
    }

    const repositoryRoot = await realpath(path.resolve(this.options.repositoryRoot));
    const requestedAbsolute = await this.resolveExistingDirectory(repositoryRoot, requestedDirectory);
    if (!isPathInside(repositoryRoot, requestedAbsolute)) {
      throw new CodexWorkerSafetyError("Working directory escapes the configured repository root.");
    }

    const allowedRoots = await Promise.all(
      this.allowedWorkingDirectories.map(async (allowedDirectory) => {
        if (!allowedDirectory || path.isAbsolute(allowedDirectory) || /[\0\r\n]/u.test(allowedDirectory)) {
          throw new CodexWorkerSafetyError("Allowed working directories must be relative repository paths.");
        }
        const allowedRoot = await this.resolveExistingDirectory(repositoryRoot, allowedDirectory);
        if (!isPathInside(repositoryRoot, allowedRoot)) {
          throw new CodexWorkerSafetyError("Allowed working directory escapes the configured repository root.");
        }
        return allowedRoot;
      }),
    );
    if (!allowedRoots.some((allowedRoot) => isPathInside(allowedRoot, requestedAbsolute))) {
      throw new CodexWorkerSafetyError("Working directory is outside the configured allowed subpaths.");
    }
    return requestedAbsolute;
  }

  private async resolveExistingDirectory(repositoryRoot: string, relativeDirectory: string): Promise<string> {
    const lexicalPath = path.resolve(repositoryRoot, relativeDirectory);
    if (!isPathInside(repositoryRoot, lexicalPath)) {
      throw new CodexWorkerSafetyError("Working directory escapes the configured repository root.");
    }
    try {
      return await realpath(lexicalPath);
    } catch {
      throw new CodexWorkerSafetyError(`Working directory does not exist: ${relativeDirectory}`);
    }
  }
}

function buildCodexPrompt(input: CodexWorkerExecutionInput): string {
  const profileInstruction = input.profile === "deep"
    ? "Use deep reasoning and verify architectural implications."
    : input.profile === "cheap"
      ? "Keep the implementation minimal and focused."
      : "Use balanced implementation depth and focused verification.";
  return [
    input.goal.replace(/[\0\r\n]+/gu, " ").replace(/\s+/gu, " ").trim(),
    profileInstruction,
    "Work only inside the configured repository. Preserve the existing approval and evidence flow.",
  ].join(" ");
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

export class NodeCodexProcessRunner implements CodexProcessRunner {
  async run(input: CodexProcessRunnerInput): Promise<CodexWorkerExecutionResult> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const child = spawn(input.executable, [...input.argv], {
        cwd: input.cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const stdout = new BoundedOutput(input.maxOutputBytes);
      const stderr = new BoundedOutput(input.maxOutputBytes);
      let timedOut = false;
      let cancelled = false;
      let settled = false;
      let forceKillTimer: NodeJS.Timeout | undefined;

      const terminate = (): void => {
        child.kill("SIGTERM");
        forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 1_000);
        forceKillTimer.unref();
      };

      const cancelFromSignal = (): void => {
        if (settled || timedOut || cancelled) return;
        cancelled = true;
        clearTimeout(timeout);
        terminate();
      };

      child.stdout.on("data", (chunk: Buffer | string) => stdout.append(chunk));
      child.stderr.on("data", (chunk: Buffer | string) => stderr.append(chunk));

      const timeout = setTimeout(() => {
        timedOut = true;
        terminate();
      }, input.timeoutMs);
      timeout.unref();
      if (input.signal?.aborted) {
        cancelFromSignal();
      } else {
        input.signal?.addEventListener("abort", cancelFromSignal, { once: true });
      }

      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (forceKillTimer) clearTimeout(forceKillTimer);
        input.signal?.removeEventListener("abort", cancelFromSignal);
        reject(error);
      });
      child.once("close", (exitCode) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (forceKillTimer) clearTimeout(forceKillTimer);
        input.signal?.removeEventListener("abort", cancelFromSignal);
        resolve({
          stdout: stdout.value(),
          stderr: stderr.value(),
          exitCode,
          durationMs: Math.max(0, Date.now() - startedAt),
          timedOut,
          cancelled: cancelled || undefined,
          stdoutTruncated: stdout.truncated || undefined,
          stderrTruncated: stderr.truncated || undefined,
        });
      });
    });
  }
}

class BoundedOutput {
  private readonly chunks: Buffer[] = [];
  private capturedBytes = 0;
  truncated = false;

  constructor(private readonly maxBytes: number) {}

  append(value: Buffer | string): void {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const remaining = this.maxBytes - this.capturedBytes;
    if (remaining <= 0) {
      this.truncated = true;
      return;
    }
    if (buffer.byteLength > remaining) {
      this.chunks.push(buffer.subarray(0, remaining));
      this.capturedBytes += remaining;
      this.truncated = true;
      return;
    }
    this.chunks.push(buffer);
    this.capturedBytes += buffer.byteLength;
  }

  value(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
