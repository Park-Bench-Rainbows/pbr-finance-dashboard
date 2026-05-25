"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground border-border",
        outline: "bg-transparent text-foreground border-border",
        success:
          "bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30",
        danger:
          "bg-rose-500/10 text-rose-800 border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30",
        warning:
          "bg-amber-500/10 text-amber-900 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30",
        info:
          "bg-blue-500/10 text-blue-800 border-blue-500/25 dark:bg-blue-500/15 dark:text-blue-200 dark:border-blue-500/30",
        purple:
          "bg-violet-500/10 text-violet-800 border-violet-500/25 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-500/30",
        teal:
          "bg-teal-500/10 text-teal-800 border-teal-500/25 dark:bg-teal-500/15 dark:text-teal-200 dark:border-teal-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
