import { useState } from "react"
import { Link } from "react-router-dom"
import type { ColumnDef, PaginationState } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"

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
import type { Event } from "@/types/agency"
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, Trash2Icon } from "lucide-react"

const columns: ColumnDef<Event>[] = [
  {
    accessorKey: "name",
    header: "Event",
    cell: ({ row }) => (
      <div className="flex flex-col text-sm">
        <Link
          to={`/events/${row.original.eventId}`}
          className="text-card-foreground font-medium hover:underline"
        >
          {row.original.name}
        </Link>
        <span className="text-muted-foreground">{row.original.eventId}</span>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <span className="capitalize">{row.getValue("type")}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge className="bg-primary/10 text-primary h-auto rounded-sm px-1.5 capitalize">
        {row.getValue("status")}
      </Badge>
    ),
  },
  {
    accessorKey: "location",
    header: "Location",
  },
  {
    accessorKey: "startDate",
    header: "Start",
    cell: ({ row }) => {
      const value = row.getValue("startDate") as string
      return value ? new Date(value).toLocaleDateString() : "—"
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
]

export function EventsDatatable({ data, canWrite, onEdit, onDelete }: {
  data: Event[]
  canWrite?: boolean
  onEdit?: (event: Event) => void
  onDelete?: (event: Event) => void
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
                {canWrite ? <TableHead>Actions</TableHead> : null}
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
                  {canWrite ? (
                    <TableCell className="w-24">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="Edit event" aria-label={`Edit ${row.original.name}`} onClick={() => onEdit?.(row.original)}>
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Archive event" aria-label={`Archive ${row.original.name}`} onClick={() => onDelete?.(row.original)}>
                          <Trash2Icon className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + (canWrite ? 1 : 0)} className="h-24 text-center">
                  No events found. Create one via the middleware API or check Airtable sync.
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
