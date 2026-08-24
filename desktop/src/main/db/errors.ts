import type { OpErrorCode } from "@shared/contract";

/**
 * An error whose identity has to survive the IPC boundary. Structured cloning
 * strips the class, so the code travels as data and the renderer re-throws the
 * matching class.
 */
export class OpError extends Error {
  // A plain field rather than a parameter property: `erasableSyntaxOnly` is on,
  // and parameter properties emit runtime code that a type-stripping build
  // cannot produce.
  readonly code: OpErrorCode;

  constructor(code: OpErrorCode, message: string) {
    super(message);
    this.name = "OpError";
    this.code = code;
  }
}

/** True for a violation of the partial unique index idx_songs_church_template. */
export function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "SQLITE_CONSTRAINT_UNIQUE" || code === "SQLITE_CONSTRAINT_PRIMARYKEY";
}
