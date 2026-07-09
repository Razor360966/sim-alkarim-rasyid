import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, FileDown } from "lucide-react";

export interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  sortKey?: keyof T;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  searchPlaceholder?: string;
  emptyStateText?: string;
  itemsPerPageOptions?: number[];
  actions?: (item: T) => React.ReactNode;
  rowKey: (item: T) => string | number;
  rightHeaderActions?: React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  searchKeys = [],
  searchPlaceholder = "Cari data...",
  emptyStateText = "Tidak ada data ditemukan",
  itemsPerPageOptions = [10, 25, 50],
  actions,
  rowKey,
  rightHeaderActions
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(itemsPerPageOptions[0]);

  // Handle Search Filter
  const filteredData = useMemo(() => {
    if (!searchQuery || searchKeys.length === 0) return data;
    
    return data.filter((item) => {
      return searchKeys.some((key) => {
        const val = item[key];
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(searchQuery.toLowerCase());
      });
    });
  }, [data, searchQuery, searchKeys]);

  // Handle Sorting
  const sortedData = useMemo(() => {
    const sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (typeof valA === "string" && typeof valB === "string") {
          return sortConfig.direction === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        if (valA < valB) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  // Handle Pagination Calculations
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  
  // Guard current page range
  const adjustedCurrentPage = currentPage > totalPages ? totalPages : currentPage;

  const paginatedData = useMemo(() => {
    const startIndex = (adjustedCurrentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, adjustedCurrentPage, itemsPerPage]);

  const handleSort = (key: keyof T) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const startEntry = totalItems === 0 ? 0 : (adjustedCurrentPage - 1) * itemsPerPage + 1;
  const endEntry = Math.min(adjustedCurrentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col space-y-4 w-full">
      {/* Top bar with Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        {/* Reusable Search */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all placeholder-slate-400"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Right side extra actions */}
        <div className="flex items-center gap-2">
          {rightHeaderActions}
          
          <select
            className="px-3 py-2 text-sm bg-white border border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            {itemsPerPageOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} Baris
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Shell with responsive layout */}
      <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xs bg-white dark:bg-zinc-900/40">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50/75 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`px-6 py-4 ${col.className || ""}`}
                >
                  {col.sortable && (col.sortKey || typeof col.accessor === "string") ? (
                    <button
                      type="button"
                      onClick={() => handleSort((col.sortKey || col.accessor) as keyof T)}
                      className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors focus:outline-hidden"
                    >
                      {col.header}
                      <span className="text-slate-400">
                        {sortConfig?.key === (col.sortKey || col.accessor) ? (
                          sortConfig.direction === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : (
                          <div className="flex flex-col -space-y-1">
                            <ChevronUp className="h-2 w-2 opacity-40" />
                            <ChevronDown className="h-2 w-2 opacity-40" />
                          </div>
                        )}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {actions && <th className="px-6 py-4 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-6 py-12 text-center text-slate-500 dark:text-zinc-400"
                >
                  <p className="text-base font-medium">{emptyStateText}</p>
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr
                  key={rowKey(item)}
                  className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 text-slate-750 dark:text-zinc-300 transition-colors"
                >
                  {columns.map((col, colIdx) => {
                    const value =
                      typeof col.accessor === "function"
                        ? col.accessor(item)
                        : (item[col.accessor] as React.ReactNode);

                    return (
                      <td
                        key={colIdx}
                        className={`px-6 py-4 whitespace-nowrap ${col.className || ""}`}
                      >
                        {value}
                      </td>
                    );
                  })}
                  {actions && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1.5">{actions(item)}</div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center text-sm text-slate-500 dark:text-zinc-400 py-2">
        <div>
          Menampilkan <span className="font-semibold text-slate-800 dark:text-zinc-200">{startEntry}</span>-
          <span className="font-semibold text-slate-800 dark:text-zinc-200">{endEntry}</span> dari{" "}
          <span className="font-semibold text-slate-800 dark:text-zinc-200">{totalItems}</span> Entri
        </div>

        {totalPages > 1 && (
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={adjustedCurrentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 disabled:opacity-40 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Simple truncation logic for massive pages
              if (
                totalPages > 5 &&
                page !== 1 &&
                page !== totalPages &&
                Math.abs(page - adjustedCurrentPage) > 1
              ) {
                if (page === 2 || page === totalPages - 1) {
                  return <span key={page} className="px-1 text-slate-400">...</span>;
                }
                return null;
              }

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg border text-xs font-semibold transition-all ${
                    adjustedCurrentPage === page
                      ? "bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={adjustedCurrentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 disabled:opacity-40 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
