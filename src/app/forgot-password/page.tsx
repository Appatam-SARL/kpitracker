'use client';

import { Field } from '@/components/ui/field';
import { fetchApi, readApiError } from '@/lib/fetch-api';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

const BRAND_LOGO_SRC =
  'https://www.appatam.com/wp-content/uploads/2020/01/Appatam-Logo-contact.png';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const email = String(formData.get('email') ?? '').trim();

      const res = await fetchApi('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        throw new Error(
          await readApiError(
            res,
            "Impossible d'envoyer le lien de réinitialisation.",
          ),
        );
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'envoi du lien.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex flex-col lg:flex-row bg-[#041e3a] text-slate-900'>
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
            <Link href='/login' className='inline-block'>
              <img
                src={BRAND_LOGO_SRC}
                alt='KpiTracker'
                width={200}
                height={48}
                className='h-11 w-auto drop-shadow-sm'
              />
            </Link>
            <div className='space-y-1 pt-2'>
              <h1 className='text-2xl font-semibold bg-linear-to-r from-sky-800 to-blue-900 bg-clip-text text-transparent'>
                Mot de passe oublié
              </h1>
              <p className='text-sm text-slate-600'>
                Entrez l&apos;adresse email de votre compte pour recevoir un
                lien de réinitialisation.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className='space-y-4 rounded-2xl border border-sky-200/70 bg-white/90 p-6 shadow-[0_8px_30px_rgba(14,165,233,0.12)] backdrop-blur-sm'
          >
            <Field
              name='email'
              type='email'
              label='Adresse email'
              placeholder='vous@entreprise.ci'
              required
              disabled={loading || sent}
            />

            {error && (
              <p className='text-xs text-rose-600 border border-rose-100 bg-rose-50/90 rounded-lg px-3 py-2'>
                {error}
              </p>
            )}

            {sent && !error && (
              <p className='text-xs text-emerald-700 border border-emerald-100 bg-emerald-50/90 rounded-lg px-3 py-2'>
                Si un compte existe pour cet email, un lien vient d&apos;être
                envoyé.
              </p>
            )}

            <button
              type='submit'
              disabled={loading || sent}
              className='inline-flex w-full items-center justify-center rounded-xl bg-linear-to-r from-sky-500 via-sky-600 to-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-sky-500/25 transition hover:from-sky-600 hover:via-sky-700 hover:to-blue-800 disabled:opacity-60 disabled:cursor-not-allowed'
            >
              {loading
                ? 'Envoi en cours...'
                : sent
                  ? 'Lien envoyé'
                  : 'Envoyer le lien de réinitialisation'}
            </button>
          </form>

          <Link
            href='/login'
            className='inline-block text-xs font-medium text-sky-700 hover:text-blue-800 hover:underline'
          >
            Retour à la connexion
          </Link>

          <p className='text-[10px] leading-relaxed text-slate-500'>
            En poursuivant, vous acceptez nos{' '}
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
            src={BRAND_LOGO_SRC}
            alt=''
            width={240}
            height={58}
            className='h-14 w-auto opacity-95 drop-shadow-[0_4px_24px_rgba(34,211,238,0.35)]'
          />
          <div className='space-y-5 text-center lg:text-left w-full'>
            <span className='inline-flex items-center rounded-full bg-cyan-400/15 px-3 py-1 text-[11px] font-medium text-cyan-100 ring-1 ring-cyan-300/30'>
              <span className='w-2 h-2 rounded-full bg-emerald-400 mr-2' />
              Sécurité & récupération de compte
            </span>
            <h2 className='text-2xl md:text-3xl font-semibold text-white tracking-tight'>
              Récupérez l&apos;accès à votre espace en toute simplicité.
            </h2>
            <p className='text-sm text-sky-100/90 leading-relaxed'>
              Saisissez votre email professionnel : nous vous envoyons un lien
              sécurisé pour choisir un nouveau mot de passe et retrouver vos
              indicateurs sur KpiTracker.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
