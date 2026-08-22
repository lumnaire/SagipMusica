import { useEffect, useState } from "react";

interface Pagination<T> {
  /** The slice of `items` belonging to the current page. */
  visible: T[];
  /** Clamped to `pageCount`, so a shrinking result set can't strand the reader. */
  page: number;
  pageCount: number;
  setPage: (updater: number | ((prev: number) => number)) => void;
}

/**
 * Client-side pagination over an already-filtered list.
 *
 * `resetKey` should describe the current filter state (e.g.
 * `` `${search}|${category}` ``). Any change to it returns the reader to page
 * one — without that, narrowing a search leaves them on a page that no longer
 * exists. Resetting on `items.length` instead would look equivalent and be
 * wrong: two different filters can produce the same number of results.
 */
export function usePagination<T>(
  items: T[],
  pageSize: number,
  resetKey: string,
): Pagination<T> {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return { visible, page: currentPage, pageCount, setPage };
}
