"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Wrench, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import NeumoCard from "@/components/NeumoCard";
import SkeletonLoader from "@/components/SkeletonLoader";
import ProductCreateSheet from "@/components/ProductCreateSheet";
import ServiceCreateSheet from "@/components/ServiceCreateSheet";
import GroupCompanySelect from "@/components/GroupCompanySelect";
import { withDashboardLayout } from "@/components/layouts/withDashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupCompanyScope } from "@/hooks/useGroupCompanyScope";
import {
  canManageCatalog,
  canManageCrossCompanyCatalog,
} from "@/lib/roles";

const ITEMS_PER_PAGE = 10;

type TabKind = "products" | "services";

interface Product {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
}

function ProductsServicesPageInner() {
  const { user: authUser } = useAuth();
  const {
    hasGroupScope,
    companyOptions,
    selectedCompanyId,
    setSelectedCompanyId,
    apiCompanyId,
    scopeLabel,
  } = useGroupCompanyScope();

  const showCompanySelector = canManageCrossCompanyCatalog(authUser?.role);
  const canCreate = canManageCatalog(authUser?.role);
  const catalogCompanyId = showCompanySelector ? apiCompanyId : undefined;
  const canCreateForSelection =
    canCreate && (!showCompanySelector || Boolean(apiCompanyId));

  const [tab, setTab] = useState<TabKind>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const buildCatalogUrl = useCallback(
    (path: string) => {
      if (showCompanySelector && apiCompanyId) {
        return `${path}?companyId=${encodeURIComponent(apiCompanyId)}`;
      }
      return path;
    },
    [showCompanySelector, apiCompanyId],
  );

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch(buildCatalogUrl("/api/products"));
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch {
      // silencieux
    } finally {
      setLoadingProducts(false);
    }
  }, [buildCatalogUrl]);

  const fetchServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const res = await fetch(buildCatalogUrl("/api/services"));
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch {
      // silencieux
    } finally {
      setLoadingServices(false);
    }
  }, [buildCatalogUrl]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const list = tab === "products" ? products : services;
  const loading = tab === "products" ? loadingProducts : loadingServices;

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return list.slice(start, start + ITEMS_PER_PAGE);
  }, [list, currentPage]);

  const totalPages = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [tab, apiCompanyId]);

  const handleProductCreated = (product: Product) => {
    setProducts((prev) => [product, ...prev]);
  };

  const handleServiceCreated = (service: Service) => {
    setServices((prev) => [service, ...prev]);
  };

  const pageSubtitle = showCompanySelector
    ? `Catalogue de ${scopeLabel}.`
    : "Gérez les produits et services de votre entreprise.";

  return (
    <>
      <NeumoCard className="rounded-3xl bg-[#f5f5ff] shadow-neu-soft border border-white/50 backdrop-blur-sm mt-4 p-4 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              Produits et services
            </h1>
            <p className="text-xs text-gray-500 mt-1">{pageSubtitle}</p>
          </div>
          {canCreate && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setProductSheetOpen(true)}
                disabled={!canCreateForSelection}
                title={
                  !canCreateForSelection
                    ? "Sélectionnez une entreprise"
                    : undefined
                }
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-xs font-medium shadow-neu hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Ajouter un produit
              </button>
              <button
                type="button"
                onClick={() => setServiceSheetOpen(true)}
                disabled={!canCreateForSelection}
                title={
                  !canCreateForSelection
                    ? "Sélectionnez une entreprise"
                    : undefined
                }
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 border border-gray-200 text-xs font-medium shadow-neu-soft hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Ajouter un service
              </button>
            </div>
          )}
        </div>

        {showCompanySelector && (
          <GroupCompanySelect
            id="catalog-company"
            label="Entreprise"
            value={selectedCompanyId}
            options={companyOptions}
            fallbackOption={
              authUser?.company
                ? { id: authUser.company.id, name: authUser.company.name }
                : undefined
            }
            onChange={setSelectedCompanyId}
            selectClassName="h-9 w-full sm:w-auto min-w-[200px] rounded-xl border border-gray-200 bg-white px-3 text-[11px] text-gray-700"
          />
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl bg-gray-100/80 border border-gray-100">
          <button
            type="button"
            onClick={() => setTab("products")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
              tab === "products"
                ? "bg-white text-primary shadow-neu-soft border border-white/50"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Package className="w-4 h-4" />
            Produits ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("services")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
              tab === "services"
                ? "bg-white text-primary shadow-neu-soft border border-white/50"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Wrench className="w-4 h-4" />
            Services ({services.length})
          </button>
        </div>

        {/* Contenu liste */}
        <div className="min-h-[200px]">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonLoader key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {paginatedList.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">
                  {tab === "products"
                    ? canCreate
                      ? "Aucun produit. Cliquez sur « Ajouter un produit » pour en créer."
                      : "Aucun produit enregistré pour cette entreprise."
                    : canCreate
                      ? "Aucun service. Cliquez sur « Ajouter un service » pour en créer."
                      : "Aucun service enregistré pour cette entreprise."}
                </div>
              ) : (
                <ul className="space-y-2">
                  {paginatedList.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50/80 border border-gray-100 shadow-neu-soft"
                    >
                      {tab === "products" ? (
                        <Package className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <Wrench className="w-4 h-4 text-primary shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-800">
                        {(item as Product).name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Pagination */}
              {list.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-gray-100">
                  <div className="text-[11px] text-gray-500">
                    Affichage de {(currentPage - 1) * ITEMS_PER_PAGE + 1} à{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, list.length)} sur{" "}
                    {list.length}{" "}
                    {tab === "products" ? "produits" : "services"}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((p) => Math.max(1, p - 1))
                      }
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Page précédente"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] text-gray-600 px-2">
                      Page {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Page suivante"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </NeumoCard>

      <ProductCreateSheet
        open={productSheetOpen}
        onClose={() => setProductSheetOpen(false)}
        onCreated={handleProductCreated}
        companyId={catalogCompanyId}
      />
      <ServiceCreateSheet
        open={serviceSheetOpen}
        onClose={() => setServiceSheetOpen(false)}
        onCreated={handleServiceCreated}
        companyId={catalogCompanyId}
      />
    </>
  );
}

export default withDashboardLayout(ProductsServicesPageInner);
