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
    <div className='min-h-screen flex flex-col lg:flex-row bg-[#041e3a] text-slate-900'>
      {/* Colonne gauche : formulaire — teintes dérivées du logo (sky / cyan / bleu) */}
      <div className='w-full lg:w-1/2 flex items-center justify-center px-4 py-10 bg-linear-to-br from-sky-50 via-white to-cyan-50/90 relative overflow-hidden'>
        <div
          className='pointer-events-none absolute inset-0 opacity-[0.45]'
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(14, 165, 233, 0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(29, 78, 216, 0.12), transparent 50%)',
          }}
        />
        <div className='w-full max-w-md space-y-8 relative z-10'>
          <div className='space-y-4'>
            <Link href='/' className='inline-block'>
              <img
                src='https://www.appatam.com/wp-content/uploads/2020/01/Appatam-Logo-contact.png'
                alt='KpiTracker'
                width={200}
                height={48}
                className='h-11 w-auto drop-shadow-sm'
                // priority
              />
            </Link>
            <div className='space-y-1 pt-2'>
              <h1 className='text-2xl font-semibold bg-linear-to-r from-sky-800 to-blue-900 bg-clip-text text-transparent'>
                Connexion
              </h1>
              <p className='text-sm text-slate-600'>
                Utilisez de préférence votre adresse email professionnelle.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className='space-y-4 rounded-2xl border border-sky-200/70 bg-white/90 p-6 shadow-[0_8px_30px_rgba(14,165,233,0.12)] backdrop-blur-sm'
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
                  className='text-xs font-medium text-sky-700 hover:text-blue-800 hover:underline'
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
              className='mt-1 inline-flex w-full items-center justify-center rounded-xl bg-linear-to-r from-sky-500 via-sky-600 to-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-sky-500/25 transition hover:from-sky-600 hover:via-sky-700 hover:to-blue-800 disabled:opacity-60 disabled:cursor-not-allowed'
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className='space-y-1.5 text-[11px] text-slate-600'>
            <p>
              Pas encore de compte ?{' '}
              <span className='font-medium text-sky-700'>
                Contactez l&apos;administrateur.
              </span>
            </p>
            <p className='text-[10px] leading-relaxed text-slate-500'>
              En vous connectant, vous acceptez nos{' '}
              <span className='font-medium text-sky-700'>
                Conditions d&apos;utilisation
              </span>{' '}
              et notre{' '}
              <span className='font-medium text-sky-700'>
                Politique de confidentialité
              </span>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Colonne droite : même profondeur que le dégradé du logo */}
      <div className='hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center'>
        <div className='absolute inset-0 bg-linear-to-br from-[#041e3a] via-[#0c4a6e] to-[#1d4ed8]' />
        <div
          className='absolute inset-0 opacity-50'
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 20%, rgba(34, 211, 238, 0.25), transparent 45%), radial-gradient(circle at 80% 80%, rgba(14, 165, 233, 0.2), transparent 40%)',
          }}
        />
        <div className='absolute inset-0 opacity-[0.07] bg-size-[24px_24px] bg-[linear-gradient(to_right,rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.35)_1px,transparent_1px)]' />

        <div className='relative z-10 flex flex-col items-center gap-10 px-10 max-w-lg'>
          <img
            src='https://www.appatam.com/wp-content/uploads/2020/01/Appatam-Logo-contact.png'
            alt=''
            width={240}
            height={58}
            className='h-14 w-auto opacity-95 drop-shadow-[0_4px_24px_rgba(34,211,238,0.35)]'
          />
          <div className='space-y-5 text-center lg:text-left w-full'>
            <span className='inline-flex items-center rounded-full bg-cyan-400/15 px-3 py-1 text-[11px] font-medium text-cyan-100 ring-1 ring-cyan-300/30'>
              Pipeline commercial en temps réel
            </span>
            <h2 className='text-2xl md:text-3xl font-semibold text-white tracking-tight'>
              Suivez vos commerciaux, objectifs et rendez-vous en un seul clic.
            </h2>
            <p className='text-sm text-sky-100/90 leading-relaxed'>
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
