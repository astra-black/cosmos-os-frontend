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
import type { CrewMember } from "@/types/agency"

const statusClass: Record<string, string> = {
  on_site: "bg-chart-2/20 text-foreground",
  confirmed: "bg-primary/10 text-primary",
  assigned: "bg-muted text-muted-foreground",
  complete: "bg-chart-5/20 text-foreground",
}

const columns: ColumnDef<CrewMember>[] = [
  {
    accessorKey: "name",
    header: "Crew",
    cell: ({ row }) => (
      <div className="flex flex-col text-sm">
        <span className="font-medium">{row.original.name || row.original.crewId}</span>
        <span className="text-muted-foreground">{row.original.email || row.original.crewId}</span>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => row.original.role || "—",
  },
  {
    accessorKey: "departmentName",
    header: "Department",
    cell: ({ row }) => row.original.departmentName || row.original.departmentId || "—",
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
]

export function CrewDatatable({ data }: { data: CrewMember[] }) {
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
                  No crew assigned to this event.
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
