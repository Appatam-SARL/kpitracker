'use client';

import DashboardShell from '@/components/layouts/DashboardShell';
import NeumoCard from '@/components/NeumoCard';
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
  BookOpen,
  Building2,
  CalendarDays,
  ChartPie,
  ChevronDown,
  LayoutGrid,
  Lightbulb,
  Search,
  Settings,
  Target,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type GuideSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  summary: string;
  keywords: string;
  content: ReactNode;
};

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className='mt-3 flex gap-2.5 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2.5 text-[11px] text-sky-900'>
      <Lightbulb className='mt-0.5 h-4 w-4 shrink-0 text-sky-600' />
      <div className='min-w-0 leading-relaxed'>{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className='space-y-2.5 text-[12px] leading-relaxed text-gray-700'>
      {items.map((item, i) => (
        <li key={i} className='flex gap-2.5'>
          <span
            className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70'
            aria-hidden
          />
          <div className='min-w-0'>{item}</div>
        </li>
      ))}
    </ul>
  );
}

const SECTIONS: GuideSection[] = [
  {
    id: 'demarrage-connexion',
    label: 'Démarrage & Connexion',
    icon: BookOpen,
    summary: 'Se connecter, réinitialiser le mot de passe, naviguer.',
    keywords: 'connexion login mot de passe mobile sidebar menu',
    content: (
      <>
        <BulletList
          items={[
            <>
              <strong>Connexion :</strong> e-mail + mot de passe sur la page de
              connexion.
            </>,
            <>
              <strong>Mot de passe oublié :</strong> lien sur l&apos;écran de
              connexion pour recevoir un e-mail de réinitialisation.
            </>,
            <>
              <strong>Première utilisation :</strong> changez votre mot de passe
              depuis le Profil après la première connexion.
            </>,
            <>
              <strong>Desktop :</strong> sidebar à gauche (repliable) — Dashboard,
              Agenda, Leads, Clients, etc.
            </>,
            <>
              <strong>Mobile :</strong> barre d&apos;onglets en bas pour les
              raccourcis principaux ; menu hamburger pour le reste (Guide,
              Paramètres…).
            </>,
          ]}
        />
        <Tip>
          Sur mobile, les menus secondaires (Guide, Corbeille, Utilisateurs…)
          sont dans le tiroir ouvert via l&apos;icône menu en haut à gauche.
        </Tip>
      </>
    ),
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutGrid,
    summary: 'KPI, pipeline, objectifs et derniers prospects.',
    keywords: 'dashboard tableau bord kpi conversion objectifs',
    content: (
      <>
        <BulletList
          items={[
            <>
              <strong>Indicateurs :</strong> total prospects, taux de conversion,
              leads convertis (ventes conclues).
            </>,
            <>
              <strong>Graphiques :</strong> répartition par stade de négociation
              et par source d&apos;acquisition.
            </>,
            <>
              <strong>Objectifs :</strong> barre de progression pour le commercial
              ; aperçu d&apos;équipe pour manager / rôles groupe.
            </>,
            <>
              <strong>Derniers prospects :</strong> entreprise, contact, stade et
              date, avec lien vers la fiche.
            </>,
            <>
              <strong>Filtre entreprise :</strong> pour les rôles groupe
              (Holding ou filiale), les indicateurs suivent le périmètre choisi.
            </>,
          ]}
        />
        <Tip>
          Le détail type de client / source / rôle décideur se trouve dans{' '}
          <Link href='/stats' className='font-medium underline'>
            Statistiques
          </Link>
          .
        </Tip>
      </>
    ),
  },
  {
    id: 'leads-prospects',
    label: 'Leads (Prospects)',
    icon: UserPlus,
    summary: 'Entreprises, contacts, stades, import / export.',
    keywords: 'leads prospects contacts stade import excel kanban',
    content: (
      <>
        <BulletList
          items={[
            <>
              <strong>Liste :</strong> vues liste, kanban et grille ; filtres par
              stade, source, commercial, dates…
            </>,
            <>
              <strong>Entreprise vs contact :</strong> la fiche entreprise regroupe
              les contacts ; chaque commerciale suit ses contacts et leur stade.
            </>,
            <>
              <strong>Stade de négociation :</strong> En prospection → Vente
              conclue ou Vente perdue. La conversion crée un{' '}
              <strong>client à partir du contact</strong> et rattache le CA au
              commercial.
            </>,
            <>
              <strong>Type de client, source, rôle décideur :</strong> renseignez
              ces champs pour alimenter les statistiques.
            </>,
            <>
              <strong>Import / Export Excel :</strong> utilisez le modèle fourni
              pour l&apos;import ; l&apos;export respecte les filtres actifs.
            </>,
          ]}
        />
        <Tip>
          Pensez à compléter le type de client et la source sur l&apos;entreprise,
          et le rôle du décideur sur chaque contact.
        </Tip>
      </>
    ),
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: Building2,
    summary: 'Portefeuille clients et suivi après conversion.',
    keywords: 'clients conversion ca intérêts',
    content: (
      <BulletList
        items={[
          <>
            <strong>Liste :</strong> clients de votre périmètre (société / groupe
            selon le rôle).
          </>,
          <>
            <strong>Fiche :</strong> informations, intérêts produits/services, CA,
            commercial ayant converti.
          </>,
          <>
            <strong>Édition :</strong> mise à jour des infos depuis la fiche
            détail.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'agenda',
    label: 'Agenda',
    icon: CalendarDays,
    summary: 'Tâches et rendez-vous, vues jour à année.',
    keywords: 'agenda tâches rendez-vous relance',
    content: (
      <BulletList
        items={[
          <>
            <strong>Vues :</strong> Jour, Semaine, Mois, Année.
          </>,
          <>
            <strong>Visibilité :</strong> un commercial voit ses tâches ; manager
            / admin / rôles groupe voient l&apos;équipe (selon filtre
            entreprise).
          </>,
          <>
            <strong>Création :</strong> depuis l&apos;agenda ou depuis une fiche
            lead/contact (événement lié au prospect).
          </>,
        ]}
      />
    ),
  },
  {
    id: 'objectifs-commerciaux',
    label: 'Objectifs commerciaux',
    icon: Target,
    summary: 'Fixer, suivre et reconduire les objectifs.',
    keywords: 'objectifs conversions ca reconduire',
    content: (
      <BulletList
        items={[
          <>
            <strong>Commercial :</strong> voit son objectif sur le Dashboard et
            Statistiques (période en cours).
          </>,
          <>
            <strong>Manager / Admin / rôles groupe :</strong> définissent les
            objectifs depuis Utilisateurs (conversions + CA, Mois / Trimestre /
            Semestre / Année).
          </>,
          <>
            <strong>Reconduction :</strong> possible depuis Statistiques si
            l&apos;objectif n&apos;est pas atteint en fin de période.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'statistiques-rapports',
    label: 'Statistiques & Rapports',
    icon: ChartPie,
    summary: 'Répartitions, ventes, exports Excel.',
    keywords: 'statistiques rapports export excel type client source décideur',
    content: (
      <>
        <BulletList
          items={[
            <>
              <strong>Répartition des prospects :</strong> type de client, source,
              rôle du décideur, civilité, secteur, géographie, poste.
            </>,
            <>
              <strong>Résumé des ventes :</strong> période, filtre source /
              commercial ; KPIs leads, clients, CA ; tableaux détaillés.
            </>,
            <>
              <strong>Export Excel :</strong> tableau de bord téléchargeable avec
              les données du périmètre.
            </>,
            <>
              <strong>Filtres page :</strong> entreprise (rôles groupe) et
              commercial s&apos;appliquent à toute la page.
            </>,
          ]}
        />
        <Tip>
          Ouvrez{' '}
          <Link href='/stats' className='font-medium underline'>
            Statistiques
          </Link>{' '}
          pour le pilotage multi-entreprises et les exports.
        </Tip>
      </>
    ),
  },
  {
    id: 'utilisateurs-parametres',
    label: 'Utilisateurs & Paramètres',
    icon: Settings,
    summary: 'Comptes, rôles, organisation.',
    keywords: 'utilisateurs paramètres admin manager corbeille',
    content: (
      <BulletList
        items={[
          <>
            <strong>Utilisateurs :</strong> réservé Admin / Manager / rôles
            groupe — création, rôles, objectifs.
          </>,
          <>
            <strong>Paramètres :</strong> organisation, options selon
            configuration.
          </>,
          <>
            <strong>Corbeille :</strong> restauration / purge (managers, admins,
            rôles groupe). Les agents peuvent mettre à la corbeille leurs
            éléments sans accéder à la page Corbeille.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'recapitulatif-par-role',
    label: 'Récapitulatif par rôle',
    icon: Users,
    summary: 'Qui peut faire quoi dans le CRM.',
    keywords: 'rôles agent manager admin directrice pdg permissions',
    content: (
      <>
        <p className='mb-3 text-[12px] text-gray-600'>
          Les rôles groupe (directrice commerciale, PDG, directrice opération)
          ont une vision multi-entreprises proche du manager, avec filtre
          Holding / filiale.
        </p>
        <Table>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead>Fonctionnalité</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Admin / Groupe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className='font-medium'>
                Dashboard, Leads, Clients, Agenda
              </TableCell>
              <TableCell>Ses données</TableCell>
              <TableCell>Équipe (sa société)</TableCell>
              <TableCell>Global / filiales selon rôle</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className='font-medium'>Objectifs</TableCell>
              <TableCell>Consultation</TableCell>
              <TableCell>Définir / reconduire</TableCell>
              <TableCell>Idem</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className='font-medium'>Statistiques</TableCell>
              <TableCell>Objectifs perso</TableCell>
              <TableCell>Rapports + équipe</TableCell>
              <TableCell>Idem + multi-entreprises</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className='font-medium'>Utilisateurs</TableCell>
              <TableCell>
                <TableEmpty />
              </TableCell>
              <TableCell>Gestion équipe</TableCell>
              <TableCell>Idem</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className='font-medium'>Paramètres / Corbeille</TableCell>
              <TableCell>
                <TableEmpty />
              </TableCell>
              <TableCell>Oui</TableCell>
              <TableCell>Oui</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </>
    ),
  },
];

export default function GuidePage() {
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set([SECTIONS[0].id]),
  );
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => {
      const hay = `${s.label} ${s.summary} ${s.keywords}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const toggleSection = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = () => setOpenIds(new Set(filtered.map((s) => s.id)));
  const collapseAll = () => setOpenIds(new Set());

  const scrollToSection = (id: string) => {
    setOpenIds((prev) => new Set(prev).add(id));
    setActiveId(id);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      Boolean,
    ) as HTMLElement[];
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [filtered]);

  return (
    <DashboardShell
      title="Guide d'utilisation"
      subtitle="Essentiel pour utiliser KpiTracker au quotidien"
    >
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6'>
        {/* Sommaire sticky (desktop) */}
        <aside className='hidden lg:block w-56 shrink-0 sticky top-4 self-start'>
          <NeumoCard className='border border-gray-100 bg-white p-3 shadow-neu-soft'>
            <p className='mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400'>
              Sommaire
            </p>
            <nav className='flex flex-col gap-0.5' aria-label='Sommaire du guide'>
              {SECTIONS.map(({ id, label, icon: Icon }) => {
                const isActive = activeId === id;
                const isFilteredOut =
                  query.trim() !== '' && !filtered.some((s) => s.id === id);
                return (
                  <button
                    key={id}
                    type='button'
                    onClick={() => scrollToSection(id)}
                    disabled={isFilteredOut}
                    className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-medium transition ${
                      isFilteredOut
                        ? 'cursor-not-allowed text-gray-300'
                        : isActive
                          ? 'bg-primary text-white shadow-neu'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-primary'
                    }`}
                  >
                    <Icon className='h-3.5 w-3.5 shrink-0' strokeWidth={1.85} />
                    <span className='truncate'>{label}</span>
                  </button>
                );
              })}
            </nav>
          </NeumoCard>
        </aside>

        <div className='min-w-0 flex-1 flex flex-col gap-4'>
          {/* Barre outils */}
          <NeumoCard className='border border-gray-100 bg-white p-3 sm:p-4 shadow-neu-soft'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='relative min-w-0 flex-1'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
                <input
                  type='search'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Rechercher dans le guide…'
                  className='w-full rounded-full border border-gray-200 bg-bgGray/50 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/15'
                  aria-label='Rechercher dans le guide'
                />
              </div>
              <div className='flex shrink-0 gap-2'>
                <button
                  type='button'
                  onClick={expandAll}
                  className='rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:text-primary'
                >
                  Tout ouvrir
                </button>
                <button
                  type='button'
                  onClick={collapseAll}
                  className='rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:text-primary'
                >
                  Tout fermer
                </button>
              </div>
            </div>

            {/* Chips mobile / tablette */}
            <nav
              className='mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden'
              aria-label='Sections du guide'
            >
              {filtered.map(({ id, label }) => (
                <button
                  key={id}
                  type='button'
                  onClick={() => scrollToSection(id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                    activeId === id
                      ? 'bg-primary text-white'
                      : 'border border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </NeumoCard>

          {filtered.length === 0 ? (
            <NeumoCard className='border border-gray-100 bg-white p-6 text-center shadow-neu-soft'>
              <p className='text-sm text-gray-600'>Aucun résultat pour « {query} ».</p>
              <button
                type='button'
                onClick={() => setQuery('')}
                className='mt-2 text-[11px] font-medium text-primary hover:underline'
              >
                Effacer la recherche
              </button>
            </NeumoCard>
          ) : (
            filtered.map((section) => {
              const Icon = section.icon;
              const isOpen = openIds.has(section.id);
              return (
                <section
                  key={section.id}
                  id={section.id}
                  className='scroll-mt-4'
                >
                  <NeumoCard className='overflow-hidden border border-gray-100 bg-white shadow-neu-soft'>
                    <button
                      type='button'
                      onClick={() => toggleSection(section.id)}
                      className='flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50/80 sm:px-5'
                      aria-expanded={isOpen}
                      aria-controls={`${section.id}-panel`}
                    >
                      <span className='mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                        <Icon className='h-4 w-4' strokeWidth={1.85} />
                      </span>
                      <span className='min-w-0 flex-1'>
                        <span className='block text-sm font-semibold text-gray-800'>
                          {section.label}
                        </span>
                        <span className='mt-0.5 block text-[11px] text-gray-500'>
                          {section.summary}
                        </span>
                      </span>
                      <ChevronDown
                        className={`mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div
                        id={`${section.id}-panel`}
                        className='border-t border-gray-100 px-4 py-4 sm:px-5'
                      >
                        {section.content}
                      </div>
                    )}
                  </NeumoCard>
                </section>
              );
            })
          )}

          <p className='pb-2 text-center text-[11px] text-gray-400'>
            Une question ? Contactez votre administrateur ou le support
            KpiTracker.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
