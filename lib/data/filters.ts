/**
 * Pure filter functions for report data
 * These functions filter arrays based on dimension values
 */

import type { Region, Category, Source, ActionItem } from '../types';

/**
 * Filter array by regions
 */
export function filterByRegion<T extends { region: Region }>(
  items: T[],
  regions: Region[]
): T[] {
  if (regions.length === 0 || regions.length === 3) {
    return items; // All regions selected
  }
  return items.filter(item => regions.includes(item.region));
}

/**
 * Filter array by categories
 */
export function filterByCategory<T extends { category: Category }>(
  items: T[],
  categories: Category[]
): T[] {
  if (categories.length === 0 || categories.length === 4) {
    return items; // All categories selected
  }
  return items.filter(item => categories.includes(item.category));
}

/**
 * Filter array by sources
 */
export function filterBySource<T extends { source: Source }>(
  items: T[],
  sources: Source[]
): T[] {
  if (sources.length === 0 || sources.length === 6) {
    return items; // All sources selected
  }
  return items.filter(item => sources.includes(item.source));
}

/**
 * Filter action items - include items with null region (product-wide) or matching region
 */
export function filterActionItems(items: ActionItem[], regions: Region[]): ActionItem[] {
  if (regions.length === 0 || regions.length === 3) {
    return items;
  }
  return items.filter(item => item.region === null || regions.includes(item.region as Region));
}

/**
 * Check if all categories are selected
 */
export function isAllCategories(categories: Category[]): boolean {
  return categories.length === 0 || categories.length === 4;
}

/**
 * Check if all sources are selected
 */
export function isAllSources(sources: Source[]): boolean {
  return sources.length === 0 || sources.length === 6;
}

/**
 * Check if all products are selected
 */
export function isAllProducts(products: string[]): boolean {
  return products.length === 0 || products.length === 2;
}

/**
 * Check if all regions are selected
 */
export function isAllRegions(regions: Region[]): boolean {
  return regions.length === 0 || regions.length === 3;
}
