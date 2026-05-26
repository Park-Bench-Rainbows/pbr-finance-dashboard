import { Suspense } from 'react';

import { PageLoading } from '@/components/ui/page-loading';
import { SavingsTargetsClient } from '@/app/(dashboard)/savings/targets/targets-client';

export default function SavingsTargetsPage() {
  return (
    <Suspense fallback={<PageLoading variant="simple" />}>
      <SavingsTargetsClient />
    </Suspense>
  );
}

