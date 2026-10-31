import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from '@/lib/errors';

export interface ListParams {
  page: number;
  pageSize: number;
  sort: string;
  dir: 'asc' | 'desc';
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function str(params: SearchParams, key: string): string | undefined {
  const v = first(params[key]);
  return v && v.trim() !== '' ? v.trim() : undefined;
}

export function intParam(params: SearchParams, key: string): number | undefined {
  const v = str(params, key);
  if (v === undefined) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse pagination + sorting from page searchParams with safe bounds. */
export function parseListParams(
  params: SearchParams,
  opts: { defaultSort?: string; defaultDir?: 'asc' | 'desc' } = {},
): ListParams {
  const page = Math.max(1, intParam(params, 'page') ?? 1);
  const requested = intParam(params, 'pageSize') ?? DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  const sort = str(params, 'sort') ?? opts.defaultSort ?? 'createdAt';
  const rawDir = str(params, 'dir') ?? opts.defaultDir ?? 'desc';
  const dir: 'asc' | 'desc' = rawDir === 'asc' ? 'asc' : 'desc';
  return { page, pageSize, sort, dir };
}

export function pageMeta(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasNext: page * pageSize < total,
    hasPrev: page > 1,
  };
}

/** Convert service/action errors into a JSON-safe error response for route handlers. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', issues: error.issues },
      { status: 400 },
    );
  }
  if (error instanceof AppError) {
    const status =
      error.code === 'forbidden' ? 403 : error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
