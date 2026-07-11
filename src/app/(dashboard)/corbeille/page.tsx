'use client';

import TrashBinPanel from '@/components/trash/TrashBinPanel';
import { withDashboardLayout } from '@/components/layouts/withDashboardLayout';

function CorbeillePage() {
  return (
    <div className='p-4 sm:p-6 max-w-6xl mx-auto w-full'>
      <TrashBinPanel />
    </div>
  );
}

export default withDashboardLayout(CorbeillePage);
