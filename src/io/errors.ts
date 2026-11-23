/** A file or stored data that cannot be read. The message is shown to the user as is. */
export class DataError extends Error {
  override name = 'DataError';
}

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
