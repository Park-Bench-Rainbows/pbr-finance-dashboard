'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type CurrencyCode = 'TTD' | 'USD' | 'CAD';

export type SavingsTargetCarouselItem = {
  id: string;
  name: string;
  baseCurrency: CurrencyCode;
  targetAmount: number;
  startDate: string;
  targetDate: string;
  factorInExistingPlans: boolean;
  plannedToDate?: number;
  plannedTotal?: number;
  percentPlannedToDate?: number;
  expectedToDate?: number;
  actualToDate?: number;
  percentActualToDate?: number;
  status?: 'on_track' | 'behind';
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function SavingsTargetCarousel({
  targets,
  baseCurrency,
  formatCurrency,
  formatISODate,
  detailsHref,
  onQuickAdd,
  className,
}: {
  targets: SavingsTargetCarouselItem[];
  baseCurrency: CurrencyCode;
  formatCurrency: (amount: number, currency: CurrencyCode) => string;
  formatISODate: (value: string) => string;
  detailsHref: (target: SavingsTargetCarouselItem) => string;
  onQuickAdd: (target: SavingsTargetCarouselItem) => void;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const isShortList = targets.length <= 2;
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < targets.length - 1;

  const statusLabel = useMemo(() => {
    return targets.map((t) => {
      if (t.status === 'behind') return 'Behind';
      if (t.status === 'on_track') return 'On track';
      return null;
    });
  }, [targets]);

  const scrollToIndex = (index: number) => {
    const clamped = clamp(index, 0, targets.length - 1);
    const scroller = scrollerRef.current;
    const slide = slideRefs.current[clamped];
    if (!scroller || !slide) return;

    slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    setActiveIndex(clamped);
  };

  useEffect(() => {
    setActiveIndex(0);
    slideRefs.current = [];
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTo({ left: 0 });
  }, [targets.length]);

  const updateActiveFromScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const centerX = scrollerRect.left + scrollerRect.width / 2;

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < targets.length; i++) {
      const slide = slideRefs.current[i];
      if (!slide) continue;
      const r = slide.getBoundingClientRect();
      const slideCenter = r.left + r.width / 2;
      const dist = Math.abs(slideCenter - centerX);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIndex = i;
      }
    }

    setActiveIndex(bestIndex);
  };

  if (!targets.length) return null;

  return (
    <div className={cn('relative', className)}>
      {!isShortList && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-10 bg-gradient-to-r from-background to-transparent md:block" />
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-gradient-to-l from-background to-transparent md:block" />
        </>
      )}

      {targets.length > 1 && (
        <>
          <div className="absolute inset-y-0 left-0 hidden items-center md:flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="pointer-events-auto rounded-xl shadow-sm"
              onClick={() => scrollToIndex(activeIndex - 1)}
              disabled={!canGoPrev}
              aria-label="Previous savings target"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute inset-y-0 right-0 hidden items-center md:flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="pointer-events-auto rounded-xl shadow-sm"
              onClick={() => scrollToIndex(activeIndex + 1)}
              disabled={!canGoNext}
              aria-label="Next savings target"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      <div
        ref={scrollerRef}
        className={cn(
          'flex gap-4 overflow-x-auto px-2 py-1',
          'scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'snap-x snap-mandatory',
          isShortList && 'justify-center'
        )}
        tabIndex={0}
        role="group"
        aria-label="Savings targets carousel"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            scrollToIndex(activeIndex - 1);
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            scrollToIndex(activeIndex + 1);
          }
        }}
        onScroll={() => {
          window.requestAnimationFrame(updateActiveFromScroll);
        }}
      >
        {targets.map((t, idx) => {
          const actual = typeof t.actualToDate === 'number' ? t.actualToDate : null;
          const remaining =
            actual != null ? Math.max(0, t.targetAmount - actual) : null;

          const denominator = typeof t.targetAmount === 'number' && t.targetAmount > 0 ? t.targetAmount : 0;
          const progressValue = denominator > 0 && actual != null ? clamp(actual / denominator, 0, 1) : 0;
          const progressLabel =
            actual != null && denominator > 0
              ? `${Math.round(progressValue * 100)}% of target saved`
              : 'Progress unavailable';

          return (
            <div
              key={t.id}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              className={cn(
                'snap-center',
                'w-[min(560px,calc(100vw-3rem))] shrink-0'
              )}
              aria-current={idx === activeIndex ? 'true' : undefined}
            >
              <div className="rounded-2xl border bg-card p-5 shadow-sm shadow-black/5 dark:shadow-black/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                      {t.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Due {formatISODate(t.targetDate)}</span>
                      {t.factorInExistingPlans && (
                        <span className="rounded-md border bg-background/40 px-1.5 py-0.5">
                          Factors plans
                        </span>
                      )}
                    </div>
                  </div>
                  {statusLabel[idx] && (
                    <Badge variant={t.status === 'behind' ? 'warning' : 'success'}>
                      {statusLabel[idx]}
                    </Badge>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-background/40 px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">Target</div>
                    <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">
                      {formatCurrency(t.targetAmount, baseCurrency)}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/40 px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">Started</div>
                    <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">
                      {formatISODate(t.startDate)}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="tabular-nums text-muted-foreground">{progressLabel}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${Math.round(progressValue * 100)}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Actual to date</div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums">
                        {actual == null ? '—' : formatCurrency(actual, baseCurrency)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Remaining</div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums">
                        {remaining == null ? '—' : formatCurrency(remaining, baseCurrency)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={detailsHref(t)}
                    className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    View details
                  </a>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onQuickAdd(t)}>
                      Quick add
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {targets.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {activeIndex + 1}/{targets.length}
          </span>
          <div className="flex items-center gap-1.5">
            {targets.map((t, idx) => (
              <button
                key={t.id}
                type="button"
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  idx === activeIndex ? 'bg-foreground/60' : 'bg-foreground/20 hover:bg-foreground/35'
                )}
                onClick={() => scrollToIndex(idx)}
                aria-label={`Go to target ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
