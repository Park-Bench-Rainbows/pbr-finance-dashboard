"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"

export type MobileMetaItem = {
  label: string
  value: React.ReactNode
}

export function MobileRowCard({
  title,
  amountNode,
  contextNode,
  metaItems,
  secondaryText,
  onEdit,
  onDelete,
  editIcon: EditIcon,
  deleteIcon: DeleteIcon,
  editLabel = "Edit",
  deleteLabel = "Delete",
  deleteLoading = false,
  editDisabled = false,
  className,
}: {
  title: string
  amountNode: React.ReactNode
  contextNode?: React.ReactNode
  metaItems?: MobileMetaItem[]
  secondaryText?: React.ReactNode
  onEdit?: () => void
  onDelete?: () => void
  editIcon?: LucideIcon
  deleteIcon?: LucideIcon
  editLabel?: string
  deleteLabel?: string
  deleteLoading?: boolean
  editDisabled?: boolean
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          {contextNode ? <div className="mt-1 text-xs text-muted-foreground">{contextNode}</div> : null}
        </div>
        <div className="shrink-0 text-right font-semibold tabular-nums">{amountNode}</div>
      </div>

      {secondaryText ? <div className="mt-2 text-xs text-muted-foreground">{secondaryText}</div> : null}

      {metaItems?.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {metaItems.slice(0, 2).map((item, idx) => (
            <div key={item.label} className={idx === 1 ? "text-right" : undefined}>
              <div>{item.label}</div>
              <div className="font-medium text-foreground">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {onEdit || onDelete ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {onEdit ? (
            <Button type="button" variant="outline" onClick={onEdit} disabled={editDisabled}>
              {EditIcon ? <EditIcon className="h-4 w-4" /> : null}
              {editLabel}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              isLoading={deleteLoading}
              loadingText={deleteLabel}
            >
              {DeleteIcon ? <DeleteIcon className="h-4 w-4" /> : null}
              {deleteLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
