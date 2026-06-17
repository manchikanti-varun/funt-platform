/**
 * Shared pagination utility.
 *
 * Eliminates the repeated skip/limit/countDocuments boilerplate across services.
 */

import type { Model, FilterQuery, SortOrder } from "mongoose";

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  docs: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Paginated find with consistent skip/limit/total pattern.
 *
 * @param model    Mongoose model to query
 * @param query    Filter query
 * @param opts     Pagination options + sort + select + maxLimit
 */
export async function paginatedFind<T>(
  model: Model<T>,
  query: FilterQuery<T>,
  opts: {
    page?: number;
    limit?: number;
    maxLimit?: number;
    sort?: Record<string, SortOrder>;
    select?: string;
  } = {}
): Promise<PaginationResult<T>> {
  const maxLimit = opts.maxLimit ?? 100;
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(opts.limit) || 20)));
  const page = Math.max(1, Math.floor(Number(opts.page) || 1));
  const skip = (page - 1) * limit;

  const findQuery = model.find(query);
  if (opts.sort) findQuery.sort(opts.sort);
  if (opts.select) findQuery.select(opts.select);

  const [docs, total] = await Promise.all([
    findQuery.skip(skip).limit(limit).lean().exec() as Promise<T[]>,
    model.countDocuments(query).exec(),
  ]);

  return {
    docs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Normalize pagination input — validates and caps the values.
 * Use when you need the skip/limit values without running the query.
 */
export function normalizePagination(input: PaginationInput, maxLimit = 100) {
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(input.limit) || 20)));
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
