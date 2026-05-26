"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type SegmentedOption<TValue extends string> = {
  value: TValue
  label: string
}

export function SegmentedToggle<TValue extends string>({
  value,
  onValueChange,
  options,
  className,
  buttonClassName,
  ariaLabel,
}: {
  value: TValue
  onValueChange: (value: TValue) => void
  options: SegmentedOption<TValue>[]
  className?: string
  buttonClassName?: string
  ariaLabel?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-9 w-full items-center rounded-md border bg-card p-1 text-sm shadow-xs sm:w-auto",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded-sm px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              buttonClassName
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

