/** Message affiché quand la conversion est refusée faute d'intérêts pivot (LeadProductInterest / LeadServiceInterest). */
export const CONVERT_REQUIRES_PIVOT_INTERESTS_MESSAGE =
  'Enregistrez au moins un produit ou un service dans « Intérêts & estimation » avant de convertir ce prospect.';

type InterestWithValue = { estimatedValue?: number | null };

/** Somme des valeurs estimatives (produits + services, catalogue et personnalisés). */
export function computeLeadInterestsRevenue(
  productInterests: InterestWithValue[],
  serviceInterests: InterestWithValue[],
): number {
  return [...productInterests, ...serviceInterests].reduce(
    (sum, interest) => sum + (interest.estimatedValue ?? 0),
    0,
  );
}

type CatalogProductInterest = {
  productId?: string | null;
  estimatedValue?: number | null;
};

type CatalogServiceInterest = {
  serviceId?: string | null;
  estimatedValue?: number | null;
};

export type ConversionSaleItemInput = {
  productId: string | null;
  serviceId: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/** Lignes de vente pour les intérêts catalogue (les intérêts personnalisés sont inclus dans le montant total). */
export function buildConversionSaleItems(
  productInterests: CatalogProductInterest[],
  serviceInterests: CatalogServiceInterest[],
): ConversionSaleItemInput[] {
  const items: ConversionSaleItemInput[] = [];

  for (const interest of productInterests) {
    if (!interest.productId) continue;
    const value = interest.estimatedValue ?? 0;
    items.push({
      productId: interest.productId,
      serviceId: null,
      quantity: 1,
      unitPrice: value,
      lineTotal: value,
    });
  }

  for (const interest of serviceInterests) {
    if (!interest.serviceId) continue;
    const value = interest.estimatedValue ?? 0;
    items.push({
      productId: null,
      serviceId: interest.serviceId,
      quantity: 1,
      unitPrice: value,
      lineTotal: value,
    });
  }

  return items;
}
