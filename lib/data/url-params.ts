/**
 * URL parameter parsing and building utilities
 * For managing filter state in URL search params
 */

import type { Region, Product, Category, Source } from '../types';

const ALL_CATEGORIES: Category[] = ['NEW LOGO', 'EXPANSION', 'MIGRATION', 'RENEWAL'];
const ALL_SOURCES: Source[] = ['INBOUND', 'OUTBOUND', 'AE SOURCED', 'AM SOURCED', 'TRADESHOW', 'PARTNERSHIPS'];

/**
 * Parse regions from URL search params
 */
export function parseRegionsFromURL(searchParams: URLSearchParams): Region[] {
  const regionParam = searchParams.get('region');
  // No param or 'ALL' means no filter applied (show all, no checkboxes checked)
  if (!regionParam || regionParam === 'ALL') {
    return [];
  }

  const regions = regionParam.split(',').filter(r =>
    ['AMER', 'EMEA', 'APAC'].includes(r)
  ) as Region[];

  return regions;
}

/**
 * Build URL search params from regions
 */
export function buildRegionURL(regions: Region[]): string {
  if (regions.length === 0 || regions.length === 3) {
    return '?region=ALL';
  }
  return `?region=${regions.join(',')}`;
}

/**
 * Parse products from URL search params
 */
export function parseProductsFromURL(searchParams: URLSearchParams): Product[] {
  const productParam = searchParams.get('product');
  // No param or 'ALL' means no filter applied (show all, no checkboxes checked)
  if (!productParam || productParam === 'ALL') {
    return [];
  }

  const products = productParam.split(',').filter(p =>
    ['POR', 'R360'].includes(p)
  ) as Product[];

  return products;
}

/**
 * Parse categories from URL search params
 */
export function parseCategoriesFromURL(searchParams: URLSearchParams): Category[] {
  const categoryParam = searchParams.get('category');
  // No param or 'ALL' means no filter applied (show all, no checkboxes checked)
  if (!categoryParam || categoryParam === 'ALL') {
    return [];
  }

  const categories = categoryParam.split(',').filter(c =>
    ALL_CATEGORIES.includes(c as Category)
  ) as Category[];

  return categories;
}

/**
 * Parse sources from URL search params
 */
export function parseSourcesFromURL(searchParams: URLSearchParams): Source[] {
  const sourceParam = searchParams.get('source');
  // No param or 'ALL' means no filter applied (show all, no checkboxes checked)
  if (!sourceParam || sourceParam === 'ALL') {
    return [];
  }

  const sources = sourceParam.split(',').filter(s =>
    ALL_SOURCES.includes(s as Source)
  ) as Source[];

  return sources;
}

/**
 * Build URL search params from all filters
 */
export function buildFilterURL(
  regions: Region[],
  products: Product[],
  categories: Category[] = ALL_CATEGORIES,
  sources: Source[] = ALL_SOURCES
): string {
  const params = new URLSearchParams();

  // Add region param
  if (regions.length === 0 || regions.length === 3) {
    params.set('region', 'ALL');
  } else {
    params.set('region', regions.join(','));
  }

  // Add product param
  if (products.length === 0 || products.length === 2) {
    params.set('product', 'ALL');
  } else {
    params.set('product', products.join(','));
  }

  // Add category param
  if (categories.length === 0 || categories.length === 4) {
    params.set('category', 'ALL');
  } else {
    params.set('category', categories.join(','));
  }

  // Add source param
  if (sources.length === 0 || sources.length === 6) {
    params.set('source', 'ALL');
  } else {
    params.set('source', sources.join(','));
  }

  return `?${params.toString()}`;
}
