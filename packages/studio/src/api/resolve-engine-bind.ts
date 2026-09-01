import { resolve } from "node:path";

export class EngineBindError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineBindError";
  }
}

export function resolveEngineProjectRoot(
  argv2: string | undefined,
  envRoot: string | undefined,
): string {
  const explicit = (argv2 ?? envRoot ?? "").trim();
  if (!explicit) {
    throw new EngineBindError(
      "INKOS_PROJECT_ROOT or argv[2] is required. The engine will not fall back to process.cwd().",
    );
  }
  return resolve(explicit);
}

export function resolveEnginePort(envPort: string | undefined): number {
  const raw = (envPort ?? "").trim();
  if (!raw) {
    throw new EngineBindError("INKOS_STUDIO_PORT is required. Refusing the historical 4567 default.");
  }
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    throw new EngineBindError(`Invalid INKOS_STUDIO_PORT: ${raw}`);
  }
  return port;
}
