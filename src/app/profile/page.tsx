'use client';

import { EmailSignatureSettings } from '@/components/profile/EmailSignatureSettings';
import { ProfileActionHistory } from '@/components/profile/ProfileActionHistory';
import NeumoCard from '@/components/NeumoCard';
import { withDashboardLayout } from '@/components/layouts/withDashboardLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import {
  getRoleLabel,
  hasGroupCompanyScopeFrontend,
  isAdminOrManagerLike,
  normalizeFrontendRole,
} from '@/lib/roles';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Shield,
  Smartphone,
  Target,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

interface GoalWithRealized {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  targetConversions: number;
  targetRevenue: number;
  realizedConversions: number;
  realizedRevenue: number;
}

type ProfileUser = {
  name: string;
  email: string;
  role: string;
  mfaEnabled?: boolean;
  mfaSetupPending?: boolean;
  company?: { id: string; name: string };
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function displayRole(role: string): string {
  return getRoleLabel(normalizeFrontendRole(role));
}

function ProfilePageInner({
  viewedUserId: viewedUserIdProp,
}: {
  viewedUserId?: string | null;
}) {
  const { user: authUser } = useAuth();
  const viewedUserId = viewedUserIdProp ?? null;
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [editingField, setEditingField] = useState<'name' | 'email' | null>(
    null,
  );
  const [pendingValue, setPendingValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [passwordStatus, setPasswordStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [mfaSaving, setMfaSaving] = useState(false);
  const [mfaSetupStep, setMfaSetupStep] = useState<{
    qrCodeDataUrl: string;
    secret: string;
  } | null>(null);
  const [mfaOtpCode, setMfaOtpCode] = useState('');
  const [mfaVerifyError, setMfaVerifyError] = useState<string | null>(null);
  const [mfaVerifyLoading, setMfaVerifyLoading] = useState(false);
  const [goals, setGoals] = useState<GoalWithRealized[]>([]);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const isSelf = !viewedUserId || (authUser && viewedUserId === authUser.id);
  const isManagerOrAdmin = isAdminOrManagerLike(authUser?.role);
  const canEditIdentity = !!isSelf;

  const buildGoalsUrl = (targetId: string, targetCompanyId?: string) => {
    if (authUser?.role === 'agent' && !viewedUserId) {
      return '/api/goals';
    }
    const params = new URLSearchParams({ userId: targetId });
    if (
      targetCompanyId &&
      hasGroupCompanyScopeFrontend(authUser?.role) &&
      targetCompanyId !== authUser?.company?.id
    ) {
      params.set('companyId', targetCompanyId);
    }
    return `/api/goals?${params.toString()}`;
  };

  useEffect(() => {
    (async () => {
      try {
        setLoadingUser(true);
        if (!authUser) {
          setUser(null);
          return;
        }
        const targetId = viewedUserId ?? authUser.id;

        if (
          !viewedUserId ||
          viewedUserId === authUser.id ||
          authUser.role === 'agent'
        ) {
          const res = await fetch('/api/auth/me');
          if (!res.ok) {
            setUser(null);
            return;
          }
          const data = await res.json();
          setUser({
            name: data.name,
            email: data.email,
            role: data.role,
            mfaEnabled: data.mfaEnabled,
            mfaSetupPending: data.mfaSetupPending,
            company: data.company
              ? { id: data.company.id, name: data.company.name }
              : undefined,
          });
          return;
        }

        const res = await fetch(`/api/users/${encodeURIComponent(targetId)}`);
        if (!res.ok) {
          setUser(null);
          return;
        }
        const found = await res.json();
        setUser({
          name: found.name,
          email: found.email,
          role: (found.role ?? '').toString(),
          company: found.company
            ? { id: found.company.id, name: found.company.name }
            : undefined,
        });
      } catch {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    })();
  }, [authUser, viewedUserId]);

  useEffect(() => {
    (async () => {
      try {
        if (!authUser) return;
        const targetId = viewedUserId ?? authUser.id;
        const res = await fetch(buildGoalsUrl(targetId, user?.company?.id));
        if (!res.ok) return;
        const data = await res.json();
        setGoals(data);
      } catch {
        // silencieux
      }
    })();
  }, [authUser, viewedUserId, user?.company?.id]);

  const refreshUser = async () => {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return;
    const data = await res.json();
    setUser((prev) => ({
      name: data.name,
      email: data.email,
      role: data.role,
      mfaEnabled: data.mfaEnabled ?? prev?.mfaEnabled,
      mfaSetupPending: data.mfaSetupPending ?? prev?.mfaSetupPending,
      company: data.company,
    }));
  };

  const startEditing = (field: 'name' | 'email') => {
    if (!user || !canEditIdentity) return;
    setProfileStatus({ type: null, message: '' });
    setEditingField(field);
    setPendingValue(field === 'name' ? user.name : user.email);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setPendingValue('');
  };

  const saveField = async () => {
    if (!user || !editingField) return;
    const trimmed = pendingValue.trim();
    if (
      !trimmed ||
      trimmed === (editingField === 'name' ? user.name : user.email)
    ) {
      cancelEditing();
      return;
    }
    try {
      setSaving(true);
      setProfileStatus({ type: null, message: '' });
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editingField]: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setProfileStatus({
          type: 'error',
          message: data?.error ?? 'Impossible d’enregistrer la modification.',
        });
        return;
      }
      const updated = await res.json();
      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: updated.name ?? prev.name,
              email: updated.email ?? prev.email,
              company: updated.company ?? prev.company,
            }
          : prev,
      );
      setProfileStatus({
        type: 'success',
        message:
          editingField === 'name'
            ? 'Nom mis à jour.'
            : 'Adresse email mise à jour.',
      });
      cancelEditing();
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void saveField();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  const handleChangePassword = async () => {
    setPasswordStatus({ type: null, message: '' });
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({
        type: 'error',
        message: 'Tous les champs sont obligatoires.',
      });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus({
        type: 'error',
        message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: 'error',
        message: 'La confirmation ne correspond pas au nouveau mot de passe.',
      });
      return;
    }
    try {
      setSaving(true);
      const res = await fetch('/api/profile/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setPasswordStatus({
          type: 'error',
          message:
            data?.error ??
            'Impossible de changer le mot de passe. Vérifiez le mot de passe actuel.',
        });
        return;
      }
      setPasswordStatus({
        type: 'success',
        message: 'Mot de passe mis à jour avec succès.',
      });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } finally {
      setSaving(false);
    }
  };

  const startMfaSetup = async () => {
    if (!user) return;
    try {
      setMfaSaving(true);
      setMfaVerifyError(null);
      const res = await fetch('/api/profile/mfa/setup', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMfaVerifyError(
          data?.error ?? 'Impossible de démarrer la configuration.',
        );
        return;
      }
      const data = await res.json();
      setMfaSetupStep({
        qrCodeDataUrl: data.qrCodeDataUrl,
        secret: data.secret,
      });
      await refreshUser();
    } finally {
      setMfaSaving(false);
    }
  };

  const verifyMfaCode = async () => {
    const code = mfaOtpCode.replace(/\s/g, '');
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setMfaVerifyError('Saisissez un code à 6 chiffres.');
      return;
    }
    try {
      setMfaVerifyLoading(true);
      setMfaVerifyError(null);
      const res = await fetch('/api/profile/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMfaVerifyError(data?.error ?? 'Code invalide ou expiré.');
        return;
      }
      setMfaSetupStep(null);
      setMfaOtpCode('');
      await refreshUser();
    } finally {
      setMfaVerifyLoading(false);
    }
  };

  const cancelMfaSetup = async () => {
    try {
      setMfaSaving(true);
      await fetch('/api/profile/mfa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: false }),
      });
      setMfaSetupStep(null);
      setMfaOtpCode('');
      setMfaVerifyError(null);
      await refreshUser();
    } finally {
      setMfaSaving(false);
    }
  };

  const disableMfa = async () => {
    if (!user) return;
    try {
      setMfaSaving(true);
      const res = await fetch('/api/profile/mfa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: false }),
      });
      if (!res.ok) return;
      await refreshUser();
    } finally {
      setMfaSaving(false);
    }
  };

  const refreshGoals = async () => {
    if (!authUser) return;
    try {
      const targetId = viewedUserId ?? authUser.id;
      const res = await fetch(buildGoalsUrl(targetId, user?.company?.id));
      if (!res.ok) return;
      const data = await res.json();
      setGoals(data);
    } catch {
      // silencieux
    }
  };

  const handleRenew = async (goal: GoalWithRealized) => {
    try {
      setRenewingId(goal.id);
      const res = await fetch(`/api/goals/${goal.id}/renew`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        window.alert(
          (data && data.error) ||
            'Impossible de reconduire cet objectif. Veuillez réessayer.',
        );
        return;
      }
      await refreshGoals();
    } catch {
      window.alert(
        'Une erreur est survenue lors de la reconduction de l’objectif.',
      );
    } finally {
      setRenewingId(null);
    }
  };

  const passwordField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    visible: boolean,
    onToggle: () => void,
    autoComplete: string,
  ) => (
    <div className='flex flex-col gap-1.5'>
      <label className='text-[11px] font-medium text-gray-500'>{label}</label>
      <div className='relative'>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className='h-10 w-full rounded-xl border border-gray-200 bg-white px-3 pr-10 text-xs outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15'
        />
        <button
          type='button'
          onClick={onToggle}
          className='absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-primary'
          aria-label={visible ? 'Masquer' : 'Afficher'}
        >
          {visible ? (
            <EyeOff className='h-3.5 w-3.5' />
          ) : (
            <Eye className='h-3.5 w-3.5' />
          )}
        </button>
      </div>
    </div>
  );

  if (loadingUser) {
    return (
      <div className='mt-2 flex flex-col gap-4'>
        <div className='h-16 animate-pulse rounded-2xl bg-gray-100' />
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
          <div className='h-48 animate-pulse rounded-2xl bg-gray-100' />
          <div className='h-64 animate-pulse rounded-2xl bg-gray-100 lg:col-span-2' />
        </div>
      </div>
    );
  }

  return (
    <div className='mt-2 flex flex-col gap-5'>
      <div className='grid grid-cols-1 items-start gap-4 lg:grid-cols-3'>
        {/* Identité */}
        <NeumoCard className='flex flex-col gap-5 bg-white p-5 shadow-neu-soft lg:col-span-1'>
          <div className='flex flex-col items-center gap-3 text-center sm:items-start sm:text-left'>
            <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-lg font-semibold tracking-wide text-white'>
              {initials(user?.name ?? '')}
            </div>
            <div className='min-w-0 space-y-1'>
              <p className='truncate text-base font-semibold text-primary'>
                {user?.name ?? 'Utilisateur'}
              </p>
              <p className='truncate text-[12px] text-gray-500'>
                {user?.company?.name ?? 'Entreprise non renseignée'}
              </p>
            </div>
          </div>

          <div className='flex flex-wrap items-center justify-center gap-2 sm:justify-start'>
            <span className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary'>
              <Shield className='h-3 w-3' />
              {user ? displayRole(user.role) : '—'}
            </span>
            {isSelf && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                  user?.mfaEnabled
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : user?.mfaSetupPending
                      ? 'border border-amber-200 bg-amber-50 text-amber-700'
                      : 'border border-gray-200 bg-gray-50 text-gray-500'
                }`}
              >
                <Smartphone className='h-3 w-3' />
                {user?.mfaEnabled
                  ? 'MFA activé'
                  : user?.mfaSetupPending
                    ? 'MFA en cours'
                    : 'MFA désactivé'}
              </span>
            )}
          </div>

          <div className='space-y-2.5 border-t border-gray-100 pt-4 text-[12px] text-gray-600'>
            <div className='flex items-start gap-2.5'>
              <Mail className='mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400' />
              <span className='break-all'>{user?.email ?? '—'}</span>
            </div>
            {user?.company && (
              <div className='flex items-center gap-2.5'>
                <Briefcase className='h-3.5 w-3.5 shrink-0 text-gray-400' />
                <span>{user.company.name}</span>
              </div>
            )}
          </div>
        </NeumoCard>

        <div className='flex flex-col gap-4 lg:col-span-2'>
          {/* Informations */}
          <NeumoCard className='flex flex-col gap-4 bg-white p-5 shadow-neu-soft'>
            <div className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <UserIcon className='h-4 w-4 text-primary' />
                <h2 className='text-sm font-semibold text-primary'>
                  Informations personnelles
                </h2>
              </div>
              {canEditIdentity && !editingField && (
                <p className='text-[10px] text-gray-400'>
                  Cliquez sur le crayon pour modifier
                </p>
              )}
            </div>

            {profileStatus.type && (
              <p
                className={`rounded-xl px-3 py-2 text-[11px] ${
                  profileStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {profileStatus.message}
              </p>
            )}

            {user ? (
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                {(
                  [
                    {
                      key: 'name' as const,
                      label: 'Nom complet',
                      value: user.name,
                      editable: canEditIdentity,
                    },
                    {
                      key: 'email' as const,
                      label: 'Adresse email',
                      value: user.email,
                      editable: canEditIdentity,
                    },
                  ] as const
                ).map((field) => (
                  <div key={field.key} className='flex flex-col gap-1.5'>
                    <span className='text-[11px] font-medium text-gray-500'>
                      {field.label}
                    </span>
                    {editingField === field.key ? (
                      <div className='flex items-center gap-1.5'>
                        <input
                          autoFocus
                          type={field.key === 'email' ? 'email' : 'text'}
                          value={pendingValue}
                          onChange={(e) => setPendingValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className='h-10 min-w-0 flex-1 rounded-xl border border-primary/40 bg-white px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20'
                        />
                        <button
                          type='button'
                          onClick={() => void saveField()}
                          disabled={saving}
                          className='inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-50'
                          aria-label='Enregistrer'
                        >
                          {saving ? (
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                          ) : (
                            <CheckCircle2 className='h-3.5 w-3.5' />
                          )}
                        </button>
                        <button
                          type='button'
                          onClick={cancelEditing}
                          className='inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                          aria-label='Annuler'
                        >
                          <X className='h-3.5 w-3.5' />
                        </button>
                      </div>
                    ) : (
                      <div className='flex h-10 items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3'>
                        <span className='min-w-0 flex-1 truncate text-xs text-gray-800'>
                          {field.value}
                        </span>
                        {field.editable && (
                          <button
                            type='button'
                            onClick={() => startEditing(field.key)}
                            className='rounded-lg p-1.5 text-gray-400 transition hover:bg-white hover:text-primary'
                            aria-label={`Modifier ${field.label}`}
                          >
                            <Pencil className='h-3.5 w-3.5' />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <div className='flex flex-col gap-1.5'>
                  <span className='text-[11px] font-medium text-gray-500'>
                    Rôle
                  </span>
                  <div className='flex h-10 items-center rounded-xl border border-gray-100 bg-gray-50/80 px-3 text-xs text-gray-800'>
                    {displayRole(user.role)}
                  </div>
                </div>
                <div className='flex flex-col gap-1.5'>
                  <span className='text-[11px] font-medium text-gray-500'>
                    Entreprise
                  </span>
                  <div className='flex h-10 items-center rounded-xl border border-gray-100 bg-gray-50/80 px-3 text-xs text-gray-800'>
                    {user.company?.name ?? '—'}
                  </div>
                </div>
              </div>
            ) : (
              <p className='text-xs text-gray-400'>Profil introuvable.</p>
            )}
          </NeumoCard>

          {isSelf && (
            <>
              {/* Mot de passe */}
              <NeumoCard className='flex flex-col gap-4 bg-white p-5 shadow-neu-soft'>
                <div className='flex items-center gap-2'>
                  <KeyRound className='h-4 w-4 text-primary' />
                  <h2 className='text-sm font-semibold text-primary'>
                    Mot de passe
                  </h2>
                </div>
                <p className='text-[11px] leading-relaxed text-gray-500'>
                  Choisissez un mot de passe unique d’au moins 8 caractères,
                  difficile à deviner.
                </p>
                <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
                  {passwordField(
                    'Mot de passe actuel',
                    passwordForm.currentPassword,
                    (v) =>
                      setPasswordForm((f) => ({ ...f, currentPassword: v })),
                    showPassword.current,
                    () =>
                      setShowPassword((s) => ({ ...s, current: !s.current })),
                    'current-password',
                  )}
                  {passwordField(
                    'Nouveau mot de passe',
                    passwordForm.newPassword,
                    (v) => setPasswordForm((f) => ({ ...f, newPassword: v })),
                    showPassword.next,
                    () => setShowPassword((s) => ({ ...s, next: !s.next })),
                    'new-password',
                  )}
                  {passwordField(
                    'Confirmer',
                    passwordForm.confirmPassword,
                    (v) =>
                      setPasswordForm((f) => ({ ...f, confirmPassword: v })),
                    showPassword.confirm,
                    () =>
                      setShowPassword((s) => ({ ...s, confirm: !s.confirm })),
                    'new-password',
                  )}
                </div>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                  {passwordStatus.type ? (
                    <p
                      className={`text-[11px] ${
                        passwordStatus.type === 'success'
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {passwordStatus.message}
                    </p>
                  ) : (
                    <span className='text-[11px] text-gray-400'>
                      Les champs restent vides après une mise à jour réussie.
                    </span>
                  )}
                  <button
                    type='button'
                    onClick={handleChangePassword}
                    disabled={saving}
                    className='inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[11px] font-medium text-white transition hover:opacity-90 disabled:opacity-50'
                  >
                    {saving ? (
                      <Loader2 className='h-3.5 w-3.5 animate-spin' />
                    ) : (
                      <Lock className='h-3.5 w-3.5' />
                    )}
                    Mettre à jour
                  </button>
                </div>
              </NeumoCard>

              {/* MFA */}
              <NeumoCard className='flex flex-col gap-4 bg-white p-5 shadow-neu-soft'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='flex items-center gap-2'>
                    <Smartphone className='h-4 w-4 text-primary' />
                    <h2 className='text-sm font-semibold text-primary'>
                      Authentification multifacteur
                    </h2>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                      user?.mfaEnabled
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {user?.mfaEnabled ? 'Activé' : 'Désactivé'}
                  </span>
                </div>

                {mfaSetupStep ? (
                  <>
                    <p className='text-[11px] leading-relaxed text-gray-600'>
                      Scannez le QR code avec Google Authenticator, Authy ou une
                      app équivalente, puis saisissez le code à 6 chiffres.
                    </p>
                    <div className='flex flex-col gap-4 sm:flex-row sm:items-start'>
                      <div className='flex flex-col items-center gap-2'>
                        <div className='rounded-2xl border border-gray-200 bg-white p-2 shadow-sm'>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={mfaSetupStep.qrCodeDataUrl}
                            alt='QR code MFA'
                            width={200}
                            height={200}
                            className='rounded-xl'
                          />
                        </div>
                      </div>
                      <div className='flex min-w-0 flex-1 flex-col gap-3'>
                        <div className='flex flex-col gap-1.5'>
                          <span className='text-[11px] font-medium text-gray-500'>
                            Clé manuelle
                          </span>
                          <code className='break-all rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-[11px] text-gray-700'>
                            {mfaSetupStep.secret}
                          </code>
                        </div>
                        <div className='flex flex-col gap-1.5'>
                          <span className='text-[11px] font-medium text-gray-500'>
                            Code à 6 chiffres
                          </span>
                          <input
                            type='text'
                            inputMode='numeric'
                            maxLength={6}
                            placeholder='000000'
                            value={mfaOtpCode}
                            onChange={(e) => {
                              const v = e.target.value
                                .replace(/\D/g, '')
                                .slice(0, 6);
                              setMfaOtpCode(v);
                              setMfaVerifyError(null);
                            }}
                            onKeyDown={(e) =>
                              e.key === 'Enter' && void verifyMfaCode()
                            }
                            className='h-10 w-36 rounded-xl border border-gray-200 bg-white px-3 font-mono text-sm tracking-[0.25em] outline-none focus:ring-2 focus:ring-primary/15'
                          />
                        </div>
                        {mfaVerifyError && (
                          <p className='text-[11px] text-rose-600'>
                            {mfaVerifyError}
                          </p>
                        )}
                        <div className='flex flex-wrap gap-2'>
                          <button
                            type='button'
                            onClick={() => void verifyMfaCode()}
                            disabled={
                              mfaOtpCode.length !== 6 || mfaVerifyLoading
                            }
                            className='inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[11px] font-medium text-white disabled:opacity-50'
                          >
                            {mfaVerifyLoading
                              ? 'Vérification…'
                              : 'Vérifier et activer'}
                          </button>
                          <button
                            type='button'
                            onClick={() => void cancelMfaSetup()}
                            disabled={mfaSaving}
                            className='inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-[11px] font-medium text-gray-700 disabled:opacity-50'
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                    <p className='text-[11px] leading-relaxed text-gray-600'>
                      {user?.mfaEnabled
                        ? 'Votre compte est protégé par un code OTP en plus du mot de passe.'
                        : user?.mfaSetupPending
                          ? 'Une configuration MFA est en attente. Terminez-la pour sécuriser le compte.'
                          : 'Ajoutez une double authentification (code OTP) pour renforcer la sécurité du compte.'}
                    </p>
                    {user?.mfaEnabled ? (
                      <button
                        type='button'
                        onClick={() => void disableMfa()}
                        disabled={mfaSaving}
                        className='inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                      >
                        Désactiver le MFA
                      </button>
                    ) : (
                      <button
                        type='button'
                        onClick={() => void startMfaSetup()}
                        disabled={mfaSaving}
                        className='inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-[11px] font-medium text-white disabled:opacity-50'
                      >
                        {mfaSaving
                          ? 'Préparation…'
                          : user?.mfaSetupPending
                            ? 'Continuer'
                            : 'Activer le MFA'}
                      </button>
                    )}
                  </div>
                )}
              </NeumoCard>

              <EmailSignatureSettings />
            </>
          )}

          {(user?.role === 'agent' || user?.role === 'AGENT') && (
            <NeumoCard className='flex flex-col gap-4 bg-white p-5 shadow-neu-soft'>
              <div className='flex items-center gap-2'>
                <Target className='h-4 w-4 text-primary' />
                <h2 className='text-sm font-semibold text-primary'>
                  Mes objectifs
                </h2>
              </div>
              {goals.length === 0 ? (
                <p className='text-xs text-gray-500'>
                  Aucun objectif défini. Votre manager peut en définir depuis la
                  page Utilisateurs.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className='hover:bg-transparent'>
                      <TableHead>Période</TableHead>
                      <TableHead className='text-right'>
                        Conversions
                      </TableHead>
                      <TableHead className='text-right'>CA</TableHead>
                      <TableHead className='text-right'>Statut</TableHead>
                      {isManagerOrAdmin && !isSelf && (
                        <TableHead className='text-right'>Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goals
                      .sort(
                        (a, b) =>
                          new Date(b.periodStart).getTime() -
                          new Date(a.periodStart).getTime(),
                      )
                      .map((g) => {
                        const now = new Date();
                        const start = new Date(g.periodStart);
                        const end = new Date(g.periodEnd);
                        const isCurrentPeriod = now >= start && now <= end;
                        const allDone =
                          g.realizedConversions >= g.targetConversions &&
                          g.realizedRevenue >= g.targetRevenue;
                        const status = allDone
                          ? 'Atteint'
                          : isCurrentPeriod
                            ? 'En cours'
                            : 'Terminé';
                        return (
                          <TableRow key={g.id}>
                            <TableCell className='font-medium'>
                              {g.periodLabel}
                            </TableCell>
                            <TableCell className='text-right'>
                              {g.realizedConversions} / {g.targetConversions}
                            </TableCell>
                            <TableCell className='text-right'>
                              {g.realizedRevenue.toLocaleString('fr-FR', {
                                style: 'currency',
                                currency: 'XOF',
                                maximumFractionDigits: 0,
                              })}{' '}
                              /{' '}
                              {g.targetRevenue.toLocaleString('fr-FR', {
                                style: 'currency',
                                currency: 'XOF',
                                maximumFractionDigits: 0,
                              })}
                            </TableCell>
                            <TableCell className='text-right'>
                              {allDone ? (
                                <span className='inline-flex items-center gap-1 text-emerald-600'>
                                  <CheckCircle2 className='h-3.5 w-3.5' />
                                  {status}
                                </span>
                              ) : (
                                <span className='inline-flex items-center gap-1 text-gray-500'>
                                  <Clock className='h-3.5 w-3.5' />
                                  {status}
                                </span>
                              )}
                            </TableCell>
                            {isManagerOrAdmin && !isSelf && (
                              <TableCell className='text-right'>
                                {(() => {
                                  const periodFinished = now > end;
                                  const canRenew =
                                    periodFinished &&
                                    ((g.targetConversions > 0 &&
                                      g.realizedConversions <
                                        g.targetConversions) ||
                                      (g.targetRevenue > 0 &&
                                        g.realizedRevenue < g.targetRevenue));
                                  if (!canRenew) return null;
                                  return (
                                    <button
                                      type='button'
                                      onClick={() => handleRenew(g)}
                                      disabled={renewingId === g.id}
                                      className='inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/15 disabled:opacity-50'
                                    >
                                      Reconduire
                                    </button>
                                  );
                                })()}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </NeumoCard>
          )}

          {user && authUser && (
            <ProfileActionHistory
              userId={viewedUserId ?? authUser.id}
              isSelf={!!isSelf}
              userName={!isSelf ? user.name : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ProfilePageWithSearchParams({
  searchParams,
}: {
  searchParams?: { userId?: string };
}) {
  const userId = searchParams?.userId;
  return (
    <Suspense
      fallback={
        <div className='flex flex-col gap-2 text-xs text-gray-500'>
          Chargement du profil…
        </div>
      }
    >
      <ProfilePageInner viewedUserId={userId ?? null} />
    </Suspense>
  );
}

const ProfilePage = withDashboardLayout(ProfilePageWithSearchParams, {
  title: 'Profil',
  subtitle: 'Informations personnelles, sécurité et préférences de compte.',
  titleIcon: UserIcon,
});

export default ProfilePage;
