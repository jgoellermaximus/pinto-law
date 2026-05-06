"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type FilterFn,
  type Row,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  FolderOpen,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Re-export for convenience
export type { ColumnDef } from "@tanstack/react-table";
export { SortHeader } from "@/components/data-table/sort-header";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchFilterFn?: (row: Row<TData>, columnId: string, filterValue: string) => boolean;
  columnFilters?: ColumnFiltersState;
  onRowClick?: (row: TData) => void;
  defaultSorting?: SortingState;
  pageSize?: number;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  headerSlot?: ReactNode;
  hideSearch?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  searchPlaceholder = "Search...",
  searchFilterFn,
  columnFilters,
  onRowClick,
  defaultSorting,
  pageSize = 25,
  emptyIcon,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your search or filters.",
  headerSlot,
  hideSearch = false,
  className,
}: DataTableProps<TData>) {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>(
    defaultSorting ?? [{ id: "createdAt", desc: true }],
  );

  // ── Stable references to prevent infinite re-render ──
  const stableColumnFilters = useMemo(
    () => columnFilters ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(columnFilters)],
  );

  const searchFnRef = useRef(searchFilterFn);
  searchFnRef.current = searchFilterFn;

  const stableGlobalFilterFn = useCallback(
    (row: Row<TData>, columnId: string, filterValue: string) => {
      if (searchFnRef.current) {
        return searchFnRef.current(row, columnId, filterValue);
      }
      return true;
    },
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: search,
      columnFilters: stableColumnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
    globalFilterFn: searchFilterFn ? stableGlobalFilterFn : undefined,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const totalCount = data.length;
  const hasActiveFilters = stableColumnFilters.length > 0 || search.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-4">
        {emptyIcon ?? <FolderOpen className="h-12 w-12 text-gray-300 mb-3" />}
        <p className="text-gray-500 font-medium">{emptyTitle}</p>
        <p className="text-sm text-gray-400 mt-1 text-center max-w-xs">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {(!hideSearch || headerSlot) && (
        <div className="flex items-center gap-3 mb-3">
          {!hideSearch && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1 w-56 focus-within:border-gray-400 transition-colors">
              <Search className="h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 text-xs text-gray-800 placeholder-gray-400 outline-none bg-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {headerSlot}
        </div>
      )}

      {hasActiveFilters && filteredCount !== totalCount && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <span>
            Showing {filteredCount} of {totalCount}
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-gray-50/80">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    onRowClick
                      ? "cursor-pointer hover:bg-gray-50/80 transition-colors"
                      : ""
                  }
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-gray-400"
                >
                  No matching results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-2 mt-3">
          <span className="text-xs text-gray-400">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
