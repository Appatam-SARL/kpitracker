'use client';

import { cn } from '@/components/ui/utils';
import { hideBootSplash } from '@/lib/boot-splash';
import { ArrowRight, BarChart3, CalendarDays, Target, Users } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export const ONBOARDING_STORAGE_KEY = 'kpitracker-onboarding-done';

const SLIDES = [
  {
    id: 'prospects',
    eyebrow: 'Pipeline commercial',
    title: 'Pilotez vos prospects',
    description:
      'Centralisez leads, contacts et stades d’avancement pour ne perdre aucune opportunité.',
    points: [
      'Fiches prospects et contacts enrichies',
      'Kanban et suivi du cycle de vente',
      'Pièces jointes et historique d’actions',
    ],
    panelQuote:
      'De la qualification à la conversion, chaque opportunité reste visible et actionnable.',
    panelMeta: 'Prospects · Contacts · Clients',
    icon: Users,
  },
  {
    id: 'agenda',
    eyebrow: 'Organisation',
    title: 'Agenda & activités',
    description:
      'Planifiez relances, rendez-vous et tâches pour garder le rythme commercial de l’équipe.',
    points: [
      'Agenda partagé par commerciale',
      'Relances et RDV liés aux fiches',
      'Priorités du jour en un coup d’œil',
    ],
    panelQuote:
      'Un CRM utile au quotidien : ce qui compte apparaît dans l’agenda, pas dans une note perdue.',
    panelMeta: 'Agenda · Relances · Suivi',
    icon: CalendarDays,
  },
  {
    id: 'stats',
    eyebrow: 'Pilotage',
    title: 'Objectifs, stats & rapports',
    description:
      'Mesurez la performance, suivez les objectifs et exportez des rapports commerciaux clairs.',
    points: [
      'Objectifs de conversion et de CA',
      'Statistiques par source et type client',
      'Rapports exportables pour le management',
    ],
    panelQuote:
      'Des indicateurs concrets pour piloter l’équipe et décider plus vite.',
    panelMeta: 'Stats · Objectifs · Rapports',
    icon: BarChart3,
  },
] as const;

type SplashScreenProps = {
  onContinue: () => void;
};

export default function SplashScreen({ onContinue }: SplashScreenProps) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const Icon = slide.icon;

  useEffect(() => {
    hideBootSplash();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className='fixed inset-0 z-100 flex items-center justify-center bg-[#0f1412] p-3 sm:p-6'
      role='dialog'
      aria-modal='true'
      aria-label='Présentation de KpiTracker'
    >
      <div className='flex h-full max-h-[860px] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1412] shadow-2xl lg:h-[min(720px,90vh)]'>
        {/* Panneau gauche */}
        <div className='flex w-full flex-col bg-white px-6 py-7 sm:px-10 sm:py-9 lg:w-[46%]'>
          <Image
            src='/kpitracker-logo.png'
            alt='KpiTracker'
            width={280}
            height={118}
            priority
            className='h-14 w-auto object-contain sm:h-16'
          />

          <div className='mt-10 flex flex-1 flex-col'>
            <p className='text-[11px] font-medium uppercase tracking-[0.14em] text-gray-400'>
              {slide.eyebrow}
            </p>
            <h1 className='mt-3 text-3xl font-semibold tracking-tight text-primary sm:text-4xl'>
              {slide.title}
            </h1>
            <p className='mt-3 max-w-md text-sm leading-relaxed text-gray-500'>
              {slide.description}
            </p>

            <ul className='mt-8 space-y-3'>
              {slide.points.map((point) => (
                <li
                  key={point}
                  className='flex items-start gap-3 rounded-2xl border border-gray-100 bg-bgGray/60 px-3.5 py-3'
                >
                  <span className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white'>
                    <Icon className='h-4 w-4' aria-hidden />
                  </span>
                  <span className='pt-1.5 text-[13px] font-medium text-primary'>
                    {point}
                  </span>
                </li>
              ))}
            </ul>

            <div className='mt-6 flex items-center gap-2 lg:hidden'>
              {SLIDES.map((item, i) => (
                <button
                  key={item.id}
                  type='button'
                  aria-label={`Slide ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'h-2.5 rounded-full transition-all',
                    i === index
                      ? 'w-2.5 border border-primary bg-transparent'
                      : 'w-2.5 bg-gray-300 hover:bg-gray-400',
                  )}
                />
              ))}
            </div>
          </div>

          <div className='mt-8 flex flex-col gap-3 sm:flex-row sm:items-center'>
            <button
              type='button'
              onClick={onContinue}
              className='inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white transition-opacity hover:opacity-90'
            >
              Continuer
              <ArrowRight className='h-4 w-4' aria-hidden />
            </button>
            <button
              type='button'
              onClick={onContinue}
              className='text-sm text-gray-500 underline-offset-4 transition-colors hover:text-primary hover:underline'
            >
              Passer à la connexion
            </button>
          </div>
        </div>

        {/* Panneau droit */}
        <div className='relative hidden flex-1 flex-col justify-end overflow-hidden bg-[#15201c] px-10 py-10 lg:flex'>
          <div
            className='pointer-events-none absolute inset-0 opacity-[0.35]'
            aria-hidden
            style={{
              backgroundImage: `
                linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.04) 41%, transparent 41%),
                linear-gradient(210deg, transparent 55%, rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.03) 56%, transparent 56%),
                linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
              `,
              backgroundSize: '100% 100%, 100% 100%, 64px 64px, 64px 64px',
            }}
          />
          <div
            className='pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full border border-white/10'
            aria-hidden
          />
          <div
            className='pointer-events-none absolute right-24 top-28 h-40 w-40 rounded-full border border-white/5'
            aria-hidden
          />

          <div className='relative z-10 mb-auto flex justify-end pt-2'>
            <span className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70'>
              <Target className='h-3.5 w-3.5' aria-hidden />
              CRM commercial
            </span>
          </div>

          <div className='relative z-10 max-w-lg space-y-4'>
            <p
              key={slide.id}
              className='text-2xl font-medium leading-snug tracking-tight text-white transition-opacity duration-500 sm:text-[1.65rem]'
            >
              “{slide.panelQuote}”
            </p>
            <p className='text-sm text-white/45'>{slide.panelMeta}</p>
          </div>

          <div className='relative z-10 mt-10 flex items-center gap-2'>
            {SLIDES.map((item, i) => (
              <button
                key={item.id}
                type='button'
                aria-label={`Slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-2.5 rounded-full transition-all',
                  i === index
                    ? 'w-2.5 border border-white bg-transparent'
                    : 'w-2.5 bg-white/35 hover:bg-white/55',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
