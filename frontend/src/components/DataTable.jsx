import React, { useState, useMemo } from 'react';
import './DataTable.css';

/**
 * Standardized, reusable DataTable component for Brightloop ERP.
 *
 * Props:
 * - columns: Array<{
 *     key: string,
 *     header: ReactNode,
 *     render?: (row: any, index: number) => ReactNode,
 *     sortable?: boolean,
 *     sortKey?: (row: any) => any,
 *     align?: 'left' | 'center' | 'right',
 *     width?: string,
 *     className?: string
 *   }>
 * - data: Array<any>
 * - keyField?: string (default: 'id')
 * - title?: ReactNode
 * - subtitle?: ReactNode
 * - actions?: ReactNode (buttons or components on top right of table toolbar)
 * - searchable?: boolean
 * - searchPlaceholder?: string
 * - searchFilter?: (item: any, query: string) => boolean
 * - filters?: Array<{
 *     id: string,
 *     label: string,
 *     value: string,
 *     options: Array<{ label: string, value: string }>,
 *     onChange: (value: string) => void
 *   }>
 * - pagination?: boolean (default: true)
 * - pageSize?: number (default: 10)
 * - loading?: boolean
 * - emptyMessage?: ReactNode
 * - emptyIcon?: ReactNode
 * - onRowClick?: (row: any) => void
 * - selectedRowId?: string | number
 * - className?: string
 */
export default function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  title = null,
  subtitle = null,
  actions = null,
  searchable = false,
  searchPlaceholder = 'Search records...',
  searchFilter = null,
  filters = [],
  pagination = true,
  pageSize: initialPageSize = 10,
  loading = false,
  emptyMessage = 'No records found.',
  emptyIcon = '📋',
  onRowClick = null,
  selectedRowId = null,
  className = ''
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // 1. Filter by Search Query
  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase().trim();

    return data.filter((item) => {
      if (searchFilter) {
        return searchFilter(item, query);
      }
      // Default search: inspect values of all column keys
      return columns.some((col) => {
        const val = item[col.key];
        if (val == null) return false;
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(query);
        }
        return false;
      });
    });
  }, [data, searchable, searchQuery, searchFilter, columns]);

  // 2. Sort Data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const col = columns.find((c) => c.key === sortConfig.key);
    if (!col) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aVal = col.sortKey ? col.sortKey(a) : a[col.key];
      let bVal = col.sortKey ? col.sortKey(b) : b[col.key];

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(String(bVal));
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [filteredData, sortConfig, columns]);

  // 3. Pagination
  const totalItems = sortedData.length;
  const totalPages = pagination ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const startIndex = (safePage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, pagination, safePage, pageSize]);

  const handleSort = (col) => {
    if (!col.sortable) return;
    setSortConfig((prev) => {
      if (prev.key === col.key) {
        return {
          key: col.key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key: col.key, direction: 'asc' };
    });
  };

  const startRecord = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRecord = Math.min(safePage * pageSize, totalItems);

  return (
    <div className={`datatable-container ${className}`}>
      {/* Top Header / Toolbar */}
      {(title || subtitle || actions || searchable || filters.length > 0) && (
        <div className="datatable-toolbar">
          {(title || subtitle) && (
            <div className="datatable-title-block">
              {title && <h3 className="datatable-title">{title}</h3>}
              {subtitle && <p className="datatable-subtitle">{subtitle}</p>}
            </div>
          )}

          <div className="datatable-controls-row">
            {searchable && (
              <div className="datatable-search-wrapper">
                <span className="datatable-search-icon">🔍</span>
                <input
                  type="text"
                  className="datatable-search-input"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="datatable-clear-search"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {filters.map((filter) => (
              <div key={filter.id} className="datatable-filter-item">
                {filter.label && <span className="datatable-filter-label">{filter.label}</span>}
                <select
                  className="datatable-filter-select"
                  value={filter.value}
                  onChange={(e) => {
                    filter.onChange(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {actions && <div className="datatable-actions-slot">{actions}</div>}
          </div>
        </div>
      )}

      {/* Table Body Area */}
      <div className="datatable-table-wrap">
        <table className="datatable-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = sortConfig.key === col.key;
                const alignClass = col.align ? `align-${col.align}` : 'align-left';
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`${alignClass} ${col.sortable ? 'sortable' : ''} ${isSorted ? 'sorted' : ''} ${col.className || ''}`}
                    onClick={() => handleSort(col)}
                  >
                    <div className="datatable-th-content">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="datatable-sort-indicator">
                          {isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="datatable-loading-cell">
                  <div className="datatable-spinner-box">
                    <span className="datatable-spinner" />
                    <span>Loading data records...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="datatable-empty-cell">
                  <div className="datatable-empty-box">
                    <span className="datatable-empty-icon">{emptyIcon}</span>
                    <strong className="datatable-empty-text">{emptyMessage}</strong>
                    {searchQuery && (
                      <p className="datatable-empty-sub">
                        Try adjusting your search query or active filters.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const rowKey = row[keyField] ?? index;
                const isSelected = selectedRowId != null && row[keyField] === selectedRowId;
                return (
                  <tr
                    key={rowKey}
                    className={`${onRowClick ? 'clickable-row' : ''} ${isSelected ? 'selected-row' : ''}`}
                    onClick={() => onRowClick && onRowClick(row)}
                  >
                    {columns.map((col) => {
                      const alignClass = col.align ? `align-${col.align}` : 'align-left';
                      return (
                        <td
                          key={`${rowKey}-${col.key}`}
                          className={`${alignClass} ${col.className || ''}`}
                        >
                          {col.render ? col.render(row, index) : (row[col.key] ?? '—')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && !loading && totalItems > 0 && (
        <div className="datatable-footer">
          <div className="datatable-record-count">
            Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of{' '}
            <strong>{totalItems}</strong> entries
          </div>

          <div className="datatable-pagination-controls">
            <div className="datatable-page-size-selector">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>per page</span>
            </div>

            <div className="datatable-page-buttons">
              <button
                type="button"
                className="datatable-page-btn"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                ‹ Prev
              </button>

              <span className="datatable-page-status">
                Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
              </span>

              <button
                type="button"
                className="datatable-page-btn"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
