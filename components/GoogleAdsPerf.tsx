import { ReportData, GoogleAdsRegionalData, GoogleAdsData, GoogleAdsRCA, Region } from '@/lib/types';
import { formatCurrency, formatNumber, formatPercentDecimal } from '@/lib/formatters';

interface GoogleAdsPerfProps {
  data: ReportData;
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

export default function GoogleAdsPerf({ data }: GoogleAdsPerfProps) {
  const { google_ads, google_ads_rca } = data;

  // Get active regions from filtered data
  const activeRegions = getActiveRegions(google_ads.POR || [], google_ads.R360 || []);
  const showRegionalBreakdown = activeRegions.length > 1 || activeRegions.length === 1;

  // Aggregate totals for each product
  const porTotal = aggregateAdsData(google_ads.POR || []);
  const r360Total = aggregateAdsData(google_ads.R360 || []);

  // Helper to render a data row
  const renderRow = (label: string, ads: GoogleAdsData | null, isSubRow = false) => {
    if (!ads) return null;
    return (
      <tr className={isSubRow ? 'sub-row' : ''}>
        <td style={isSubRow ? { paddingLeft: '20px', fontSize: '0.9em' } : {}}>{label}</td>
        <td className="right">{formatNumber(ads.impressions)}</td>
        <td className="right">{formatNumber(ads.clicks)}</td>
        <td className="right">{formatPercentDecimal(ads.ctr_pct)}</td>
        <td className="right">{formatCurrency(ads.ad_spend_usd)}</td>
        <td className="right">${(ads.cpc_usd || 0).toFixed(2)}</td>
        <td className="right">{Math.round(ads.conversions || 0)}</td>
        <td className="right">${Math.round(ads.cpa_usd || 0)}</td>
      </tr>
    );
  };

  // Helper to get regional data for a product
  const getRegionalData = (productData: GoogleAdsRegionalData[], region: Region): GoogleAdsData | null => {
    const regionData = productData.find(r => r.region === region);
    return regionData || null;
  };

  return (
    <section>
      <h2>7. Google Ads Performance</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product / Region</th>
              <th className="right">Impr</th>
              <th className="right">Clicks</th>
              <th className="right">CTR</th>
              <th className="right">Spend</th>
              <th className="right">CPC</th>
              <th className="right">Conv</th>
              <th className="right">CPA</th>
            </tr>
          </thead>
          <tbody>
            {/* POR Section */}
            {porTotal && (
              <>
                {renderRow('POR', porTotal)}
                {showRegionalBreakdown && activeRegions.map(region => {
                  const regionData = getRegionalData(google_ads.POR || [], region);
                  return regionData ? renderRow(`↳ ${region}`, regionData, true) : null;
                })}
              </>
            )}

            {/* R360 Section */}
            {r360Total && (
              <>
                {renderRow('R360', r360Total)}
                {showRegionalBreakdown && activeRegions.map(region => {
                  const regionData = getRegionalData(google_ads.R360 || [], region);
                  return regionData ? renderRow(`↳ ${region}`, regionData, true) : null;
                })}
              </>
            )}
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
