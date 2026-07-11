"use client";

import { useEffect, useState, Suspense } from "react";
import NeumoCard from "@/components/NeumoCard";
import { withDashboardLayout } from "@/components/layouts/withDashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { hasGroupCompanyScopeFrontend, isAdminOrManagerLike } from "@/lib/roles";
import { EmailSignatureSettings } from "@/components/profile/EmailSignatureSettings";
import { ProfileActionHistory } from "@/components/profile/ProfileActionHistory";
import {
  Mail,
  Briefcase,
  Shield,
  User as UserIcon,
  Lock,
  KeyRound,
  Smartphone,
  Target,
  CheckCircle2,
  Clock,
} from "lucide-react";

/** Objectif avec réalisé (GET /api/goals) */
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

function ProfilePageInner({
  viewedUserId: viewedUserIdProp,
}: {
  viewedUserId?: string | null;
}) {
  const { user: authUser } = useAuth();
  const viewedUserId = viewedUserIdProp ?? null;
  const [user, setUser] = useState<{
    name: string;
    email: string;
    role: string;
    mfaEnabled?: boolean;
    mfaSetupPending?: boolean;
    company?: { id: string; name: string };
  } | null>(null);
  const [editingField, setEditingField] = useState<"name" | "email" | null>(
    null
  );
  const [pendingValue, setPendingValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordStatus, setPasswordStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [mfaSaving, setMfaSaving] = useState(false);
  const [mfaSetupStep, setMfaSetupStep] = useState<{
    qrCodeDataUrl: string;
    secret: string;
  } | null>(null);
  const [mfaOtpCode, setMfaOtpCode] = useState("");
  const [mfaVerifyError, setMfaVerifyError] = useState<string | null>(null);
  const [mfaVerifyLoading, setMfaVerifyLoading] = useState(false);
  const [goals, setGoals] = useState<GoalWithRealized[]>([]);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const isSelf =
    !viewedUserId || (authUser && viewedUserId === authUser.id);
  const isManagerOrAdmin = isAdminOrManagerLike(authUser?.role);

  const buildGoalsUrl = (targetId: string, targetCompanyId?: string) => {
    if (authUser?.role === "agent" && !viewedUserId) {
      return "/api/goals";
    }
    const params = new URLSearchParams({ userId: targetId });
    if (
      targetCompanyId &&
      hasGroupCompanyScopeFrontend(authUser?.role) &&
      targetCompanyId !== authUser?.company?.id
    ) {
      params.set("companyId", targetCompanyId);
    }
    return `/api/goals?${params.toString()}`;
  };

  // Charge le profil à afficher :
  // - si aucun userId en query → profil de l'utilisateur connecté
  // - si userId différent → profil de ce membre (admin/manager ou rôles groupe)
  useEffect(() => {
    (async () => {
      try {
        if (!authUser) {
          setUser(null);
          return;
        }
        const targetId = viewedUserId ?? authUser.id;

        // Profil de l'utilisateur connecté (ou agent qui ne peut voir que lui-même)
        if (!viewedUserId || viewedUserId === authUser.id || authUser.role === "agent") {
          const res = await fetch("/api/auth/me");
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
          role: (found.role ?? "").toString(),
          company: found.company
            ? { id: found.company.id, name: found.company.name }
            : undefined,
        });
      } catch {
        setUser(null);
      }
    })();
  }, [authUser, viewedUserId]);

  // Mes objectifs : pour un commercial, et pour un admin/manager qui consulte un commercial,
  // on force userId dans la query pour cibler le bon membre.
  useEffect(() => {
    (async () => {
      try {
        if (!authUser) return;
        const targetId = viewedUserId ?? authUser.id;
        const res = await fetch(
          buildGoalsUrl(targetId, user?.company?.id),
        );
        if (!res.ok) return;
        const data = await res.json();
        setGoals(data);
      } catch {
        // silencieux
      }
    })();
  }, [authUser, viewedUserId, user?.company?.id]);

  const refreshUser = async () => {
    const res = await fetch("/api/auth/me");
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

  const startEditing = (field: "name" | "email") => {
    if (!user) return;
    setEditingField(field);
    setPendingValue(field === "name" ? user.name : user.email);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setPendingValue("");
  };

  const saveField = async () => {
    if (!user || !editingField) return;
    const trimmed = pendingValue.trim();
    if (!trimmed || trimmed === (editingField === "name" ? user.name : user.email)) {
      cancelEditing();
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [editingField]: trimmed }),
      });
      if (!res.ok) {
        // on ne bloque pas l'UI, mais on annule l'édition si erreur
        cancelEditing();
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
          : prev
      );
      cancelEditing();
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveField();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  };

  const handleChangePassword = async () => {
    setPasswordStatus({ type: null, message: "" });
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({
        type: "error",
        message: "Tous les champs sont obligatoires.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: "error",
        message: "La confirmation ne correspond pas au nouveau mot de passe.",
      });
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setPasswordStatus({
          type: "error",
          message:
            data?.error ??
            "Impossible de changer le mot de passe. Vérifiez le mot de passe actuel.",
        });
        return;
      }
      setPasswordStatus({
        type: "success",
        message: "Mot de passe mis à jour avec succès.",
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
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
      const res = await fetch("/api/profile/mfa/setup", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMfaVerifyError(data?.error ?? "Impossible de démarrer la configuration.");
        return;
      }
      const data = await res.json();
      setMfaSetupStep({ qrCodeDataUrl: data.qrCodeDataUrl, secret: data.secret });
      await refreshUser();
    } finally {
      setMfaSaving(false);
    }
  };


  const verifyMfaCode = async () => {
    const code = mfaOtpCode.replace(/\s/g, "");
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setMfaVerifyError("Saisissez un code à 6 chiffres.");
      return;
    }
    try {
      setMfaVerifyLoading(true);
      setMfaVerifyError(null);
      const res = await fetch("/api/profile/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMfaVerifyError(data?.error ?? "Code invalide ou expiré.");
        return;
      }
      setMfaSetupStep(null);
      setMfaOtpCode("");
      await refreshUser();
    } finally {
      setMfaVerifyLoading(false);
    }
  };

  const cancelMfaSetup = async () => {
    try {
      setMfaSaving(true);
      await fetch("/api/profile/mfa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: false }),
      });
      setMfaSetupStep(null);
      setMfaOtpCode("");
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
      const res = await fetch("/api/profile/mfa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        window.alert(
          (data && data.error) ||
            "Impossible de reconduire cet objectif. Veuillez réessayer."
        );
        return;
      }
      await refreshGoals();
    } catch {
      window.alert(
        "Une erreur est survenue lors de la reconduction de l'objectif."
      );
    } finally {
      setRenewingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 mt-2">
      {/* En-tête */}
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-primary">
            {isSelf ? "Mon profil" : `Profil de ${user?.name ?? "l'utilisateur"}`}
          </h1>
          <p className="text-xs md:text-sm text-gray-500">
            {isSelf
              ? "Vos informations personnelles et préférences de compte."
              : "Consultation du profil et des objectifs du membre."}
          </p>
        </div>
      </section>

      {/* Grille 2 colonnes : carte identité à gauche, infos détaillées à droite */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Colonne gauche : carte résumé utilisateur */}
        <NeumoCard className="lg:col-span-1 bg-white p-5 flex flex-col gap-4 shadow-neu-soft">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-linear-to-br from-violet-500 to-indigo-500 text-white flex items-center justify-center text-lg font-semibold">
              {user?.name?.[0] ?? "?"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-primary">
                {user?.name ?? "Utilisateur"}
              </span>
              <span className="text-[11px] text-gray-500">
                {user?.company?.name ?? "Entreprise non renseignée"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-[11px] text-gray-600">
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-gray-50 border border-gray-100 w-fit">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="uppercase tracking-wide text-[10px] font-semibold text-primary">
                {user?.role ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span>{user?.email ?? "Email non renseigné"}</span>
            </div>
            {user?.company && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                <span>{user.company.name}</span>
              </div>
            )}
          </div>
        </NeumoCard>

        {/* Colonne droite : blocs d’informations structurés */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Bloc Informations personnelles */}
          <NeumoCard className="bg-white p-5 shadow-neu-soft flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-primary">
                  Informations personnelles
                </h2>
              </div>
            </div>

            {user ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-700">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                    Nom complet
                  </span>
              {editingField === "name" ? (
                <input
                  autoFocus
                  value={pendingValue}
                  onChange={(e) => setPendingValue(e.target.value)}
                  onBlur={() => {
                    if (!saving) void saveField();
                  }}
                  onKeyDown={handleKeyDown}
                  className="px-3 py-2 rounded-xl bg-white border border-primary/40 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : (
                <span
                  className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer"
                  title="Double-cliquez pour modifier"
                  onDoubleClick={() => startEditing("name")}
                >
                  {user.name}
                </span>
              )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                    Adresse email
                  </span>
              {editingField === "email" ? (
                <input
                  autoFocus
                  type="email"
                  value={pendingValue}
                  onChange={(e) => setPendingValue(e.target.value)}
                  onBlur={() => {
                    if (!saving) void saveField();
                  }}
                  onKeyDown={handleKeyDown}
                  className="px-3 py-2 rounded-xl bg-white border border-primary/40 text-xs outline-none focus:ring-2 focus:ring-primary/30 break-all"
                />
              ) : (
                <span
                  className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 break-all cursor-pointer"
                  title="Double-cliquez pour modifier"
                  onDoubleClick={() => startEditing("email")}
                >
                  {user.email}
                </span>
              )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                    Rôle
                  </span>
                  <span className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                    {user.role}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                    Entreprise
                  </span>
                  <span className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                    {user.company?.name ?? "—"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Chargement…</p>
            )}
          </NeumoCard>

          {/* Bloc Sécurité du compte : mot de passe + MFA (uniquement pour l'utilisateur connecté) */}
          {isSelf && (
          <NeumoCard className="bg-white p-5 shadow-neu-soft flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-primary">
                Préférences et sécurité
              </h2>
            </div>

            {/* Sous-bloc : changement de mot de passe */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-gray-500" />
                <h3 className="text-xs font-semibold text-gray-800">
                  Changer le mot de passe
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-700">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                    Mot de passe actuel
                  </span>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((f) => ({
                        ...f,
                        currentPassword: e.target.value,
                      }))
                    }
                    className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                    Nouveau mot de passe
                  </span>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((f) => ({
                        ...f,
                        newPassword: e.target.value,
                      }))
                    }
                    className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                    Confirmer
                  </span>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((f) => ({
                        ...f,
                        confirmPassword: e.target.value,
                      }))
                    }
                    className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-gray-500">
                  Pour des raisons de sécurité, choisissez un mot de passe unique et
                  difficile à deviner.
                </p>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-[11px] font-medium shadow-neu disabled:opacity-50"
                >
                  Mettre à jour
                </button>
              </div>
              {passwordStatus.type && (
                <p
                  className={`text-[11px] ${
                    passwordStatus.type === "success"
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {passwordStatus.message}
                </p>
              )}
            </div>

            {/* Sous-bloc : MFA */}
            <div className="flex flex-col gap-4 border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gray-500" />
                <h3 className="text-xs font-semibold text-gray-800">
                  Authentification multifacteur (MFA)
                </h3>
              </div>

              {mfaSetupStep ? (
                <>
                  <p className="text-[11px] text-gray-600">
                    Scannez ce QR code avec une application d&apos;authentification (Google Authenticator, Authy, etc.) puis saisissez le code à 6 chiffres ci-dessous.
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-xl border-2 border-gray-200 bg-white p-2 shadow-neu-soft">
                        <img
                          src={mfaSetupStep.qrCodeDataUrl}
                          alt="QR code MFA"
                          width={220}
                          height={220}
                          className="rounded-lg"
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">Scanner avec votre app</span>
                    </div>
                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                          Ou saisir la clé manuellement
                        </span>
                        <code className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-gray-700 break-all font-mono">
                          {mfaSetupStep.secret}
                        </code>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                          Code à 6 chiffres
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="000000"
                          value={mfaOtpCode}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setMfaOtpCode(v);
                            setMfaVerifyError(null);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && verifyMfaCode()}
                          className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm tracking-[0.3em] font-mono outline-none focus:ring-2 focus:ring-primary/30 w-32"
                        />
                      </div>
                      {mfaVerifyError && (
                        <p className="text-[11px] text-rose-600">{mfaVerifyError}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={verifyMfaCode}
                          disabled={mfaOtpCode.length !== 6 || mfaVerifyLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-[11px] font-medium shadow-neu disabled:opacity-50"
                        >
                          {mfaVerifyLoading ? "Vérification…" : "Vérifier et activer"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelMfaSetup}
                          disabled={mfaSaving}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-medium disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : user?.mfaSetupPending ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-gray-600">
                  <p>
                    Une configuration MFA est en attente. Scannez le QR code et saisissez le code pour finaliser.
                  </p>
                  <button
                    type="button"
                    onClick={startMfaSetup}
                    disabled={mfaSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-[11px] font-medium shadow-neu disabled:opacity-50"
                  >
                    {mfaSaving ? "Chargement…" : "Continuer la configuration"}
                  </button>
                </div>
              ) : user?.mfaEnabled ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-gray-600">
                  <p>
                    La double authentification est <strong className="text-emerald-600">activée</strong> sur votre compte.
                  </p>
                  <button
                    type="button"
                    onClick={disableMfa}
                    disabled={mfaSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-medium hover:bg-gray-200 disabled:opacity-50"
                  >
                    Désactiver le MFA
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-gray-600">
                  <p>
                    Ajoutez une couche de sécurité supplémentaire à votre compte en
                    activant la double authentification (code OTP).
                  </p>
                  <button
                    type="button"
                    onClick={startMfaSetup}
                    disabled={mfaSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-[11px] font-medium shadow-neu disabled:opacity-50"
                  >
                    {mfaSaving ? "Préparation…" : "Activer le MFA"}
                  </button>
                </div>
              )}
            </div>

            <EmailSignatureSettings />
          </NeumoCard>
          )}

          {/* Mes objectifs (commercial / AGENT) */}
      {(user?.role === "agent" || user?.role === "AGENT") && (
            <NeumoCard className="bg-white p-5 shadow-neu-soft flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-primary">
                  Mes objectifs
                </h2>
              </div>
              {goals.length === 0 ? (
                <p className="text-xs text-gray-500">
                  Aucun objectif défini. Votre manager peut en définir depuis la
                  page Utilisateurs (action « Définir objectif »).
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="text-gray-500 border-b border-gray-100">
                      <tr>
                        <th className="py-2 text-left font-medium">Période</th>
                        <th className="py-2 text-right font-medium">
                          Conversions (réalisé / objectif)
                        </th>
                        <th className="py-2 text-right font-medium">
                          CA (réalisé / objectif)
                        </th>
                        <th className="py-2 text-right font-medium">Statut</th>
                        {isManagerOrAdmin && !isSelf && (
                          <th className="py-2 text-right font-medium">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      {goals
                        .sort(
                          (a, b) =>
                            new Date(b.periodStart).getTime() -
                            new Date(a.periodStart).getTime()
                        )
                        .map((g) => {
                          const now = new Date();
                          const start = new Date(g.periodStart);
                          const end = new Date(g.periodEnd);
                          const isCurrentPeriod = now >= start && now <= end;
                          const conversionsDone =
                            g.realizedConversions >= g.targetConversions;
                          const revenueDone =
                            g.realizedRevenue >= g.targetRevenue;
                          const allDone = conversionsDone && revenueDone;
                          const status = allDone
                            ? "Atteint"
                            : isCurrentPeriod
                              ? "En cours"
                              : "Terminé";
                          return (
                            <tr
                              key={g.id}
                              className="border-b border-gray-50 hover:bg-gray-50/60"
                            >
                              <td className="py-2.5 font-medium">
                                {g.periodLabel}
                              </td>
                              <td className="py-2.5 text-right">
                                {g.realizedConversions} / {g.targetConversions}
                              </td>
                              <td className="py-2.5 text-right">
                                {g.realizedRevenue.toLocaleString("fr-FR", {
                                  style: "currency",
                                  currency: "XOF",
                                  maximumFractionDigits: 0,
                                })}{" "}
                                /{" "}
                                {g.targetRevenue.toLocaleString("fr-FR", {
                                  style: "currency",
                                  currency: "XOF",
                                  maximumFractionDigits: 0,
                                })}
                              </td>
                              <td className="py-2.5 text-right">
                                {allDone ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {status}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-gray-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    {status}
                                  </span>
                                )}
                              </td>
                                  {isManagerOrAdmin && !isSelf && (
                                    <td className="py-2.5 text-right">
                                      {(() => {
                                        const now = new Date();
                                        const end = new Date(g.periodEnd);
                                        const periodFinished = now > end;
                                        const conversionsNotReached =
                                          g.targetConversions > 0 &&
                                          g.realizedConversions <
                                            g.targetConversions;
                                        const revenueNotReached =
                                          g.targetRevenue > 0 &&
                                          g.realizedRevenue < g.targetRevenue;
                                        const canRenew =
                                          periodFinished &&
                                          (conversionsNotReached ||
                                            revenueNotReached);

                                        if (!canRenew) return null;

                                        return (
                                          <button
                                            type="button"
                                            onClick={() => handleRenew(g)}
                                            disabled={renewingId === g.id}
                                            className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/15 disabled:opacity-50"
                                          >
                                            Reconduire
                                          </button>
                                        );
                                      })()}
                                    </td>
                                  )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
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
        <div className="flex flex-col gap-2 text-xs text-gray-500">
          Chargement du profil…
        </div>
      }
    >
      <ProfilePageInner viewedUserId={userId ?? null} />
    </Suspense>
  );
}

const ProfilePage = withDashboardLayout(ProfilePageWithSearchParams);
export default ProfilePage;
