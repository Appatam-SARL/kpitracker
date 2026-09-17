"use client";

import { withDashboardLayout } from "@/components/layouts/withDashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  canAccessTrash,
  canManageCatalog,
  getRoleLabel,
  isAdminOrManagerLike,
} from "@/lib/roles";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  FileText,
  Mail,
  Package,
  Shield,
  Trash2,
  UserRound,
  Users,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type SettingsTab = "organization" | "legal";

interface CurrentOrg {
  companyName: string;
  companyKind?: string;
  companyCreatedAt?: string;
  contactEmail?: string;
}

const FAQ_ITEMS = [
  {
    q: "Comment importer des prospects ?",
    a: "Dans Gestion Contacts, utilisez Import pour charger le modèle Excel. Les colonnes d’adresse et de situation géographique (lien Maps) sont prises en charge.",
  },
  {
    q: "Qui peut ouvrir une fiche contact ?",
    a: "Chaque commerciale ouvre ses propres contacts. Le DG consulte celles de sa société. La directrice commerciale, la directrice des opérations, le PDG et l’admin voient toutes les fiches.",
  },
  {
    q: "Comment générer un rapport de ventes ?",
    a: "Ouvrez Rapport, choisissez la période et les filtres, puis générez un export PDF, Excel ou Word avec le cockpit de pilotage.",
  },
  {
    q: "Où restaurer un élément supprimé ?",
    a: "Les managers, admins et rôles groupe accèdent à Corbeille pour restaurer ou purger définitivement les éléments mis de côté.",
  },
];

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm border border-gray-100">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className="truncate text-sm font-medium text-primary">{value}</p>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-neu-soft transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-neu"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-primary">{title}</span>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">
          {description}
        </span>
      </span>
    </Link>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const { user: authUser, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("organization");
  const [org, setOrg] = useState<CurrentOrg | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (loading) return;
    if (!authUser || authUser.role === "agent") {
      router.replace("/");
    }
  }, [authUser, loading, router]);

  useEffect(() => {
    let cancelled = false;
    setOrgLoading(true);
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const createdAt = data.company?.createdAt
          ? new Date(data.company.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : undefined;
        setOrg({
          companyName: data.company?.name ?? "",
          companyKind: data.company?.kind,
          companyCreatedAt: createdAt,
          contactEmail: data.email ?? undefined,
        });
      })
      .catch(() => {
        if (!cancelled) setOrg(null);
      })
      .finally(() => {
        if (!cancelled) setOrgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs: {
    key: SettingsTab;
    label: string;
    icon: typeof Briefcase;
    adminOnly?: boolean;
  }[] = [
    { key: "organization", label: "Organisation", icon: Briefcase },
    {
      key: "legal",
      label: "Données & FAQ",
      icon: FileText,
      adminOnly: true,
    },
  ];

  const visibleTabs =
    authUser && isAdminOrManagerLike(authUser.role)
      ? tabs
      : tabs.filter((t) => !t.adminOnly);

  const initials = useMemo(() => {
    const name = authUser?.name?.trim() || "U";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [authUser?.name]);

  const kindLabel =
    org?.companyKind === "GROUP"
      ? "Société du groupe"
      : org?.companyKind === "CLIENT"
        ? "Société cliente"
        : "—";

  if (loading || !authUser || authUser.role === "agent") {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-gray-500">
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-white/70 bg-white p-5 shadow-neu-soft md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Administration
          </p>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-3.5 py-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">
                {authUser.name}
              </p>
              <p className="text-[11px] text-gray-500">
                {getRoleLabel(authUser.role)}
                {org?.companyName ? ` · ${org.companyName}` : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div
        role="tablist"
        aria-label="Sections des paramètres"
        className="flex flex-wrap gap-1 rounded-2xl border border-gray-100 bg-gray-100/80 p-1"
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all sm:flex-none ${
                isActive
                  ? "bg-white text-primary shadow-sm border border-gray-200"
                  : "text-gray-600 hover:bg-white/70"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "organization" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-neu-soft lg:col-span-2">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-primary">
                  Organisation
                </h2>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  Identité de l’entreprise rattachée à votre compte.
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                <Building2 className="h-5 w-5" />
              </span>
            </div>

            {orgLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[72px] animate-pulse rounded-xl bg-gray-100"
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-2xl border border-gray-100 bg-linear-to-br from-gray-50 to-white p-4">
                  <p className="text-[11px] text-gray-400">Entreprise</p>
                  <p className="mt-1 text-xl font-semibold text-primary">
                    {org?.companyName || "Non renseignée"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600">
                      {kindLabel}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoRow
                    icon={Calendar}
                    label="Date d’ajout"
                    value={org?.companyCreatedAt ?? "—"}
                  />
                  <InfoRow
                    icon={Mail}
                    label="Email du compte connecté"
                    value={org?.contactEmail ?? "—"}
                  />
                  <InfoRow
                    icon={Shield}
                    label="Votre rôle"
                    value={getRoleLabel(authUser.role)}
                  />
                  <InfoRow
                    icon={Briefcase}
                    label="Type d’organisation"
                    value={kindLabel}
                  />
                </div>
              </>
            )}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-neu-soft">
            <h2 className="text-base font-semibold text-primary">Mon compte</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Profil, mot de passe, MFA et signature email.
            </p>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary">
                  {authUser.name}
                </p>
                <p className="truncate text-[11px] text-gray-500">
                  {authUser.email}
                </p>
              </div>
            </div>

            <Link
              href="/profile"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              <UserRound className="h-4 w-4" />
              Gérer mon profil
            </Link>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
              Les informations d’entreprise sont gérées au niveau
              administrateur. Pour modifier votre identité personnelle, passez
              par le profil.
            </p>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-neu-soft lg:col-span-3">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-primary">
                Accès rapides
              </h2>
              <p className="mt-0.5 text-[11px] text-gray-500">
                Raccourcis vers les modules d’administration les plus utiles.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {isAdminOrManagerLike(authUser.role) ? (
                <QuickLink
                  href="/users"
                  icon={Users}
                  title="Utilisateurs"
                  description="Créer et gérer les comptes de votre équipe."
                />
              ) : null}
              {canManageCatalog(authUser.role) ? (
                <QuickLink
                  href="/products-services"
                  icon={Package}
                  title="Produits & services"
                  description="Maintenir le catalogue commercial."
                />
              ) : null}
              {canAccessTrash(authUser.role) ? (
                <QuickLink
                  href="/corbeille"
                  icon={Trash2}
                  title="Corbeille"
                  description="Restaurer ou purger les éléments supprimés."
                />
              ) : null}
              <QuickLink
                href="/guide"
                icon={BookOpen}
                title="Guide"
                description="Retrouver le fonctionnement des menus et rôles."
              />
            </div>
          </section>
        </div>
      )}

      {activeTab === "legal" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-neu-soft space-y-4">
            <div>
              <h2 className="text-base font-semibold text-primary">
                Protection des données
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                KpiTracker traite les données de prospects, clients et
                utilisateurs pour le suivi commercial. L’accès est restreint
                selon le rôle : chaque commerciale voit surtout ses données, le
                DG son entreprise, les rôles groupe le périmètre multi-sociétés.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Les suppressions passent par une corbeille avant purge
                définitive. Conservez des accès sécurisés (mot de passe fort,
                MFA recommandé) et limitez le partage des comptes.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-primary">
                Conditions générales de vente
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">
                Les CGV applicables aux prestations commercialisées via le CRM
                restent celles de votre organisation. Contactez l’administration
                pour les documents contractuels à jour.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-neu-soft">
            <h2 className="text-base font-semibold text-primary">FAQ</h2>
            <p className="mt-0.5 mb-4 text-[11px] text-gray-500">
              Réponses courtes aux questions fréquentes des équipes.
            </p>
            <div className="space-y-2">
              {FAQ_ITEMS.map((item, index) => {
                const open = openFaq === index;
                return (
                  <div
                    key={item.q}
                    className="overflow-hidden rounded-2xl border border-gray-100"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : index)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                      aria-expanded={open}
                    >
                      <span className="text-sm font-medium text-primary">
                        {item.q}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {open ? (
                      <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-3 text-[12px] leading-relaxed text-gray-600">
                        {item.a}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const SettingsPage = withDashboardLayout(SettingsPageInner, {
  title: 'Paramètres',
  subtitle:
    'Consultez l’organisation, votre compte et les accès utiles pour piloter KpiTracker.',
  titleIcon: Settings,
});

export default SettingsPage;
