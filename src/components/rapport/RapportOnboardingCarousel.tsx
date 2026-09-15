'use client';

import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import {
  Archive,
  Download,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Slide = {
  id: string;
  badge: string;
  title: string;
  description: string;
  cta: string;
  ctaHref?: string;
  tone: {
    panel: string;
    badge: string;
    badgeText: string;
    accent: string;
    iconWrap: string;
  };
  Icon: LucideIcon;
};

const SLIDES: Slide[] = [
  {
    id: 'generate',
    badge: 'Rapports',
    title: 'Pilotez vos synthèses',
    description:
      'Générez une synthèse des ventes par commerciale, période et source — le rapport est enregistré automatiquement.',
    cta: 'Générer une synthèse',
    ctaHref: '#rapport-generer',
    tone: {
      panel: 'bg-emerald-500',
      badge: 'bg-emerald-700/35',
      badgeText: 'text-white',
      accent: 'bg-amber-300',
      iconWrap: 'bg-white/15 text-white',
    },
    Icon: FileText,
  },
  {
    id: 'export',
    badge: 'Exports',
    title: 'PDF, Excel et Word',
    description:
      'Téléchargez chaque synthèse au format souhaité pour partager les performances avec votre équipe.',
    cta: 'Voir les rapports',
    ctaHref: '#rapport-liste',
    tone: {
      panel: 'bg-sky-600',
      badge: 'bg-sky-900/30',
      badgeText: 'text-white',
      accent: 'bg-amber-300',
      iconWrap: 'bg-white/15 text-white',
    },
    Icon: Download,
  },
  {
    id: 'archive',
    badge: 'Historique',
    title: 'Détail et archivage',
    description:
      'Consultez le détail d’un rapport, puis archivez-le. Un rapport archivé ne peut plus être ni modifié ni supprimé.',
    cta: 'Voir les archives',
    ctaHref: '#rapport-liste',
    tone: {
      panel: 'bg-slate-800',
      badge: 'bg-white/15',
      badgeText: 'text-white',
      accent: 'bg-amber-300',
      iconWrap: 'bg-white/10 text-white',
    },
    Icon: Archive,
  },
];

const SWIPE_OFFSET = 60;
const AUTO_MS = 6500;

type RapportOnboardingCarouselProps = {
  onShowArchived?: () => void;
};

export default function RapportOnboardingCarousel({
  onShowArchived,
}: RapportOnboardingCarouselProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const goTo = useCallback((next: number, dir?: number) => {
    const len = SLIDES.length;
    const normalized = ((next % len) + len) % len;
    setDirection(dir ?? (normalized > index ? 1 : -1));
    setIndex(normalized);
  }, [index]);

  const goNext = useCallback(() => goTo(index + 1, 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1, -1), [goTo, index]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % SLIDES.length);
    }, AUTO_MS);
    return () => window.clearInterval(timer);
  }, [index]);

  const onDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.x < -SWIPE_OFFSET) goNext();
    else if (info.offset.x > SWIPE_OFFSET) goPrev();
  };

  const slide = SLIDES[index];
  const Icon = slide.Icon;

  const handleCta = () => {
    if (slide.id === 'archive') {
      onShowArchived?.();
    }
    const target = slide.ctaHref;
    if (target?.startsWith('#')) {
      document.querySelector(target)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  return (
    <div className='relative overflow-hidden rounded-3xl shadow-neu-soft'>
      <AnimatePresence initial={false} custom={direction} mode='popLayout'>
        <motion.div
          key={slide.id}
          custom={direction}
          variants={{
            enter: (dir: number) => ({
              x: dir > 0 ? '100%' : '-100%',
              opacity: 0.85,
            }),
            center: { x: 0, opacity: 1 },
            exit: (dir: number) => ({
              x: dir > 0 ? '-100%' : '100%',
              opacity: 0.85,
            }),
          }}
          initial='enter'
          animate='center'
          exit='exit'
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          drag='x'
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={onDragEnd}
          className={`relative flex min-h-[168px] cursor-grab touch-pan-y select-none flex-col justify-between gap-4 px-5 py-5 active:cursor-grabbing sm:min-h-[180px] sm:flex-row sm:items-center sm:px-7 sm:py-6 ${slide.tone.panel}`}
        >
          <div className='relative z-10 flex max-w-xl flex-col gap-3'>
            <span
              className={`inline-flex w-fit rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${slide.tone.badge} ${slide.tone.badgeText}`}
            >
              {slide.badge}
            </span>
            <div>
              <h2 className='text-xl font-bold tracking-tight text-white sm:text-2xl'>
                {slide.title}
              </h2>
              <p className='mt-1.5 text-[12px] leading-relaxed text-white/90 sm:text-[13px]'>
                {slide.description}
              </p>
            </div>
            <button
              type='button'
              onClick={handleCta}
              className='inline-flex w-fit items-center rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-gray-900 shadow-sm transition hover:bg-white/95'
            >
              {slide.cta}
            </button>
          </div>

          <div className='pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] sm:block'>
            <div className='absolute -right-6 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-white/10 blur-2xl' />
            <div
              className={`absolute right-6 top-1/2 flex h-24 w-24 -translate-y-1/2 items-center justify-center rounded-3xl shadow-lg backdrop-blur-sm ${slide.tone.iconWrap}`}
            >
              <Icon className='h-11 w-11' strokeWidth={1.5} />
            </div>
            {slide.id === 'export' && (
              <FileSpreadsheet className='absolute right-28 top-8 h-7 w-7 text-white/50' />
            )}
          </div>

          <div className='relative z-10 flex items-center justify-center gap-2 sm:absolute sm:bottom-4 sm:left-1/2 sm:z-20 sm:-translate-x-1/2'>
            {SLIDES.map((s, i) => {
              const active = i === index;
              return (
                <button
                  key={s.id}
                  type='button'
                  aria-label={`Slide ${i + 1}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => goTo(i, i > index ? 1 : -1)}
                  className={`h-2 rounded-full transition-all ${
                    active
                      ? `w-7 ${slide.tone.accent}`
                      : 'w-2 bg-white/55 hover:bg-white/80'
                  }`}
                />
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
