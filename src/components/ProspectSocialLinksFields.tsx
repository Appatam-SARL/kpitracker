'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  PROSPECT_SOCIAL_NETWORKS,
  type ProspectSocialLink,
} from '@/config/prospect-socials';

type ProspectSocialLinksFieldsProps = {
  value: ProspectSocialLink[];
  onChange: (links: ProspectSocialLink[]) => void;
};

export default function ProspectSocialLinksFields({
  value,
  onChange,
}: ProspectSocialLinksFieldsProps) {
  const updateAt = (index: number, patch: Partial<ProspectSocialLink>) => {
    onChange(
      value.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    );
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...value, { network: 'Facebook', url: '' }]);
  };

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-[11px] text-gray-600'>Réseaux sociaux</span>
        <button
          type='button'
          onClick={addRow}
          className='inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-gray-50'
        >
          <Plus className='h-3 w-3' />
          Ajouter
        </button>
      </div>

      {value.length === 0 ? (
        <p className='rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-400'>
          Aucun réseau social. Cliquez sur « Ajouter » pour en saisir un.
        </p>
      ) : (
        <div className='space-y-2'>
          {value.map((link, index) => (
            <div
              key={`${link.network}-${index}`}
              className='grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto] gap-1.5'
            >
              <select
                value={
                  PROSPECT_SOCIAL_NETWORKS.includes(
                    link.network as (typeof PROSPECT_SOCIAL_NETWORKS)[number],
                  )
                    ? link.network
                    : 'Autre'
                }
                onChange={(e) => updateAt(index, { network: e.target.value })}
                className='h-8 rounded-xl border border-gray-200 bg-gray-50 px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40'
                aria-label='Réseau social'
              >
                {PROSPECT_SOCIAL_NETWORKS.map((network) => (
                  <option key={network} value={network}>
                    {network}
                  </option>
                ))}
              </select>
              <input
                type='url'
                value={link.url}
                onChange={(e) => updateAt(index, { url: e.target.value })}
                placeholder='https://…'
                className='h-8 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40'
                aria-label='URL du réseau social'
              />
              <button
                type='button'
                onClick={() => removeAt(index)}
                className='inline-flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50'
                title='Supprimer'
                aria-label='Supprimer ce réseau social'
              >
                <Trash2 className='h-3.5 w-3.5' />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
