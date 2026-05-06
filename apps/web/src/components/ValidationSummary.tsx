type ValidationIssue = {
  code?: string;
  message?: string;
  severity?: string;
};

type ValidationSummaryValue = {
  role?: string;
  passed?: boolean;
  issues?: ValidationIssue[];
  verifiedRepoFiles?: string[];
  invalidReferencedFiles?: string[];
  referencedFiles?: string[];
  candidateFiles?: string[];
  changedFiles?: string[];
};

type Props = {
  validation: ValidationSummaryValue;
  className?: string;
};

export function ValidationSummary({ validation, className = "" }: Props) {
  const issueCount = validation.issues?.length ?? 0;
  const invalidCount = validation.invalidReferencedFiles?.length ?? 0;
  const candidateCount = validation.candidateFiles?.length ?? 0;
  const changedCount = validation.changedFiles?.length ?? 0;
  const hasError = invalidCount > 0 || validation.issues?.some((issue) => issue.severity === "error");
  const hasWarning = issueCount > 0;
  const isClean = Boolean(validation.passed) && invalidCount === 0 && issueCount === 0;
  const statusLabel = isClean ? "passed" : hasError ? "needs review" : "warnings";
  const toneClass = isClean
    ? "border-green/30 bg-green/10 text-green"
    : hasError
      ? "border-orange/35 bg-orange/10 text-orange"
      : "border-gold/30 bg-gold/10 text-gold";

  return (
    <div className={`rounded-md border px-3 py-2 text-[0.72rem] ${toneClass} ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-[0.08em]">Validation</span>
        <span className="text-[0.68rem] text-ink-muted">
          {statusLabel}
        </span>
      </div>
      <div className="mt-1 text-ink-muted">
        <span className="text-ink">{validation.role ?? "unknown"}</span>
        {validation.changedFiles?.length !== undefined ? (
          <>
            <span className="mx-1.5">·</span>
            <span>{changedCount} changed file(s)</span>
          </>
        ) : null}
        {validation.candidateFiles?.length !== undefined ? (
          <>
            <span className="mx-1.5">·</span>
            <span>{candidateCount} candidate file(s)</span>
          </>
        ) : null}
        {validation.invalidReferencedFiles?.length !== undefined ? (
          <>
            <span className="mx-1.5">·</span>
            <span>{invalidCount} invalid reference(s)</span>
          </>
        ) : null}
        {issueCount > 0 ? (
          <>
            <span className="mx-1.5">·</span>
            <span>{issueCount} issue(s)</span>
          </>
        ) : null}
      </div>
      {issueCount > 0 ? (
        <ul className="mt-2 mb-0 pl-4 text-ink-muted">
          {validation.issues?.slice(0, 3).map((issue) => (
            <li key={issue.code ?? issue.message} className={issue.severity === "error" ? "text-orange" : "text-ink-muted"}>
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      {validation.invalidReferencedFiles?.length ? (
        <p className="mt-2 mb-0 text-ink-muted">
          Invalid refs: <span className="text-ink">{validation.invalidReferencedFiles.join(", ")}</span>
        </p>
      ) : null}
      {validation.candidateFiles?.length ? (
        <p className="mt-2 mb-0 text-ink-muted">
          Candidates: <span className="text-ink">{validation.candidateFiles.join(", ")}</span>
        </p>
      ) : null}
    </div>
  );
}
