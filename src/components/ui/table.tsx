import * as React from 'react';

import { cn } from '@/lib/utils';

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  /** Classes du conteneur scrollable autour du `<table>`. */
  containerClassName?: string;
};

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div
      className={cn(
        'relative w-full overflow-auto rounded-2xl border border-gray-100/90 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
        containerClassName,
      )}
    >
      <table
        ref={ref}
        className={cn(
          'w-full caption-bottom text-xs border-collapse',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'sticky top-0 z-10 bg-[#f7f7fc]/95 backdrop-blur-sm [&_tr]:border-b [&_tr]:border-gray-100',
      className,
    )}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      '[&_tr:last-child]:border-0 [&_tr:nth-child(even)]:bg-gray-50/40',
      className,
    )}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-gray-100 bg-gray-50/80 font-medium [&>tr]:last:border-b-0',
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-gray-50 transition-colors hover:bg-primary/5 data-[state=selected]:bg-primary/5',
      className,
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-11 px-3 text-left align-middle text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-3 py-3 align-middle text-[11px] text-gray-600 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
      className,
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-3 mb-1 px-3 text-[11px] text-gray-400', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

/** Placeholder pour cellules vides — moins bruyant qu’un tiret brut. */
function TableEmpty({ className }: { className?: string }) {
  return (
    <span className={cn('text-gray-300 select-none', className)} aria-hidden>
      —
    </span>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
};
