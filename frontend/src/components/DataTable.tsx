import { useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from 'lucide-react';

/**
 * Métadonnées de colonne (utilisées par DataTable) :
 *  - label       : libellé affiché sur mobile (par défaut l'en-tête)
 *  - align       : alignement du contenu en vue tableau
 *  - className   : classes ajoutées aux cellules de la colonne
 *  - mobileHide  : masque la colonne dans la vue « cartes » (mobile)
 *  - mobileTitle : colonne utilisée comme titre de la carte (mobile)
 *  - mobileFooter: colonne rendue en pied de carte (ex. actions)
 */
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    label?: string;
    align?: 'left' | 'center' | 'right';
    className?: string;
    mobileHide?: boolean;
    mobileTitle?: boolean;
    mobileFooter?: boolean;
  }
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
  emptyIcon?: ReactNode;
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  /** Classes supplémentaires par ligne (ex. surligner une ligne en alerte). */
  rowClassName?: (row: T) => string;
  /** Nombre de lignes « squelette » affichées pendant le chargement. */
  skeletonRows?: number;
  /** Largeur minimale du tableau avant défilement horizontal. */
  minWidth?: number;
  /** Fige la 1re colonne lors du défilement horizontal. */
  stickyFirstColumn?: boolean;
  /** Tri par clic sur les en-têtes (true par défaut). À couper si l'ordre des lignes a un sens métier. */
  sortable?: boolean;
  /** Vue « cartes » sous 768 px (true par défaut). */
  mobileCards?: boolean;
  className?: string;
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

function SortIcon({ state }: { state: false | 'asc' | 'desc' }) {
  if (state === 'asc') return <ArrowUp className="w-3.5 h-3.5 text-primary-400" aria-hidden />;
  if (state === 'desc') return <ArrowDown className="w-3.5 h-3.5 text-primary-400" aria-hidden />;
  return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40 group-hover/th:opacity-90" aria-hidden />;
}

export default function DataTable<T>({
  data,
  columns,
  loading = false,
  emptyMessage = 'Aucun résultat',
  emptyHint,
  emptyIcon,
  getRowId,
  onRowClick,
  rowClassName,
  skeletonRows = 6,
  minWidth = 720,
  stickyFirstColumn = false,
  mobileCards = true,
  sortable = true,
  className = '',
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    enableSorting: sortable,
    onSortingChange: setSorting,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();
  const colCount = table.getVisibleLeafColumns().length;

  const empty = (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center px-4" role="status">
      <div className="w-14 h-14 rounded-[4px] bg-success-50 ring-1 ring-ink-200 flex items-center justify-center text-success-600">
        {emptyIcon ?? <Inbox className="w-6 h-6" aria-hidden />}
      </div>
      <p className="font-bold text-ink-800">{emptyMessage}</p>
      {emptyHint ? <p className="text-sm font-medium text-ink-500">{emptyHint}</p> : null}
    </div>
  );

  const handleRowKey = (e: React.KeyboardEvent, row: Row<T>) => {
    if (!onRowClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick(row.original);
    }
  };

  return (
    <div className={`dt ${className}`} aria-busy={loading}>
      {/* ---------- Vue tableau (≥ 768 px, ou toujours si mobileCards=false) ---------- */}
      <div className={`${mobileCards ? 'hidden md:block' : ''} overflow-x-auto`}>
        <table className="dt-table" style={{ minWidth }}>
          <thead>
            {headerGroups.map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header, i) => {
                  const meta = header.column.columnDef.meta;
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className={`${ALIGN[meta?.align ?? 'left']} ${stickyFirstColumn && i === 0 ? 'dt-sticky' : ''}`}
                      style={header.getSize() !== 150 ? { width: header.getSize() } : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={`group/th inline-flex items-center gap-1.5 uppercase tracking-[0.08em] font-extrabold hover:text-white transition-colors ${
                            meta?.align === 'right' ? 'flex-row-reverse' : ''
                          }`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon state={sorted} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, r) => (
                <tr key={`sk-${r}`} aria-hidden>
                  {Array.from({ length: colCount }).map((__, c) => (
                    <td key={c}>
                      <div className="h-4 rounded bg-ink-200/70 animate-pulse" style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr className="dt-empty">
                <td colSpan={colCount}>{empty}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={(e) => handleRowKey(e, row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={`${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(row.original) ?? ''}`}
                >
                  {row.getVisibleCells().map((cell, i) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <td
                        key={cell.id}
                        onClick={meta?.mobileFooter ? (e) => e.stopPropagation() : undefined}
                        className={`${ALIGN[meta?.align ?? 'left']} ${meta?.className ?? ''} ${
                          stickyFirstColumn && i === 0 ? 'dt-sticky' : ''
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Vue cartes (< 768 px) ---------- */}
      {mobileCards && (
        <div className="md:hidden">
          {loading ? (
            <ul className="divide-y divide-ink-100" aria-hidden>
              {Array.from({ length: Math.min(skeletonRows, 4) }).map((_, r) => (
                <li key={r} className="p-4 space-y-2.5">
                  <div className="h-4 w-2/3 rounded bg-ink-200/70 animate-pulse" />
                  <div className="h-3 w-full rounded bg-ink-100 animate-pulse" />
                  <div className="h-3 w-4/5 rounded bg-ink-100 animate-pulse" />
                </li>
              ))}
            </ul>
          ) : rows.length === 0 ? (
            empty
          ) : (
            <ul>
              {rows.map((row) => {
                const cells = row.getVisibleCells();
                const title = cells.find((c) => c.column.columnDef.meta?.mobileTitle) ?? cells[0];
                const footer = cells.filter((c) => c.column.columnDef.meta?.mobileFooter);
                const body = cells.filter(
                  (c) => c !== title && !c.column.columnDef.meta?.mobileHide && !c.column.columnDef.meta?.mobileFooter
                );
                return (
                  <li
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={`dt-card ${onRowClick ? 'cursor-pointer active:bg-primary-50' : ''} ${rowClassName?.(row.original) ?? ''}`}
                  >
                    <div className="font-bold text-ink-950 min-w-0">
                      {flexRender(title.column.columnDef.cell, title.getContext())}
                    </div>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
                      {body.map((cell) => {
                        const h = cell.column.columnDef.header;
                        const label = cell.column.columnDef.meta?.label ?? (typeof h === 'string' ? h : '');
                        return (
                          <div key={cell.id} className="contents">
                            <dt className="text-[11px] font-extrabold uppercase tracking-wider text-ink-500 pt-0.5">{label}</dt>
                            <dd className="font-medium text-ink-800 min-w-0 break-words">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                    {footer.length > 0 && (
                      <div
                        className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {footer.map((cell) => (
                          <span key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
