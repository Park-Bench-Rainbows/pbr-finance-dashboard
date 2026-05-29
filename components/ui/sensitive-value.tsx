import * as React from 'react';

import { cn } from '@/lib/utils';

type SensitiveValueProps = React.ComponentProps<'span'> & {
  isRevealed: boolean;
  value: React.ReactNode;
  hiddenLabel: string;
  hiddenText?: React.ReactNode;
};

export function SensitiveValue({
  isRevealed,
  value,
  hiddenLabel,
  hiddenText = '••••••',
  className,
  title,
  ...props
}: SensitiveValueProps) {
  return (
    <span
      className={cn('inline-flex items-center align-baseline', className)}
      aria-label={isRevealed ? undefined : hiddenLabel}
      title={isRevealed ? title : hiddenLabel}
      {...props}
    >
      {isRevealed ? value : <span aria-hidden="true">{hiddenText}</span>}
    </span>
  );
}
