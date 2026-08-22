import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationFooterProps {
  page: number;
  pageCount: number;
  pageSize: number;
  /** Size of the filtered result set, not of the current page. */
  total: number;
  onPageChange: (updater: (prev: number) => number) => void;
  /** Singular noun for the count line, e.g. "song". Pluralised with "s". */
  noun?: string;
}

/**
 * "Showing 1–15 of 419 songs" plus prev/next. The prev/next block hides itself
 * when everything fits on one page, but the count line stays: it is the answer
 * to "did my filter do anything?".
 */
export function PaginationFooter({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  noun = "song",
}: PaginationFooterProps) {
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}{" "}
        {noun}
        {total === 1 ? "" : "s"}
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => onPageChange((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="px-1 text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === pageCount}
            onClick={() => onPageChange((p) => Math.min(pageCount, p + 1))}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
