export type DomainIssueSeverity = "error" | "warning";

export type DomainIssue = {
  code: string;
  message: string;
  severity: DomainIssueSeverity;
  path?: string;
};

export type DomainResult<T> = {
  ok: boolean;
  value?: T;
  issues: DomainIssue[];
};

export function ok<T>(value: T, issues: DomainIssue[] = []): DomainResult<T> {
  return { ok: !issues.some((issue) => issue.severity === "error"), value, issues };
}

export function issue(code: string, message: string, path?: string, severity: DomainIssueSeverity = "error"): DomainIssue {
  return { code, message, path, severity };
}
