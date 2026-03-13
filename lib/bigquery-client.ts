/**
 * Shared BigQuery client initialization
 * Single source of truth for BigQuery connections
 */

import { BigQuery } from '@google-cloud/bigquery';
import { BIGQUERY_CONFIG } from './constants/dimensions';

let bigQueryInstance: BigQuery | null = null;

/**
 * Get or create BigQuery client instance
 * Handles credential loading from environment variables
 */
export function getBigQueryClient(): BigQuery {
  if (bigQueryInstance) {
    return bigQueryInstance;
  }

  // Try to get credentials from environment variable
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON ||
                          process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (credentialsJson) {
    try {
      const credentials = JSON.parse(credentialsJson);
      bigQueryInstance = new BigQuery({
        projectId: BIGQUERY_CONFIG.PROJECT_ID,
        credentials,
      });
      // BigQuery credentials loaded from environment variable
    } catch (error) {
      console.error('BigQuery: Failed to parse credentials JSON:', error instanceof Error ? error.message : 'Parse error');
      // Fall back to default credentials
      bigQueryInstance = new BigQuery({
        projectId: BIGQUERY_CONFIG.PROJECT_ID,
      });
    }
  } else {
    // Use Application Default Credentials
    bigQueryInstance = new BigQuery({
      projectId: BIGQUERY_CONFIG.PROJECT_ID,
    });
  }

  return bigQueryInstance;
}

/**
 * Execute a BigQuery query with error handling
 */
export async function executeQuery<T = any>(query: string): Promise<T[]> {
  const client = getBigQueryClient();

  try {
    const [rows] = await client.query({ query });
    return rows as T[];
  } catch (error: any) {
    console.error('BigQuery query error:', error.message);
    throw new Error(`BigQuery query failed: ${error.message}`);
  }
}

/**
 * Build a fully qualified table name
 */
export function getTableName(dataset: keyof typeof BIGQUERY_CONFIG.DATASETS, table: string): string {
  return `\`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS[dataset]}.${table}\``;
}

/**
 * Common filter builder for region/product filters
 */
export function buildFilterClause(
  regions: string[],
  products: string[],
  options: {
    regionColumn?: string;
    productColumn?: string;
    includeRegionMapping?: boolean;
  } = {}
): string {
  const {
    regionColumn = 'Division',
    productColumn = 'por_record__c',
    includeRegionMapping = true,
  } = options;

  // Defensive validation — reject unrecognized values regardless of caller
  const VALID_REGIONS = new Set(['AMER', 'EMEA', 'APAC']);
  const VALID_PRODUCTS = new Set(['POR', 'R360']);
  const safeRegions = regions.filter(r => VALID_REGIONS.has(r));
  const safeProducts = products.filter(p => VALID_PRODUCTS.has(p));

  const conditions: string[] = [];

  // Region filter
  if (safeRegions.length > 0 && safeRegions.length < 3) {
    if (includeRegionMapping) {
      // Map AMER/EMEA/APAC back to US/UK/AU for Salesforce queries
      const divisionValues = safeRegions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r] || r}'`;
      });
      conditions.push(`${regionColumn} IN (${divisionValues.join(', ')})`);
    } else {
      conditions.push(`${regionColumn} IN (${safeRegions.map(r => `'${r}'`).join(', ')})`);
    }
  }

  // Product filter
  if (safeProducts.length === 1) {
    const isPOR = safeProducts[0] === 'POR';
    conditions.push(`${productColumn} = ${isPOR}`);
  }

  return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
}

/**
 * Standard date range filter for Q1 2026
 */
export function getQ1DateRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  return {
    startDate: '2026-01-01',
    endDate,
  };
}

/**
 * Calculate quarter progress
 */
export function getQuarterProgress(asOfDate: string = new Date().toISOString().split('T')[0]): {
  daysElapsed: number;
  totalDays: number;
  percentComplete: number;
} {
  const quarterStart = new Date('2026-01-01');
  const quarterEnd = new Date('2026-03-31');
  const asOf = new Date(asOfDate);

  const totalDays = Math.ceil((quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((asOf.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24));
  const percentComplete = Math.round((daysElapsed / totalDays) * 1000) / 10;

  return { daysElapsed, totalDays, percentComplete };
}
