'use client';

import { Field } from '@/components/ui/field';
import { fetchApi, readApiError } from '@/lib/fetch-api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export default function LoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    setLoading(true);
    setError(null);

    try {
      const res = await fetchApi('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error(
          await readApiError(res, 'Impossible de se connecter'),
        );
      }

      const data = await res.json();

      if (data.requiresMfa) {
        const from =
          new URLSearchParams(window.location.search).get('from') || '';
        const mfaUrl = from
          ? `/login/mfa?from=${encodeURIComponent(from)}`
          : '/login/mfa';
        router.push(mfaUrl);
        return;
      }

      if (data.mustChangePassword) {
        router.replace('/reset-password');
        return;
      }

      // Connexion sans MFA : on affiche un toast puis on redirige vers la page d'origine (from) ou le dashboard.
      const params = new URLSearchParams(window.location.search);
      const from = params.get('from');
      const target = from && from !== '/login' ? from : '/';

      setSuccess('Connexion réussie');
      window.dispatchEvent(new Event('auth:changed'));
      // On attend 1500ms pour laisser le toast s'afficher puis on force une navigation complète
      // pour garantir la prise en compte des cookies en prod (Vercel).
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.href = target;
        }, 1500);
      } else {
        router.replace(target);
      }
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Impossible de joindre le serveur. Vérifiez que l'application Node.js est démarrée sur cPanel.",
        );
        return;
      }
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex flex-col lg:flex-row bg-primary text-slate-900'>
      {/* Colonne gauche : formulaire — teintes primary / neutres du CRM */}
      <div className='w-full lg:w-1/2 flex items-center justify-center px-4 py-10 bg-linear-to-br from-bgGray via-white to-gray-100 relative overflow-hidden'>
        <div
          className='pointer-events-none absolute inset-0 opacity-[0.45]'
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(17, 17, 17, 0.06), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(17, 17, 17, 0.05), transparent 50%)',
          }}
        />
        <div className='w-full max-w-md space-y-8 relative z-10'>
          <div className='space-y-4'>
            <Link href='/' className='inline-block'>
              <img
                src='/kpitracker-logo.png'
                alt='KPI TRACKER — CRM de gestion des prospects et suivi des objectifs commerciaux'
                width={280}
                height={120}
                className='h-16 w-auto max-w-[280px] object-contain drop-shadow-sm sm:h-[4.5rem]'
              />
            </Link>
            <div className='space-y-1 pt-2'>
              <h1 className='text-2xl font-semibold text-primary'>
                Connexion
              </h1>
              <p className='text-sm text-slate-600'>
                Utilisez de préférence votre adresse email professionnelle.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className='space-y-4 rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-neu-soft backdrop-blur-sm'
          >
            <div className='space-y-4'>
              <Field
                name='email'
                type='email'
                label='Adresse email'
                placeholder='vous@entreprise.ci'
                required
              />
              <Field
                name='password'
                type='password'
                label='Mot de passe'
                placeholder='Votre mot de passe'
                required
              />
              <div className='flex items-center justify-end'>
                <Link
                  href='/forgot-password'
                  className='text-xs font-medium text-primary hover:underline'
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            </div>

            {error && (
              <p className='text-xs text-rose-600 border border-rose-100 bg-rose-50/90 rounded-lg px-3 py-2'>
                {error}
              </p>
            )}

            <button
              type='submit'
              disabled={loading}
              className='mt-1 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-neu transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed'
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className='space-y-1.5 text-[11px] text-slate-600'>
            <p>
              Pas encore de compte ?{' '}
              <span className='font-medium text-primary'>
                Contactez l&apos;administrateur.
              </span>
            </p>
            <p className='text-[10px] leading-relaxed text-slate-500'>
              En vous connectant, vous acceptez nos{' '}
              <a
                href='/legal/cgu'
                className='font-medium text-primary hover:underline'
              >
                Conditions d&apos;utilisation
              </a>{' '}
              et notre{' '}
              <a
                href='/legal/confidentialite'
                className='font-medium text-primary hover:underline'
              >
                Politique de confidentialité
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Colonne droite : fond primary */}
      <div className='hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center'>
        <div className='absolute inset-0 bg-linear-to-br from-[#111111] via-[#1a1a1a] to-[#2a2a2a]' />
        <div
          className='absolute inset-0 opacity-40'
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.08), transparent 45%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.05), transparent 40%)',
          }}
        />
        <div className='absolute inset-0 opacity-[0.07] bg-size-[24px_24px] bg-[linear-gradient(to_right,rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.35)_1px,transparent_1px)]' />

        <div className='relative z-10 flex flex-col items-center gap-10 px-10 max-w-lg'>
          <div className='rounded-2xl bg-white px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)]'>
            <img
              src='/kpitracker-logo.png'
              alt='KPI TRACKER — CRM de gestion des prospects et suivi des objectifs commerciaux'
              width={320}
              height={140}
              className='h-20 w-auto max-w-[300px] object-contain'
            />
          </div>
          <div className='space-y-5 text-center lg:text-left w-full'>
            <span className='inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 ring-1 ring-white/20'>
              Pipeline commercial en temps réel
            </span>
            <h2 className='text-2xl md:text-3xl font-semibold text-white tracking-tight'>
              Suivez vos commerciaux, objectifs et rendez-vous en un seul clic.
            </h2>
            <p className='text-sm text-white/75 leading-relaxed'>
              Centralisez votre prospection, vos relances et vos ventes avec les
              couleurs et l&apos;esprit KpiTracker : clarté, indicateurs et
              performance. Visualisez vos résultats et atteignez vos objectifs
              plus rapidement.
            </p>
          </div>
        </div>
      </div>

      {success && (
        <div className='fixed bottom-4 right-4 z-50'>
          <div className='rounded-xl bg-emerald-600 text-white text-xs px-4 py-3 shadow-lg shadow-emerald-500/30'>
            {success}
          </div>
        </div>
      )}
    </div>
  );
}
