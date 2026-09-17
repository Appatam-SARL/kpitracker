'use client';

import TrashBinPanel from '@/components/trash/TrashBinPanel';
import { withDashboardLayout } from '@/components/layouts/withDashboardLayout';
import { Trash2 } from 'lucide-react';

function CorbeillePage() {
  return (
    <div className='w-full max-w-6xl mx-auto p-4 sm:p-6'>
      <TrashBinPanel />
    </div>
  );
}

export default withDashboardLayout(CorbeillePage, {
  title: 'Corbeille',
  subtitle:
    'Éléments supprimés récupérables. Restaurez-les ou supprimez-les définitivement.',
  titleIcon: Trash2,
});
