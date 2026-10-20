// Minimal typed declaration for papaparse (the library ships no types and
// @types/papaparse is not installed). Covers only what this project uses.
// Verified against papaparse 5.7 at runtime before writing.

declare module 'papaparse' {
  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row: number;
  }

  export interface ParseMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    fields?: string[];
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface ParseConfig {
    header?: boolean;
    skipEmptyLines?: boolean | 'greedy';
    encoding?: string;
  }

  export interface UnparseConfig {
    quotes?: boolean | boolean[];
    quoteChar?: string;
    escapeChar?: string;
    delimiter?: string;
    header?: boolean;
    newline?: string;
    skipEmptyLines?: boolean | 'greedy';
    columns?: string[] | null;
  }

  export interface UnparseObject {
    fields?: string[];
    data: Array<Record<string, string>>;
  }

  export function parse<T = Record<string, string>>(
    input: string,
    config?: ParseConfig,
  ): ParseResult<T>;

  export function unparse(rows: Array<Record<string, string>>, config?: UnparseConfig): string;
  export function unparse(obj: UnparseObject, config?: UnparseConfig): string;
  export function unparse(
    fields: string[],
    data: Array<Record<string, string>>,
    config?: UnparseConfig,
  ): string;

  /** The UTF-8 byte-order mark — papaparse strips it from headers when parsing. */
  export const BYTE_ORDER_MARK: string;
}
