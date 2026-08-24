import type { OpArgs, OpErrorCode, OpName, OpResult } from "@shared/contract";

/**
 * A failure that came back from the main process.
 *
 * Main returns failures as tagged data rather than throwing, because a thrown
 * Error loses its class when structured-cloned across IPC. This is where that
 * data becomes an exception again, so every caller in `data/` can use ordinary
 * try/catch exactly as the Supabase modules it replaces did.
 */
export class OpFailure extends Error {
  // A plain field rather than a parameter property: `erasableSyntaxOnly` is on,
  // and parameter properties emit runtime code that a type-stripping build
  // cannot produce.
  readonly code: OpErrorCode;

  constructor(code: OpErrorCode, message: string) {
    super(message);
    this.name = "OpFailure";
    this.code = code;
  }
}

/** True when `err` is an OpFailure carrying the given code. */
export function hasCode(err: unknown, code: OpErrorCode): boolean {
  return err instanceof OpFailure && err.code === code;
}

/**
 * Calls one allowlisted database operation in the main process.
 *
 * The whole desktop data layer goes through here: the renderer names an
 * operation from the shared contract and never sees SQL, a connection, or the
 * native SQLite module.
 */
export async function invoke<K extends OpName>(
  op: K,
  ...[args]: OpArgs<K> extends void ? [] : [OpArgs<K>]
): Promise<OpResult<K>> {
  const response = await window.sagip.invoke(op, args as OpArgs<K>);
  if (!response.ok) throw new OpFailure(response.code, response.message);
  return response.value;
}
