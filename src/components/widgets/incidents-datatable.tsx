import { useState } from "react"
import type { ColumnDef, PaginationState } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usePagination } from "@/hooks/use-pagination"
import type { Incident } from "@/types/agency"

const severityClass: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  warning: "bg-chart-4/25 text-foreground",
  info: "bg-muted text-muted-foreground",
}

const statusClass: Record<string, string> = {
  open: "bg-destructive/10 text-destructive",
  in_progress: "bg-primary/10 text-primary",
  resolved: "bg-chart-2/20 text-foreground",
  escalated: "bg-chart-5/20 text-foreground",
}

const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: "title",
    header: "Incident",
    cell: ({ row }) => (
      <div className="flex flex-col text-sm">
        <span className="font-medium">{row.original.title || row.original.incidentId}</span>
        <span className="text-muted-foreground">{row.original.incidentId}</span>
      </div>
    ),
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => {
      const severity = String(row.getValue("severity"))
      return (
        <Badge
          className={`h-auto rounded-sm px-1.5 capitalize ${severityClass[severity] ?? ""}`}
        >
          {severity}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = String(row.getValue("status"))
      return (
        <Badge
          className={`h-auto rounded-sm px-1.5 capitalize ${statusClass[status] ?? "bg-primary/10 text-primary"}`}
        >
          {status.replace("_", " ")}
        </Badge>
      )
    },
  },
  {
    accessorKey: "departmentName",
    header: "Dept",
    cell: ({ row }) => row.original.departmentName || row.original.departmentId || "—",
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => <span className="capitalize">{row.original.category || "—"}</span>,
  },
  {
    accessorKey: "reportedAt",
    header: "Reported",
    cell: ({ row }) => {
      const t = row.original.reportedAt || row.original.createdAt
      return t ? new Date(t).toLocaleString() : "—"
    },
  },
]

export function IncidentsDatatable({ data }: { data: Incident[] }) {
  const pageSize = 8
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
  })

  const totalPages = Math.max(table.getPageCount(), 1)
  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage: pagination.pageIndex + 1,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No incidents for this event.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination>
        <PaginationContent className="w-full justify-between">
          <PaginationItem>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Previous
            </Button>
          </PaginationItem>
          <div className="flex items-center gap-1">
            {showLeftEllipsis && <span className="px-2">…</span>}
            {pages.map((page) => (
              <PaginationItem key={page}>
                <Button
                  variant={page === pagination.pageIndex + 1 ? "default" : "ghost"}
                  size="sm"
                  onClick={() => table.setPageIndex(page - 1)}
                >
                  {page}
                </Button>
              </PaginationItem>
            ))}
            {showRightEllipsis && <span className="px-2">…</span>}
          </div>
          <PaginationItem>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
