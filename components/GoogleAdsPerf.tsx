'use client';

import { ReportData, GoogleAdsRegionalData, GoogleAdsData, GoogleAdsRCA, Region } from '@/lib/types';
import { formatCurrency, formatNumber, formatPercentDecimal } from '@/lib/formatters';
import SortableHeader from './SortableHeader';
import { useSortableTable } from '@/lib/useSortableTable';

interface GoogleAdsPerfProps {
  data: ReportData;
}

/**
 * Flattened row type for sortable table
 */
interface GoogleAdsRow {
  product: string;
  region: string | null; // null for totals
  impressions: number;
  clicks: number;
  ctr_pct: number;
  ad_spend_usd: number;
  cpc_usd: number;
  conversions: number;
  cpa_usd: number;
  isSubRow: boolean;
}

/**
 * Aggregate multiple regional Google Ads rows into a single summary
 */
function aggregateAdsData(rows: GoogleAdsRegionalData[]): GoogleAdsData | null {
  if (!rows || rows.length === 0) return null;

  const impressions = rows.reduce((sum, r) => sum + (r.impressions || 0), 0);
  const clicks = rows.reduce((sum, r) => sum + (r.clicks || 0), 0);
  const ad_spend_usd = rows.reduce((sum, r) => sum + (r.ad_spend_usd || 0), 0);
  const conversions = rows.reduce((sum, r) => sum + (r.conversions || 0), 0);

  return {
    impressions,
    clicks,
    ctr_pct: impressions > 0 ? (clicks / impressions) * 100 : 0,
    ad_spend_usd,
    cpc_usd: clicks > 0 ? ad_spend_usd / clicks : 0,
    conversions,
    cpa_usd: conversions > 0 ? ad_spend_usd / conversions : 0,
  };
}

/**
 * Get unique regions from ads data
 */
function getActiveRegions(porData: GoogleAdsRegionalData[], r360Data: GoogleAdsRegionalData[]): Region[] {
  const regions = new Set<Region>();
  porData.forEach(r => regions.add(r.region));
  r360Data.forEach(r => regions.add(r.region));
  return Array.from(regions).sort();
}

/**
 * Create flattened table rows for sorting
 */
function createTableRows(
  porData: GoogleAdsRegionalData[],
  r360Data: GoogleAdsRegionalData[],
  porTotal: GoogleAdsData | null,
  r360Total: GoogleAdsData | null,
  activeRegions: Region[]
): GoogleAdsRow[] {
  const rows: GoogleAdsRow[] = [];

  // Add POR rows
  if (porTotal) {
    rows.push({
      product: 'POR',
      region: null,
      ...porTotal,
      isSubRow: false,
    });

    // Add regional breakdowns if applicable
    if (activeRegions.length >= 1) {
      activeRegions.forEach(region => {
        const regionData = porData.find(r => r.region === region);
        if (regionData) {
          rows.push({
            product: 'POR',
            region,
            impressions: regionData.impressions || 0,
            clicks: regionData.clicks || 0,
            ctr_pct: regionData.impressions > 0 ? (regionData.clicks / regionData.impressions) * 100 : 0,
            ad_spend_usd: regionData.ad_spend_usd || 0,
            cpc_usd: regionData.clicks > 0 ? (regionData.ad_spend_usd || 0) / regionData.clicks : 0,
            conversions: regionData.conversions || 0,
            cpa_usd: regionData.conversions > 0 ? (regionData.ad_spend_usd || 0) / regionData.conversions : 0,
            isSubRow: true,
          });
        }
      });
    }
  }

  // Add R360 rows
  if (r360Total) {
    rows.push({
      product: 'R360',
      region: null,
      ...r360Total,
      isSubRow: false,
    });

    // Add regional breakdowns if applicable
    if (activeRegions.length >= 1) {
      activeRegions.forEach(region => {
        const regionData = r360Data.find(r => r.region === region);
        if (regionData) {
          rows.push({
            product: 'R360',
            region,
            impressions: regionData.impressions || 0,
            clicks: regionData.clicks || 0,
            ctr_pct: regionData.impressions > 0 ? (regionData.clicks / regionData.impressions) * 100 : 0,
            ad_spend_usd: regionData.ad_spend_usd || 0,
            cpc_usd: regionData.clicks > 0 ? (regionData.ad_spend_usd || 0) / regionData.clicks : 0,
            conversions: regionData.conversions || 0,
            cpa_usd: regionData.conversions > 0 ? (regionData.ad_spend_usd || 0) / regionData.conversions : 0,
            isSubRow: true,
          });
        }
      });
    }
  }

  return rows;
}

export default function GoogleAdsPerf({ data }: GoogleAdsPerfProps) {
  const { google_ads, google_ads_rca } = data;

  // Get active regions from filtered data
  const activeRegions = getActiveRegions(google_ads.POR || [], google_ads.R360 || []);

  // Aggregate totals for each product
  const porTotal = aggregateAdsData(google_ads.POR || []);
  const r360Total = aggregateAdsData(google_ads.R360 || []);

  // Don't render if no data
  if (!porTotal && !r360Total) {
    return null;
  }

  // Create flattened rows for sorting
  const tableRows = createTableRows(
    google_ads.POR || [],
    google_ads.R360 || [],
    porTotal,
    r360Total,
    activeRegions
  );

  // Column value getter for sorting
  const getColumnValue = (row: GoogleAdsRow, column: string): any => {
    switch (column) {
      case 'product_region':
        return row.region ? `${row.product} ${row.region}` : row.product;
      case 'impressions':
        return row.impressions;
      case 'clicks':
        return row.clicks;
      case 'ctr_pct':
        return row.ctr_pct;
      case 'ad_spend_usd':
        return row.ad_spend_usd;
      case 'cpc_usd':
        return row.cpc_usd;
      case 'conversions':
        return row.conversions;
      case 'cpa_usd':
        return row.cpa_usd;
      default:
        return '';
    }
  };

  // Use sortable table hook
  const { sortedData, handleSort, getSortDirection } = useSortableTable(
    tableRows,
    tableRows, // default order
    getColumnValue
  );

  return (
    <section>
      <h2>7. Google Ads Performance</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader
                label="Product / Region"
                column="product_region"
                sortDirection={getSortDirection('product_region')}
                onSort={handleSort}
              />
              <SortableHeader
                label="Impr"
                column="impressions"
                sortDirection={getSortDirection('impressions')}
                onSort={handleSort}
                className="right"
              />
              <SortableHeader
                label="Clicks"
                column="clicks"
                sortDirection={getSortDirection('clicks')}
                onSort={handleSort}
                className="right"
              />
              <SortableHeader
                label="CTR"
                column="ctr_pct"
                sortDirection={getSortDirection('ctr_pct')}
                onSort={handleSort}
                className="right"
              />
              <SortableHeader
                label="Spend"
                column="ad_spend_usd"
                sortDirection={getSortDirection('ad_spend_usd')}
                onSort={handleSort}
                className="right"
              />
              <SortableHeader
                label="CPC"
                column="cpc_usd"
                sortDirection={getSortDirection('cpc_usd')}
                onSort={handleSort}
                className="right"
              />
              <SortableHeader
                label="Conv"
                column="conversions"
                sortDirection={getSortDirection('conversions')}
                onSort={handleSort}
                className="right"
              />
              <SortableHeader
                label="CPA"
                column="cpa_usd"
                sortDirection={getSortDirection('cpa_usd')}
                onSort={handleSort}
                className="right"
              />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => (
              <tr key={`${row.product}-${row.region || 'total'}-${index}`} className={row.isSubRow ? 'sub-row' : ''}>
                <td style={row.isSubRow ? { paddingLeft: '20px', fontSize: '0.9em' } : {}}>
                  {row.region ? `↳ ${row.region}` : row.product}
                </td>
                <td className="right">{formatNumber(row.impressions)}</td>
                <td className="right">{formatNumber(row.clicks)}</td>
                <td className="right">{formatPercentDecimal(row.ctr_pct)}</td>
                <td className="right">{formatCurrency(row.ad_spend_usd)}</td>
                <td className="right">${(row.cpc_usd || 0).toFixed(2)}</td>
                <td className="right">{Math.round(row.conversions || 0)}</td>
                <td className="right">${Math.round(row.cpa_usd || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Google Ads RCA */}
      {google_ads_rca?.POR && google_ads_rca.POR.length > 0 && (
        <div className="ads-card">
          <strong>POR Ads Analysis:</strong>
          {google_ads_rca.POR.map((rca: GoogleAdsRCA, index: number) => (
            <div key={`por-rca-${rca.region}-${index}`} style={{ marginTop: index > 0 ? '10px' : '5px' }}>
              <span style={{ fontWeight: 500 }}>{rca.region}:</span>{' '}
              CTR {formatPercentDecimal(rca.ctr_pct)} ({rca.ctr_performance}) |{' '}
              CPA ${Math.round(rca.cpa_usd || 0)} ({rca.cpa_performance})
              {rca.rca_commentary && (
                <div className="rca" style={{ marginTop: '3px', marginLeft: '10px' }}>{rca.rca_commentary}</div>
              )}
              {rca.recommended_action && (
                <div className="action" style={{ marginLeft: '10px' }}>→ {rca.recommended_action}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {google_ads_rca?.R360 && google_ads_rca.R360.length > 0 && (
        <div className="ads-card">
          <strong>R360 Ads Analysis:</strong>
          {google_ads_rca.R360.map((rca: GoogleAdsRCA, index: number) => (
            <div key={`r360-rca-${rca.region}-${index}`} style={{ marginTop: index > 0 ? '10px' : '5px' }}>
              <span style={{ fontWeight: 500 }}>{rca.region}:</span>{' '}
              CTR {formatPercentDecimal(rca.ctr_pct)} ({rca.ctr_performance}) |{' '}
              CPA ${Math.round(rca.cpa_usd || 0)} ({rca.cpa_performance})
              {rca.rca_commentary && (
                <div className="rca" style={{ marginTop: '3px', marginLeft: '10px' }}>{rca.rca_commentary}</div>
              )}
              {rca.recommended_action && (
                <div className="action" style={{ marginLeft: '10px' }}>→ {rca.recommended_action}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
