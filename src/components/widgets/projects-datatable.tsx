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
import type { Project } from "@/types/agency"

const statusClass: Record<string, string> = {
  NotStarted: "bg-muted text-muted-foreground",
  InProgress: "bg-primary/10 text-primary",
  Review: "bg-chart-4/20 text-foreground",
  Approved: "bg-chart-2/20 text-foreground",
  Archived: "bg-muted text-muted-foreground",
}

const columns: ColumnDef<Project>[] = [
  {
    accessorKey: "projectName",
    header: "Project",
    cell: ({ row }) => (
      <div className="flex flex-col text-sm">
        <span className="text-card-foreground font-medium">{row.original.projectName}</span>
        <span className="text-muted-foreground">{row.original.projectId}</span>
      </div>
    ),
  },
  {
    accessorKey: "clientName",
    header: "Client",
    cell: ({ row }) => row.original.clientName || row.original.clientId || "—",
  },
  {
    accessorKey: "campaignId",
    header: "Campaign",
    cell: ({ row }) => row.original.campaignId ?? "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = String(row.getValue("status"))
      return (
        <Badge className={`h-auto rounded-sm px-1.5 capitalize ${statusClass[status] ?? "bg-primary/10 text-primary"}`}>
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "weight",
    header: "Weight",
    cell: ({ row }) => {
      const w = row.original.weight
      return w != null ? `${w}%` : "—"
    },
  },
  {
    accessorKey: "budget",
    header: "Budget",
    cell: ({ row }) => {
      const budget = row.original.budget
      return budget != null ? `$${budget.toLocaleString()}` : "—"
    },
  },
  {
    accessorKey: "endDate",
    header: "End",
    cell: ({ row }) => {
      const value = row.original.endDate
      return value ? new Date(value).toLocaleDateString() : "—"
    },
  },
]

export function ProjectsDatatable({
  data,
  onRowClick,
}: {
  data: Project[]
  onRowClick?: (project: Project) => void
}) {
  const pageSize = 5
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
                <TableRow
                  key={row.id}
                  className={onRowClick ? "hover:bg-muted/50 cursor-pointer" : undefined}
                  onClick={() => onRowClick?.(row.original)}
                >
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
                  No projects found.
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
