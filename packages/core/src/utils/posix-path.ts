// Normalizes a project-relative path to "/" separators before it is persisted
// into manifests, returned in pipeline results, or used as a URL — on Windows,
// node:path join()/relative() produce "\" which those consumers must not see.
export function toPosixPath(value: string): string {
  return value.replace(/\\/gu, "/");
}
