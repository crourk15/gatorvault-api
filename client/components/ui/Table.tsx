'use client';

import React, { useMemo, useState } from 'react';

export type TableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
};

type Props<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sortable?: boolean;
  className?: string;
  emptyMessage?: string;
};

export function Table<T>({
  columns,
  rows,
  rowKey,
  sortable = false,
  className = '',
  emptyMessage = 'No data',
}: Props<T>): React.ReactElement {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortable || !sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [columns, rows, sortKey, sortDir, sortable]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  if (!rows.length) {
    return <p className="gv-page-status">{emptyMessage}</p>;
  }

  return (
    <div className={`gv-ds-table-wrap${className ? ` ${className}` : ''}`}>
      <table className={`gv-ds-table${sortable ? ' gv-ds-table--sortable' : ''}`}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">
                {sortable && col.sortValue ? (
                  <button type="button" onClick={() => toggleSort(col.key)}>
                    {col.header}
                    {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : null}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.key}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
