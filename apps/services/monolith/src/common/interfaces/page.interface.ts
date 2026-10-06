export interface PageQuery {
  page: number;
  size: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export function toSkipTake(query: PageQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.size, take: query.size };
}
