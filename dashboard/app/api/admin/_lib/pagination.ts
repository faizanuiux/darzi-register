import "server-only";

import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export function pageMeta(
  total: number,
  page: number,
  per_page: number,
): PageMeta {
  return {
    page,
    per_page,
    total,
    total_pages: Math.max(1, Math.ceil(total / per_page)),
  };
}

/** Strip characters that break PostgREST `.or()` / `.in()` filter syntax. */
export function escapePostgrest(value: string): string {
  return value.replace(/["(),\\]/g, "");
}

/** Strip PostgREST LIKE-syntax breakers from free-text search (keeps % _ as wildcards). */
export function sanitizeLike(value: string): string {
  return value.replace(/[(),]/g, "");
}
