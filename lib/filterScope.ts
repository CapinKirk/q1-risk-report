import type { Category, Source, Region, Product } from './types';

const ALL_CATEGORIES: Category[] = ['NEW LOGO', 'STRATEGIC', 'EXPANSION', 'MIGRATION', 'RENEWAL'];
const ALL_SOURCES: Source[] = ['INBOUND', 'OUTBOUND', 'AE SOURCED', 'AM SOURCED', 'TRADESHOW', 'PARTNERSHIPS'];
const ALL_REGIONS: Region[] = ['AMER', 'EMEA', 'APAC'];
const ALL_PRODUCTS: Product[] = ['POR', 'R360'];

export interface FilterScopeInput {
  products?: string[];
  regions?: string[];
  categories?: string[];
  sources?: string[];
}

export interface FilterScope {
  activeProducts: Product[];
  activeRegions: Region[];
  activeCategories: Category[];
  activeSources: Source[];
  effectiveCategories: Category[];
  isOutboundOnly: boolean;
  onlyRenewal: boolean;
  suppressMQL: boolean;
  suppressGoogleAds: boolean;
  suppressUTM: boolean;
  suppressInboundAnalysis: boolean;
  suppressRenewal: boolean;
  excludedCategories: Category[];
  isFiltered: boolean;
}

function normalize<T extends string>(arr: string[] | undefined, all: T[]): T[] {
  if (!arr || arr.length === 0 || arr.length === all.length) return [...all];
  return arr.filter((v): v is T => (all as string[]).includes(v));
}

export function computeFilterScope(input: FilterScopeInput): FilterScope {
  const activeProducts = normalize(input.products, ALL_PRODUCTS);
  const activeRegions = normalize(input.regions, ALL_REGIONS);
  const activeCategories = normalize(input.categories, ALL_CATEGORIES);
  const activeSources = normalize(input.sources, ALL_SOURCES);

  const isOutboundOnly = activeSources.length === 1 && activeSources[0] === 'OUTBOUND';

  // Cross-rule: SDR outbound doesn't drive RENEWAL or MIGRATION — those are
  // AM-sourced / existing-customer motions, not SDR-sourced.
  const crossRuleExcluded: Category[] = isOutboundOnly ? ['RENEWAL', 'MIGRATION'] : [];
  const effectiveCategories = activeCategories.filter(c => !crossRuleExcluded.includes(c));

  const hasNewLogoFamily =
    effectiveCategories.includes('NEW LOGO') || effectiveCategories.includes('STRATEGIC');
  const hasRenewal = effectiveCategories.includes('RENEWAL');
  const onlyRenewal = effectiveCategories.length === 1 && effectiveCategories[0] === 'RENEWAL';

  // MQL / paid-search / UTM only feed NEW LOGO + STRATEGIC via inbound.
  const suppressMQL = isOutboundOnly || !hasNewLogoFamily;
  const suppressGoogleAds = suppressMQL;
  const suppressUTM = suppressMQL;
  const suppressInboundAnalysis = suppressMQL;
  const suppressRenewal = !hasRenewal;

  const excludedCategories = ALL_CATEGORIES.filter(c => !effectiveCategories.includes(c));

  const isFiltered =
    activeProducts.length < ALL_PRODUCTS.length ||
    activeRegions.length < ALL_REGIONS.length ||
    activeCategories.length < ALL_CATEGORIES.length ||
    activeSources.length < ALL_SOURCES.length;

  return {
    activeProducts,
    activeRegions,
    activeCategories,
    activeSources,
    effectiveCategories,
    isOutboundOnly,
    onlyRenewal,
    suppressMQL,
    suppressGoogleAds,
    suppressUTM,
    suppressInboundAnalysis,
    suppressRenewal,
    excludedCategories,
    isFiltered,
  };
}
