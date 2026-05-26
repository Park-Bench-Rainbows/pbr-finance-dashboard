"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import {
  CartesianGrid,
  Legend,
  Tooltip,
  type LegendProps,
  type TooltipProps,
} from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    icon?: React.ComponentType
    color?: string
    theme?: {
      light: string
      dark: string
    }
  }
>

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChart must be used within a <ChartContainer />")
  return context
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
}

function getConfigKey(config: ChartConfig, key: string) {
  if (key in config) return key
  const kebab = toKebabCase(key)
  if (kebab in config) return kebab
  return key
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorEntries = Object.entries(config).filter(([, v]) => v.color || v.theme)
  if (!colorEntries.length) return null

  const css = colorEntries
    .map(([key, v]) => {
      const cssVar = `--color-${toKebabCase(key)}`
      if (v.theme) {
        return [
          `[data-chart=${id}] { ${cssVar}: ${v.theme.light}; }`,
          `.dark [data-chart=${id}] { ${cssVar}: ${v.theme.dark}; }`,
        ].join("\n")
      }
      return `[data-chart=${id}] { ${cssVar}: ${v.color}; }`
    })
    .join("\n")

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & { config: ChartConfig; id?: string }) {
  const chartId = React.useId()
  const resolvedId = id ?? chartId.replace(/:/g, "")

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={resolvedId}
        className={cn(
          "flex min-w-0 justify-center overflow-hidden text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={resolvedId} config={config} />
        {children}
      </div>
    </ChartContext.Provider>
  )
}

export const ChartTooltip = Tooltip

type RechartsTooltipPayloadItem = {
  name?: unknown
  value?: unknown
  dataKey?: unknown
  color?: unknown
  payload?: unknown
}

type RechartsTooltipContentProps = {
  active?: boolean
  payload?: RechartsTooltipPayloadItem[]
  label?: unknown
  className?: string
}

type RechartsLegendPayloadItem = {
  value?: unknown
  dataKey?: unknown
  color?: unknown
  payload?: unknown
}

type RechartsLegendContentProps = {
  payload?: RechartsLegendPayloadItem[]
  className?: string
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  hideLabel = false,
  hideIndicator = false,
  indicator = "dot",
  labelKey,
  nameKey,
  formatter,
}: RechartsTooltipContentProps & {
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: "dot" | "line" | "dashed"
  labelKey?: string
  nameKey?: string
  formatter?: TooltipProps<number, string>["formatter"]
}) {
  const { config } = useChart()

  if (!active || !payload?.length) return null

  const resolvedLabelKey = labelKey ?? (payload?.[0]?.dataKey as string | undefined)
  const labelConfig = resolvedLabelKey ? config[getConfigKey(config, resolvedLabelKey)] : undefined
  const labelText = (labelConfig?.label ?? label) as React.ReactNode

  return (
    <div
      className={cn(
        "grid min-w-[10rem] gap-2 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md",
        className
      )}
    >
      {!hideLabel && labelText ? (
        <div className="text-xs font-medium text-muted-foreground">{labelText}</div>
      ) : null}

      <div className="grid gap-1">
        {payload.map((item, index) => {
          const key = nameKey ?? (item.dataKey as string | undefined) ?? item.name ?? ""
          const itemConfig = config[getConfigKey(config, String(key))] ?? config[getConfigKey(config, String(item.name ?? ""))]
          const indicatorColor = (item.color as string | undefined) ?? (itemConfig?.color ?? undefined) ?? `var(--color-${toKebabCase(String(key))})`

          const indicatorNode = hideIndicator ? null : (
            <span
              className={cn(
                "mt-0.5 shrink-0",
                indicator === "dot" && "h-2 w-2 rounded-full",
                indicator === "line" && "h-0.5 w-2 rounded",
                indicator === "dashed" && "h-0.5 w-2 rounded border border-dashed bg-transparent"
              )}
              style={
                indicator === "dashed"
                  ? { borderColor: indicatorColor }
                  : { backgroundColor: indicatorColor }
              }
            />
          )

          const nameNode = (
            <div className="flex items-start gap-2">
              {indicatorNode}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-muted-foreground">
                  {(itemConfig?.label ?? (item.name as React.ReactNode))}
                </div>
              </div>
              <div className="shrink-0 text-xs font-medium tabular-nums">
                {formatter
                  ? formatter(item.value as any, item.name as any, item as any, index, payload as any)
                  : (item.value as React.ReactNode)}
              </div>
            </div>
          )

          return <div key={String(item.dataKey ?? item.name ?? index)}>{nameNode}</div>
        })}
      </div>
    </div>
  )
}

export const ChartLegend = Legend

export function ChartLegendContent({
  payload,
  className,
  nameKey,
}: RechartsLegendContentProps & { nameKey?: string }) {
  const { config } = useChart()

  if (!payload?.length) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {payload.map((item) => {
        const key = nameKey ?? (item.dataKey as string | undefined) ?? item.value ?? ""
        const itemConfig = config[getConfigKey(config, String(key))] ?? config[getConfigKey(config, String(item.value ?? ""))]
        const color = item.color ?? itemConfig?.color ?? `var(--color-${toKebabCase(String(key))})`

        return (
          <div key={String(item.value)} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color as string }} />
            <span className="text-xs text-muted-foreground">
              {itemConfig?.label ?? (item.value as React.ReactNode)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ChartIndicator({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Slot>) {
  return <Slot {...props}>{children}</Slot>
}

export const ChartGrid = CartesianGrid

