import { PaginationMeta } from './response.js';

/** Offset pagination for small owner/admin lists. limit is clamped to 1..100 so every list is bounded. */
export function parsePage(query: Record<string, unknown>, defaultLimit = 20) {
  const page = Math.max(1, parseInt(String(query.page ?? ''), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? ''), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}
