'use client';

import { Field } from '@/components/ui/field';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useEffect, useState, type FormEvent } from 'react';

interface UserPasswordSheetProps {
  open: boolean;
  user: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}

export function UserPasswordSheet({
  open,
  user,
  onOpenChange,
}: UserPasswordSheetProps) {
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setPasswordConfirm('');
      setError(null);
      setDone(false);
    }
  }, [open, user?.id]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    if (password !== passwordConfirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${user.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          data.error || 'Impossible de modifier le mot de passe.',
        );
      }
      setDone(true);
      setTimeout(() => onOpenChange(false), 900);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur inattendue.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className='flex flex-col gap-1'>
            <SheetTitle>Modifier le mot de passe</SheetTitle>
            <SheetDescription>
              Définissez un nouveau mot de passe pour {user?.name ?? 'ce membre'}.
              Il devra le changer à sa prochaine connexion.
            </SheetDescription>
          </div>
          <SheetClose className='w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center'>
            ✕
          </SheetClose>
        </SheetHeader>

        <form onSubmit={handleSubmit} className='mt-4 flex flex-col gap-3 text-xs'>
          <Field
            label='Nouveau mot de passe'
            name='password'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='Min. 6 caractères'
            required
            minLength={6}
            disabled={loading || done}
          />
          <Field
            label='Confirmer le mot de passe'
            name='passwordConfirm'
            type='password'
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder='Retapez le mot de passe'
            required
            minLength={6}
            disabled={loading || done}
          />

          {error && <p className='text-[11px] text-rose-500 mt-1'>{error}</p>}
          {done && (
            <p className='text-[11px] text-emerald-600 mt-1'>
              Mot de passe mis à jour. Communiquez-le à l&apos;utilisateur.
            </p>
          )}

          <div className='mt-4 flex justify-end gap-2'>
            <SheetClose className='px-3 py-1.5 rounded-full text-[11px] bg-gray-100 text-gray-600'>
              Annuler
            </SheetClose>
            <button
              type='submit'
              disabled={loading || done}
              className='px-4 py-1.5 rounded-full text-[11px] bg-primary text-white shadow-neu disabled:opacity-60'
            >
              {loading ? 'En cours...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
