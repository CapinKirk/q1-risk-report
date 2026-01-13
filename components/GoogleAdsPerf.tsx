import { ReportData } from '@/lib/types';
import { formatCurrency, formatNumber, formatPercentDecimal } from '@/lib/formatters';

interface GoogleAdsPerfProps {
  data: ReportData;
}

export default function GoogleAdsPerf({ data }: GoogleAdsPerfProps) {
  const { google_ads, google_ads_rca } = data;

  const porAds = google_ads.POR;
  const r360Ads = google_ads.R360;

  return (
    <section>
      <h2>7. Google Ads Performance</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prod</th>
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
            <tr>
              <td>POR</td>
              <td className="right">{formatNumber(porAds?.impressions)}</td>
              <td className="right">{formatNumber(porAds?.clicks)}</td>
              <td className="right">{formatPercentDecimal(porAds?.ctr_pct)}</td>
              <td className="right">{formatCurrency(porAds?.ad_spend_usd)}</td>
              <td className="right">${(porAds?.cpc_usd || 0).toFixed(2)}</td>
              <td className="right">{Math.round(porAds?.conversions || 0)}</td>
              <td className="right">${Math.round(porAds?.cpa_usd || 0)}</td>
            </tr>
            <tr>
              <td>R360</td>
              <td className="right">{formatNumber(r360Ads?.impressions)}</td>
              <td className="right">{formatNumber(r360Ads?.clicks)}</td>
              <td className="right">{formatPercentDecimal(r360Ads?.ctr_pct)}</td>
              <td className="right">{formatCurrency(r360Ads?.ad_spend_usd)}</td>
              <td className="right">${(r360Ads?.cpc_usd || 0).toFixed(2)}</td>
              <td className="right">{Math.round(r360Ads?.conversions || 0)}</td>
              <td className="right">${Math.round(r360Ads?.cpa_usd || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Google Ads RCA */}
      {google_ads_rca?.POR && (
        <div className="ads-card">
          <strong>POR:</strong>
          CTR {formatPercentDecimal(google_ads_rca.POR.ctr_pct)} ({google_ads_rca.POR.ctr_performance}) |
          CPA ${Math.round(google_ads_rca.POR.cpa_usd || 0)} ({google_ads_rca.POR.cpa_performance})
          {google_ads_rca.POR.rca_commentary && (
            <div className="rca" style={{ marginTop: '5px' }}>{google_ads_rca.POR.rca_commentary}</div>
          )}
          {google_ads_rca.POR.recommended_action && (
            <div className="action">→ {google_ads_rca.POR.recommended_action}</div>
          )}
        </div>
      )}

      {google_ads_rca?.R360 && (
        <div className="ads-card">
          <strong>R360:</strong>
          CTR {formatPercentDecimal(google_ads_rca.R360.ctr_pct)} ({google_ads_rca.R360.ctr_performance}) |
          CPA ${Math.round(google_ads_rca.R360.cpa_usd || 0)} ({google_ads_rca.R360.cpa_performance})
          {google_ads_rca.R360.rca_commentary && (
            <div className="rca" style={{ marginTop: '5px' }}>{google_ads_rca.R360.rca_commentary}</div>
          )}
          {google_ads_rca.R360.recommended_action && (
            <div className="action">→ {google_ads_rca.R360.recommended_action}</div>
          )}
        </div>
      )}
    </section>
  );
}
