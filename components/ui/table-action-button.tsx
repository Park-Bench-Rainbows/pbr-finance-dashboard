"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type TableActionButtonProps = React.ComponentProps<typeof Button> & {
  label: string
  icon: React.ReactNode
  destructive?: boolean
  isLoading?: boolean
}

export function TableActionButton({
  label,
  icon,
  destructive = false,
  isLoading = false,
  className,
  disabled,
  ...props
}: TableActionButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled || isLoading}
      className={cn(
        destructive && "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300",
        className
      )}
      {...props}
    >
      {isLoading ? <Spinner size="sm" /> : icon}
    </Button>
  )
}
