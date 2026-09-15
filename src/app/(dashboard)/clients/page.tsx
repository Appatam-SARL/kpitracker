'use client';

import ClientEditSheet from '@/components/ClientEditSheet';
import ClientViewSheet from '@/components/ClientViewSheet';
import ClientsOnboardingCarousel from '@/components/clients/ClientsOnboardingCarousel';
import NeumoCard from '@/components/NeumoCard';
import SkeletonLoader from '@/components/SkeletonLoader';
import { withDashboardLayout } from '@/components/layouts/withDashboardLayout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const CLIENTS_PER_PAGE = 10;

export interface Client {
  id: string;
  name: string;
  contact?: string | null;
  totalRevenue: number;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  civility?: string | null;
  activityDomain?: string | null;
  companyName?: string | null;
  location?: string | null;
  notes?: string | null;
  company?: { id: string; name: string } | null;
  convertedById?: string | null;
  convertedAt?: string | null;
  convertedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

function ClientsPageInner() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/clients');
        if (res.ok) {
          const data = await res.json();
          setClients(data);
        }
      } catch {
        // silencieux pour le MVP
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return clients;
    const q = query.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.contact && c.contact.toLowerCase().includes(q)) ||
        (c.company?.name && c.company.name.toLowerCase().includes(q))
    );
  }, [clients, query]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * CLIENTS_PER_PAGE;
    return filtered.slice(start, start + CLIENTS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / CLIENTS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  const handleUpdated = (updated: Client) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    setEditClient(null);
  };

  return (
    <>
      <section className='mt-2 flex flex-col gap-4'>
        <ClientsOnboardingCarousel
          onShowList={() => setViewMode('table')}
          onFocusSearch={() => {
            window.setTimeout(() => searchInputRef.current?.focus(), 350);
          }}
          onShowGrid={() => setViewMode('grid')}
        />

        <div>
          <h1 className='text-xl md:text-2xl font-semibold text-primary'>
            Clients
          </h1>
          <p className='text-xs md:text-sm text-gray-500'>
            Gérez la liste de vos clients existants, distincte des leads.
          </p>
        </div>
      </section>

      <NeumoCard
        id='clients-liste'
        className='mt-4 scroll-mt-4 p-4 flex flex-col gap-4 bg-white'
      >
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
          <h2 className='text-sm font-semibold text-primary'>Liste des clients</h2>
          <div className='flex flex-wrap items-center gap-3'>
            <div className='flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-100 text-xs w-full sm:w-56'>
              <Search className='w-4 h-4 text-gray-400 shrink-0' />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Filtrer par nom, contact, société...'
                className='bg-transparent outline-none flex-1 text-[11px] text-gray-700 min-w-0'
              />
            </div>
            <span className='text-[11px] text-gray-500'>
              {filtered.length} client{filtered.length !== 1 ? 's' : ''}
            </span>
            <div className='inline-flex items-center rounded-full bg-gray-50 border border-gray-100 p-0.5'>
              <button
                type='button'
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] ${
                  viewMode === 'table'
                    ? 'bg-primary text-white shadow-neu'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title='Vue tableau'
              >
                <List className='w-3.5 h-3.5' />
              </button>
              <button
                type='button'
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] ${
                  viewMode === 'grid'
                    ? 'bg-primary text-white shadow-neu'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title='Vue cartes'
              >
                <LayoutGrid className='w-3.5 h-3.5' />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className='flex flex-col gap-3'>
            <SkeletonLoader className='h-10 w-full' />
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonLoader key={i} className='h-24 w-full' />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <p className='text-xs text-gray-500'>
            {query
              ? 'Aucun client ne correspond à votre recherche.'
              : "Aucun client enregistré pour le moment. Convertissez un lead en contact pour l'ajouter ici."}
          </p>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                {paginated.map((client) => (
                  <div
                    key={client.id}
                    className='rounded-2xl bg-[#f5f5ff] shadow-neu-soft border border-white/60 px-4 py-3 flex flex-col gap-1.5'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <p className='text-sm font-semibold text-primary truncate'>
                        {client.name}
                      </p>
                      <div className='flex items-center gap-1 shrink-0'>
                        <button
                          type='button'
                          onClick={() => setViewClient(client)}
                          className='w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:text-primary border border-gray-100'
                          title='Voir'
                        >
                          <Eye className='w-3.5 h-3.5' />
                        </button>
                        <button
                          type='button'
                          onClick={() => setEditClient(client)}
                          className='w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:text-primary border border-gray-100'
                          title='Modifier'
                        >
                          <Pencil className='w-3.5 h-3.5' />
                        </button>
                      </div>
                    </div>
                    <p className='text-[11px] text-gray-500 truncate'>
                      {client.contact ?? 'Aucun contact'}
                    </p>
                    <p className='text-[11px] text-gray-500'>
                      Converti par :{' '}
                      <span className='text-gray-700'>
                        {client.convertedBy?.name ?? '—'}
                      </span>
                    </p>
                    <div className='flex justify-between items-center text-[11px] text-gray-500 mt-1'>
                      <span>
                        Société :{' '}
                        <span className='text-gray-700 font-medium'>
                          {client.company?.name ?? '—'}
                        </span>
                      </span>
                      <span className='text-[10px] text-gray-400'>
                        CA total :{' '}
                        {client.totalRevenue.toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'XOF',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className='hover:bg-transparent'>
                    <TableHead>Nom du client</TableHead>
                    <TableHead>Société</TableHead>
                    <TableHead>Converti par</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className='text-right'>CA total</TableHead>
                    <TableHead className='text-right w-20'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className='text-primary font-medium'>
                        {client.name}
                      </TableCell>
                      <TableCell>
                        {client.company?.name ?? <TableEmpty />}
                      </TableCell>
                      <TableCell>
                        {client.convertedBy?.name ?? <TableEmpty />}
                      </TableCell>
                      <TableCell>
                        {client.contact ?? 'Aucun contact'}
                      </TableCell>
                      <TableCell className='text-right'>
                        {client.totalRevenue.toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'XOF',
                        })}
                      </TableCell>
                      <TableCell className='text-right'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type='button'
                              className='inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-50 text-gray-500 hover:text-primary border border-gray-100'
                            >
                              <MoreHorizontal className='w-4 h-4' />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side='left' align='end'>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setViewClient(client);
                              }}
                            >
                              <Eye className='w-4 h-4 mr-2' />
                              Voir
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setEditClient(client);
                              }}
                            >
                              <Pencil className='w-4 h-4 mr-2' />
                              Modifier
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {filtered.length > 0 && totalPages > 1 && (
              <div className='flex items-center justify-between gap-4 pt-4 border-t border-gray-100'>
                <div className='text-[11px] text-gray-500'>
                  Affichage de {(currentPage - 1) * CLIENTS_PER_PAGE + 1} à{' '}
                  {Math.min(currentPage * CLIENTS_PER_PAGE, filtered.length)} sur{' '}
                  {filtered.length} clients
                </div>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className='p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed'
                    title='Page précédente'
                  >
                    <ChevronLeft className='w-4 h-4' />
                  </button>
                  <span className='text-[11px] text-gray-600 px-2'>
                    Page {currentPage} / {totalPages}
                  </span>
                  <button
                    type='button'
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className='p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed'
                    title='Page suivante'
                  >
                    <ChevronRight className='w-4 h-4' />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </NeumoCard>

      <ClientViewSheet
        open={!!viewClient}
        client={viewClient}
        onClose={() => setViewClient(null)}
      />
      <ClientEditSheet
        open={!!editClient}
        client={editClient}
        onClose={() => setEditClient(null)}
        onUpdated={handleUpdated}
      />
    </>
  );
}

const ClientsPage = withDashboardLayout(ClientsPageInner);
export default ClientsPage;
