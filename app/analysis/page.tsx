'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Region, Product, TrendAnalysisData } from '@/lib/types';
import { parseRegionsFromURL, parseProductsFromURL } from '@/lib/filterData';
import ReportFilter from '@/components/ReportFilter';
import UserMenu from '@/components/UserMenu';
import DateRangePicker from '@/components/DateRangePicker';
import TrendKPICards from '@/components/TrendKPICards';
import TrendChart from '@/components/TrendChart';
import TrendComparisonTable from '@/components/TrendComparisonTable';
import LoadingOverlay from '@/components/LoadingOverlay';

type ActiveTab = 'revenue' | 'funnel';

function AnalysisContent() {
  const searchParams = useSearchParams();
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(
    parseRegionsFromURL(searchParams)
  );
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(
    parseProductsFromURL(searchParams)
  );
  const [trendData, setTrendData] = useState<TrendAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('revenue');

  const handleAnalyze = async (range: { startDate: string; endDate: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/trend-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: range.startDate,
          endDate: range.endDate,
          products: selectedProducts,
          regions: selectedRegions,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to analyze trends');
      }

      setTrendData(result.data);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze trends');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <LoadingOverlay isLoading={isLoading} />

      <div className="header-bar">
        <div>
          <h1>Trend Analysis</h1>
          <div className="meta">
            <span>Compare metrics across different time periods</span>
          </div>
        </div>
        <div className="header-actions">
          <UserMenu />
        </div>
      </div>

      <ReportFilter
        selectedRegions={selectedRegions}
        selectedProducts={selectedProducts}
        onRegionChange={setSelectedRegions}
        onProductChange={setSelectedProducts}
      />

      <DateRangePicker onAnalyze={handleAnalyze} isLoading={isLoading} />

      {error && (
        <div className="analysis-error">
          <strong>Analysis failed:</strong> {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {trendData && (
        <>
          <div className="period-banner" data-testid="period-banner">
            <div className="period-section">
              <span className="period-label">Current Period</span>
              <span className="period-value">
                {trendData.periodInfo.current.startDate} to {trendData.periodInfo.current.endDate}
              </span>
            </div>
            <div className="period-divider">vs</div>
            <div className="period-section">
              <span className="period-label">Previous Period</span>
              <span className="period-value">
                {trendData.periodInfo.previous.startDate} to {trendData.periodInfo.previous.endDate}
              </span>
            </div>
            <div className="period-section">
              <span className="period-label">Duration</span>
              <span className="period-value">{trendData.periodInfo.daysInPeriod} days</span>
            </div>
          </div>

          <TrendKPICards
            revenueSummary={trendData.revenueSummary}
            funnelSummary={trendData.funnelSummary}
          />

          <div className="tab-nav" data-testid="tab-nav">
            <button
              className={`tab-btn ${activeTab === 'revenue' ? 'active' : ''}`}
              onClick={() => setActiveTab('revenue')}
              data-testid="tab-revenue"
            >
              Revenue Metrics
            </button>
            <button
              className={`tab-btn ${activeTab === 'funnel' ? 'active' : ''}`}
              onClick={() => setActiveTab('funnel')}
              data-testid="tab-funnel"
            >
              Funnel Metrics
            </button>
          </div>

          {activeTab === 'revenue' && (
            <section data-testid="revenue-section">
              <TrendChart data={trendData.charts.acvTimeSeries} valueFormat="currency" />
              <TrendComparisonTable type="revenue" revenueData={trendData.revenueByDimension} />
            </section>
          )}

          {activeTab === 'funnel' && (
            <section data-testid="funnel-section">
              <div className="charts-grid">
                <TrendChart data={trendData.charts.mqlTimeSeries} valueFormat="number" />
                <TrendChart data={trendData.charts.sqlTimeSeries} valueFormat="number" />
              </div>
              <TrendComparisonTable type="funnel" funnelData={trendData.funnelByDimension} />
            </section>
          )}
        </>
      )}

      {!trendData && !isLoading && !error && (
        <div className="empty-state" data-testid="empty-state">
          <div className="empty-icon">📊</div>
          <h3>Select a Date Range to Analyze</h3>
          <p>
            Choose a date range above and click "Analyze" to compare metrics
            between the selected period and the previous period of equal length.
          </p>
          <ul className="empty-features">
            <li>Compare revenue metrics (ACV, deals, win rates)</li>
            <li>Track funnel progression (MQL, SQL, SAL, SQO)</li>
            <li>Visualize trends with interactive charts</li>
            <li>Filter by product and region</li>
          </ul>
        </div>
      )}

      <footer className="footer">
        <p>
          Trend Analysis | Generated {new Date().toISOString().split('T')[0]}
        </p>
      </footer>

      <style jsx>{`
        .analysis-error {
          margin-bottom: 20px;
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .analysis-error button {
          background: none;
          border: none;
          font-size: 20px;
          color: #dc2626;
          cursor: pointer;
          padding: 0 4px;
        }

        .period-banner {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 16px 20px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .period-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .period-label {
          font-size: 11px;
          font-weight: 600;
          color: #0369a1;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .period-value {
          font-size: 14px;
          font-weight: 500;
          color: #0c4a6e;
          font-family: monospace;
        }

        .period-divider {
          font-size: 14px;
          font-weight: 600;
          color: #0369a1;
        }

        .tab-nav {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 8px;
          width: fit-content;
        }

        .tab-btn {
          padding: 10px 20px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab-btn:hover {
          color: #3b82f6;
        }

        .tab-btn.active {
          background: white;
          color: #3b82f6;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        @media (max-width: 900px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }

        .empty-state {
          text-align: center;
          padding: 60px 40px;
          background: #f8fafc;
          border: 2px dashed #e2e8f0;
          border-radius: 12px;
          margin: 40px 0;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 12px 0;
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
        }

        .empty-state p {
          margin: 0 0 20px 0;
          color: #64748b;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        .empty-features {
          list-style: none;
          padding: 0;
          margin: 0;
          display: inline-flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
        }

        .empty-features li {
          color: #475569;
          font-size: 14px;
        }

        .empty-features li::before {
          content: '✓';
          color: #16a34a;
          margin-right: 8px;
          font-weight: bold;
        }

        .footer {
          text-align: center;
          padding: 20px;
          margin-top: 40px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 13px;
        }

        @media (max-width: 600px) {
          .period-banner {
            flex-direction: column;
            gap: 12px;
          }

          .period-divider {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <AnalysisContent />
    </Suspense>
  );
}
