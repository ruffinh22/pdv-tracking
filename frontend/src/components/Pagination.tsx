import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (limit: number) => void;
}

const Pagination = ({
  currentPage,
  totalPages,
  total,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange
}: PaginationProps) => {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-ink-100 bg-white">
      <div className="flex items-center gap-2 text-sm text-ink-500">
        <span>Résultats par page</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="toolbar-select py-1.5"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>

      <div className="text-sm text-ink-500">
        Total : <span className="font-medium text-ink-800">{total}</span> enregistrement{total > 1 ? 's' : ''}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="btn-icon w-8 h-8 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Première page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn-icon w-8 h-8 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Page précédente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-3 text-sm text-ink-600 whitespace-nowrap">
          Page <span className="font-semibold text-ink-900">{currentPage}</span> sur {safeTotalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === safeTotalPages}
          className="btn-icon w-8 h-8 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Page suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(safeTotalPages)}
          disabled={currentPage === safeTotalPages}
          className="btn-icon w-8 h-8 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Dernière page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
