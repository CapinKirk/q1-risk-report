'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Region, Product, Category, Source, TrendAnalysisData, MetricComparison } from '@/lib/types';
import { parseRegionsFromURL, parseProductsFromURL, parseCategoriesFromURL, parseSourcesFromURL } from '@/lib/filterData';
import ReportFilter from '@/components/ReportFilter';
import UserMenu from '@/components/UserMenu';
import ThemeToggle from '@/components/ThemeToggle';
import DateRangePicker from '@/components/DateRangePicker';
import TrendKPICards from '@/components/TrendKPICards';
import TrendChart from '@/components/TrendChart';
import TrendComparisonTable from '@/components/TrendComparisonTable';
import LoadingOverlay from '@/components/LoadingOverlay';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/formatters';

type ActiveTab = 'overview' | 'pacing' | 'revenue' | 'funnel' | 'pipeline' | 'google_ads' | 'insights' | 'deals';

// Helper component for metric comparison display
function MetricDelta({ metric, format = 'number' }: { metric: MetricComparison<number>; format?: 'currency' | 'number' | 'percent' }) {
  const formatter = format === 'currency' ? formatCurrency : format === 'percent' ? formatPercent : formatNumber;
  const trendClass = metric.trend === 'UP' ? 'trend-up' : metric.trend === 'DOWN' ? 'trend-down' : 'trend-flat';
  const trendIcon = metric.trend === 'UP' ? '↑' : metric.trend === 'DOWN' ? '↓' : '→';

  return (
    <span className={`metric-delta ${trendClass}`}>
      {trendIcon} {metric.deltaPercent > 0 ? '+' : ''}{metric.deltaPercent}%
    </span>
  );
}

// Helper component for RAG status badge
function RAGBadge({ status }: { status: string }) {
  return <span className={`rag-badge rag-${status.toLowerCase()}`}>{status}</span>;
}

// Helper component for severity badge
function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`severity-badge severity-${severity.toLowerCase()}`}>{severity}</span>;
}

// Deal type and source options
const DEAL_TYPES = ['New Business', 'Existing Business', 'Migration'];
const SOURCE_OPTIONS = ['INBOUND', 'OUTBOUND', 'AE SOURCED', 'AM SOURCED', 'TRADESHOW'];

function AnalysisContent() {
  const searchParams = useSearchParams();
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(
    parseRegionsFromURL(searchParams)
  );
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(
    parseProductsFromURL(searchParams)
  );
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(
    parseCategoriesFromURL(searchParams)
  );
  const [selectedGlobalSources, setSelectedGlobalSources] = useState<Source[]>(
    parseSourcesFromURL(searchParams)
  );
  const [trendData, setTrendData] = useState<TrendAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Deal filters (local to this page)
  const [selectedDealTypes, setSelectedDealTypes] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

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

  // Filter data based on selected products and regions
  const filterData = <T extends { product: Product; region: Region }>(data: T[]): T[] => {
    return data.filter(item => {
      const productMatch = selectedProducts.length === 0 || selectedProducts.includes(item.product);
      const regionMatch = selectedRegions.length === 0 || selectedRegions.includes(item.region);
      return productMatch && regionMatch;
    });
  };

  // Filter deals with additional deal type and source filters
  const filterDeals = (deals: any[]): any[] => {
    return deals.filter(deal => {
      const productMatch = selectedProducts.length === 0 || selectedProducts.includes(deal.product);
      const regionMatch = selectedRegions.length === 0 || selectedRegions.includes(deal.region);
      const typeMatch = selectedDealTypes.length === 0 || selectedDealTypes.includes(deal.dealType);
      const sourceMatch = selectedSources.length === 0 || selectedSources.includes(deal.source);
      return productMatch && regionMatch && typeMatch && sourceMatch;
    });
  };

  // Sort by attainment %, worst to best (ascending)
  const sortByAttainment = <T extends { qtdAttainmentPct?: any; attainmentPct?: any; mqlAttainmentPct?: any; mqlPacingPct?: any; funnelScore?: any }>(data: T[]): T[] => {
    return [...data].sort((a, b) => {
      const aVal = a.qtdAttainmentPct?.current ?? a.attainmentPct?.current ?? a.mqlAttainmentPct?.current ?? a.mqlPacingPct?.current ?? a.funnelScore?.current ?? 0;
      const bVal = b.qtdAttainmentPct?.current ?? b.attainmentPct?.current ?? b.mqlAttainmentPct?.current ?? b.mqlPacingPct?.current ?? b.funnelScore?.current ?? 0;
      return aVal - bVal; // Ascending - worst first
    });
  };

  // Calculate filtered grand total
  const getFilteredGrandTotal = () => {
    if (!trendData) return null;

    // If no filters, return original
    if (selectedProducts.length === 0) return trendData.grandTotal;

    // Otherwise, aggregate from productTotals
    const filteredProducts = Object.values(trendData.productTotals).filter((pt: any) =>
      selectedProducts.includes(pt.product)
    );

    if (filteredProducts.length === 0) return trendData.grandTotal;
    if (filteredProducts.length === 1) return filteredProducts[0];

    // Aggregate multiple products
    const aggregated = {
      product: 'FILTERED',
      totalQ1Target: filteredProducts.reduce((sum: number, pt: any) => sum + pt.totalQ1Target, 0),
      totalQtdTarget: { current: filteredProducts.reduce((sum: number, pt: any) => sum + pt.totalQtdTarget.current, 0), previous: 0, delta: 0, deltaPercent: 0, trend: 'FLAT' as const },
      totalQtdDeals: { current: filteredProducts.reduce((sum: number, pt: any) => sum + pt.totalQtdDeals.current, 0), previous: filteredProducts.reduce((sum: number, pt: any) => sum + pt.totalQtdDeals.previous, 0), delta: 0, deltaPercent: 0, trend: 'FLAT' as const },
      totalQtdAcv: { current: filteredProducts.reduce((sum: number, pt: any) => sum + pt.totalQtdAcv.current, 0), previous: filteredProducts.reduce((sum: number, pt: any) => sum + pt.totalQtdAcv.previous, 0), delta: 0, deltaPercent: 0, trend: 'FLAT' as const },
      totalQtdAttainmentPct: trendData.grandTotal.totalQtdAttainmentPct,
      totalQ1ProgressPct: trendData.grandTotal.totalQ1ProgressPct,
      totalQtdGap: { current: filteredProducts.reduce((sum: number, pt: any) => sum + pt.totalQtdGap.current, 0), previous: 0, delta: 0, deltaPercent: 0, trend: 'FLAT' as const },
      totalLostDeals: { current: filteredProducts.reduce((sum: number, pt: any) => sum + pt.totalLostDeals.current, 0), previous: 0, delta: 0, deltaPercent: 0, trend: 'FLAT' as const },
      totalLostAcv: { current: filteredProducts.reduce((sum: number, pt: any) => sum + pt.totalLostAcv.current, 0), previous: 0, delta: 0, deltaPercent: 0, trend: 'FLAT' as const },
      totalWinRatePct: trendData.grandTotal.totalWinRatePct,
      totalPipelineAcv: { current: filteredProducts.reduce((sum: number, pt: any) => sum + pt.totalPipelineAcv.current, 0), previous: 0, delta: 0, deltaPercent: 0, trend: 'FLAT' as const },
      totalPipelineCoverageX: trendData.grandTotal.totalPipelineCoverageX,
    };
    return aggregated;
  };

  // Filter action items
  const filterActionItems = (items: any[]): any[] => {
    return items.filter(item => {
      const productMatch = selectedProducts.length === 0 || selectedProducts.includes(item.product);
      const regionMatch = selectedRegions.length === 0 || !item.region || selectedRegions.includes(item.region);
      return productMatch && regionMatch;
    });
  };

  return (
    <div className="container">
      <LoadingOverlay isLoading={isLoading} />

      <div className="header-bar">
        <div>
          <h1>Trend Analysis</h1>
          <div className="meta">
            <span>Compare metrics across different time periods with full detail</span>
          </div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      <ReportFilter
        selectedRegions={selectedRegions}
        selectedProducts={selectedProducts}
        selectedCategories={selectedCategories}
        selectedSources={selectedGlobalSources}
        onRegionChange={setSelectedRegions}
        onProductChange={setSelectedProducts}
        onCategoryChange={setSelectedCategories}
        onSourceChange={setSelectedGlobalSources}
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

          {/* Tab Navigation */}
          <div className="tab-nav" data-testid="tab-nav">
            <button
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
              data-testid="tab-overview"
            >
              Overview
            </button>
            <button
              className={`tab-btn ${activeTab === 'pacing' ? 'active' : ''}`}
              onClick={() => setActiveTab('pacing')}
              data-testid="tab-pacing"
            >
              Pacing & Targets
            </button>
            <button
              className={`tab-btn ${activeTab === 'revenue' ? 'active' : ''}`}
              onClick={() => setActiveTab('revenue')}
              data-testid="tab-revenue"
            >
              Revenue
            </button>
            <button
              className={`tab-btn ${activeTab === 'funnel' ? 'active' : ''}`}
              onClick={() => setActiveTab('funnel')}
              data-testid="tab-funnel"
            >
              Funnel
            </button>
            <button
              className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('pipeline')}
              data-testid="tab-pipeline"
            >
              Pipeline & Losses
            </button>
            <button
              className={`tab-btn ${activeTab === 'google_ads' ? 'active' : ''}`}
              onClick={() => setActiveTab('google_ads')}
              data-testid="tab-google-ads"
            >
              Google Ads
            </button>
            <button
              className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
              onClick={() => setActiveTab('insights')}
              data-testid="tab-insights"
            >
              Insights
            </button>
            <button
              className={`tab-btn ${activeTab === 'deals' ? 'active' : ''}`}
              onClick={() => setActiveTab('deals')}
              data-testid="tab-deals"
            >
              Deals
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <section data-testid="overview-section">
              <h2 className="section-title">Executive Summary {(selectedProducts.length > 0 || selectedRegions.length > 0) && <span className="filter-indicator">(Filtered)</span>}</h2>

              {/* Filtered Grand Total */}
              {(() => {
                const filteredTotal = getFilteredGrandTotal();
                return filteredTotal && (
                  <div className="grand-total-grid">
                    <div className="gt-card">
                      <div className="gt-label">QTD ACV</div>
                      <div className="gt-value">{formatCurrency(filteredTotal.totalQtdAcv.current)}</div>
                      <MetricDelta metric={filteredTotal.totalQtdAcv} format="currency" />
                    </div>
                    <div className="gt-card">
                      <div className="gt-label">QTD Attainment</div>
                      <div className="gt-value">{filteredTotal.totalQtdAttainmentPct?.current ?? 0}%</div>
                    </div>
                    <div className="gt-card">
                      <div className="gt-label">Pipeline ACV</div>
                      <div className="gt-value">{formatCurrency(filteredTotal.totalPipelineAcv.current)}</div>
                    </div>
                    <div className="gt-card">
                      <div className="gt-label">Win Rate</div>
                      <div className="gt-value">{filteredTotal.totalWinRatePct?.current ?? 0}%</div>
                    </div>
                  </div>
                );
              })()}

              {/* Funnel Milestone Attainment Summary */}
              {trendData.funnelMilestoneAttainment && (
                <>
                  <h3 className="subsection-title">Funnel Milestone Attainment (sorted by Funnel Score, worst to best)</h3>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Region</th>
                          <th>MQL Att%</th>
                          <th>SQL Att%</th>
                          <th>SAL Att%</th>
                          <th>SQO Att%</th>
                          <th>Funnel Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortByAttainment(filterData(trendData.funnelMilestoneAttainment)).map((row: any, idx: number) => (
                          <tr key={idx}>
                            <td>{row.product}</td>
                            <td>{row.region}</td>
                            <td><span className={`pacing-badge pacing-${row.mqlRag.current.toLowerCase()}`}>{row.mqlAttainmentPct.current}%</span></td>
                            <td><span className={`pacing-badge pacing-${row.sqlRag.current.toLowerCase()}`}>{row.sqlAttainmentPct.current}%</span></td>
                            <td><span className={`pacing-badge pacing-${row.salRag.current.toLowerCase()}`}>{row.salAttainmentPct.current}%</span></td>
                            <td><span className={`pacing-badge pacing-${row.sqoRag.current.toLowerCase()}`}>{row.sqoAttainmentPct.current}%</span></td>
                            <td><span className={`funnel-score-badge score-${row.funnelScoreRag.current.toLowerCase()}`}>{row.funnelScore.current}</span> <MetricDelta metric={row.funnelScore} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="exec-counts-grid">
                <div className="exec-card exceeding">
                  <div className="exec-value">{trendData.executiveCounts.areasExceedingTarget.current}</div>
                  <div className="exec-label">Exceeding Target</div>
                  <MetricDelta metric={trendData.executiveCounts.areasExceedingTarget} />
                </div>
                <div className="exec-card at-risk">
                  <div className="exec-value">{trendData.executiveCounts.areasAtRisk.current}</div>
                  <div className="exec-label">At Risk</div>
                  <MetricDelta metric={trendData.executiveCounts.areasAtRisk} />
                </div>
                <div className="exec-card attention">
                  <div className="exec-value">{trendData.executiveCounts.areasNeedingAttention.current}</div>
                  <div className="exec-label">Needing Attention</div>
                  <MetricDelta metric={trendData.executiveCounts.areasNeedingAttention} />
                </div>
                <div className="exec-card momentum">
                  <div className="exec-value">{trendData.executiveCounts.areasWithMomentum.current}</div>
                  <div className="exec-label">With Momentum</div>
                  <MetricDelta metric={trendData.executiveCounts.areasWithMomentum} />
                </div>
              </div>

              <div className="charts-grid">
                <TrendChart data={trendData.charts.acvTimeSeries} valueFormat="currency" />
                <TrendChart data={trendData.charts.pipelineTimeSeries} valueFormat="currency" />
              </div>
            </section>
          )}

          {/* Pacing & Targets Tab */}
          {activeTab === 'pacing' && (
            <section data-testid="pacing-section">
              {/* Quarter Progress */}
              {trendData.period && (
                <>
                  <h2 className="section-title">Quarter Progress</h2>
                  <div className="quarter-progress-banner">
                    <div className="progress-item">
                      <span className="progress-label">Quarter Start</span>
                      <span className="progress-value">{trendData.period.quarterStart}</span>
                    </div>
                    <div className="progress-item">
                      <span className="progress-label">Days Elapsed</span>
                      <span className="progress-value">{trendData.period.daysElapsed} / {trendData.period.totalDays}</span>
                    </div>
                    <div className="progress-item">
                      <span className="progress-label">Days Remaining</span>
                      <span className="progress-value">{trendData.period.daysRemaining}</span>
                    </div>
                    <div className="progress-item highlight">
                      <span className="progress-label">Quarter % Complete</span>
                      <span className="progress-value">{trendData.period.quarterPctComplete}%</span>
                    </div>
                  </div>
                </>
              )}

              {/* Quarterly Targets */}
              {trendData.quarterlyTargets && (
                <>
                  <h2 className="section-title">Quarterly Targets</h2>
                  <div className="targets-grid">
                    <div className="target-card">
                      <div className="target-product">POR</div>
                      <div className="target-value">{formatCurrency(trendData.quarterlyTargets.POR_Q1_target)}</div>
                      <div className="target-label">Q1 Target</div>
                    </div>
                    <div className="target-card">
                      <div className="target-product">R360</div>
                      <div className="target-value">{formatCurrency(trendData.quarterlyTargets.R360_Q1_target)}</div>
                      <div className="target-label">Q1 Target</div>
                    </div>
                    <div className="target-card combined">
                      <div className="target-product">Combined</div>
                      <div className="target-value">{formatCurrency(trendData.quarterlyTargets.combined_Q1_target)}</div>
                      <div className="target-label">Q1 Target</div>
                    </div>
                  </div>
                </>
              )}

              {/* Grand Total - Filtered */}
              {(() => {
                const filteredTotal = getFilteredGrandTotal();
                return filteredTotal && (
                  <>
                    <h2 className="section-title">Grand Total Performance {(selectedProducts.length > 0 || selectedRegions.length > 0) && <span className="filter-indicator">(Filtered)</span>}</h2>
                    <div className="grand-total-grid">
                      <div className="gt-card">
                        <div className="gt-label">QTD ACV</div>
                        <div className="gt-value">{formatCurrency(filteredTotal.totalQtdAcv.current)}</div>
                        <MetricDelta metric={filteredTotal.totalQtdAcv} format="currency" />
                      </div>
                      <div className="gt-card">
                        <div className="gt-label">QTD Attainment</div>
                        <div className="gt-value">{filteredTotal.totalQtdAttainmentPct?.current ?? 0}%</div>
                      </div>
                      <div className="gt-card">
                        <div className="gt-label">Q1 Progress</div>
                        <div className="gt-value">{filteredTotal.totalQ1ProgressPct?.current ?? 0}%</div>
                      </div>
                      <div className="gt-card">
                        <div className="gt-label">QTD Gap</div>
                        <div className={`gt-value ${filteredTotal.totalQtdGap.current < 0 ? 'negative' : 'positive'}`}>
                          {formatCurrency(filteredTotal.totalQtdGap.current)}
                        </div>
                      </div>
                      <div className="gt-card">
                        <div className="gt-label">Pipeline ACV</div>
                        <div className="gt-value">{formatCurrency(filteredTotal.totalPipelineAcv.current)}</div>
                      </div>
                      <div className="gt-card">
                        <div className="gt-label">Pipeline Coverage</div>
                        <div className="gt-value">{filteredTotal.totalPipelineCoverageX?.current ?? 0}x</div>
                      </div>
                      <div className="gt-card">
                        <div className="gt-label">Win Rate</div>
                        <div className="gt-value">{filteredTotal.totalWinRatePct?.current ?? 0}%</div>
                      </div>
                      <div className="gt-card">
                        <div className="gt-label">Lost ACV</div>
                        <div className="gt-value negative">{formatCurrency(filteredTotal.totalLostAcv.current)}</div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Product Totals */}
              {trendData.productTotals && (
                <>
                  <h2 className="section-title">Product Totals</h2>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Q1 Target</th>
                          <th>QTD Target</th>
                          <th>QTD ACV</th>
                          <th>QTD Attainment</th>
                          <th>Q1 Progress</th>
                          <th>Gap</th>
                          <th>Pipeline</th>
                          <th>Coverage</th>
                          <th>Win Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(trendData.productTotals).filter((pt: any) =>
                          selectedProducts.length === 0 || selectedProducts.includes(pt.product)
                        ).map((pt: any, idx: number) => (
                          <tr key={idx}>
                            <td><strong>{pt.product}</strong></td>
                            <td>{formatCurrency(pt.totalQ1Target)}</td>
                            <td>{formatCurrency(pt.totalQtdTarget.current)}</td>
                            <td>{formatCurrency(pt.totalQtdAcv.current)} <MetricDelta metric={pt.totalQtdAcv} format="currency" /></td>
                            <td>{pt.totalQtdAttainmentPct.current}% <MetricDelta metric={pt.totalQtdAttainmentPct} format="percent" /></td>
                            <td>{pt.totalQ1ProgressPct.current}%</td>
                            <td className={pt.totalQtdGap.current < 0 ? 'negative' : 'positive'}>{formatCurrency(pt.totalQtdGap.current)}</td>
                            <td>{formatCurrency(pt.totalPipelineAcv.current)}</td>
                            <td>{pt.totalPipelineCoverageX.current}x</td>
                            <td>{pt.totalWinRatePct.current}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Pipeline Attainment */}
              {trendData.pipelineAttainment && (
                <>
                  <h2 className="section-title">Pipeline Attainment by Segment (sorted by Attainment %, worst to best)</h2>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Region</th>
                          <th>Category</th>
                          <th>Q1 Target</th>
                          <th>QTD Target</th>
                          <th>QTD ACV</th>
                          <th>Attainment %</th>
                          <th>Gap</th>
                          <th>Pipeline</th>
                          <th>Coverage</th>
                          <th>Req. Run Rate</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortByAttainment(filterData(trendData.pipelineAttainment)).map((row: any, idx: number) => (
                          <tr key={idx}>
                            <td>{row.product}</td>
                            <td>{row.region}</td>
                            <td>{row.category}</td>
                            <td>{formatCurrency(row.q1Target.current)}</td>
                            <td>{formatCurrency(row.qtdTarget.current)}</td>
                            <td>{formatCurrency(row.qtdAcv.current)} <MetricDelta metric={row.qtdAcv} format="currency" /></td>
                            <td>{row.qtdAttainmentPct.current}% <MetricDelta metric={row.qtdAttainmentPct} format="percent" /></td>
                            <td className={row.qtdGap.current < 0 ? 'negative' : 'positive'}>{formatCurrency(row.qtdGap.current)}</td>
                            <td>{formatCurrency(row.pipelineAcv.current)}</td>
                            <td>{row.pipelineCoverageX.current}x</td>
                            <td>{formatCurrency(row.requiredRunRate.current)}/day</td>
                            <td><RAGBadge status={row.ragStatus.current} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Funnel Pacing */}
              {trendData.funnelPacing && (
                <>
                  <h2 className="section-title">Funnel Pacing vs Targets <span className="table-subtitle">(sorted by MQL pacing %, worst to best)</span></h2>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Region</th>
                          <th>Source</th>
                          <th>MQL (Act/Tgt)</th>
                          <th>MQL Pacing</th>
                          <th>SQL (Act/Tgt)</th>
                          <th>SQL Pacing</th>
                          <th>SAL (Act/Tgt)</th>
                          <th>SAL Pacing</th>
                          <th>SQO (Act/Tgt)</th>
                          <th>SQO Pacing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortByAttainment(filterData(trendData.funnelPacing)).map((row: any, idx: number) => (
                          <tr key={idx}>
                            <td>{row.product}</td>
                            <td>{row.region}</td>
                            <td>{row.sourceChannel}</td>
                            <td>{row.actualMql.current} / {row.targetMql.current}</td>
                            <td>
                              <span className={`pacing-badge pacing-${row.mqlRag.current.toLowerCase()}`}>
                                {row.mqlPacingPct.current}%
                              </span>
                            </td>
                            <td>{row.actualSql.current} / {row.targetSql.current}</td>
                            <td>
                              <span className={`pacing-badge pacing-${row.sqlRag.current.toLowerCase()}`}>
                                {row.sqlPacingPct.current}%
                              </span>
                            </td>
                            <td>{row.actualSal.current} / {row.targetSal.current}</td>
                            <td>
                              <span className={`pacing-badge pacing-${row.salRag.current.toLowerCase()}`}>
                                {row.salPacingPct.current}%
                              </span>
                            </td>
                            <td>{row.actualSqo.current} / {row.targetSqo.current}</td>
                            <td>
                              <span className={`pacing-badge pacing-${row.sqoRag.current.toLowerCase()}`}>
                                {row.sqoPacingPct.current}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Revenue Tab */}
          {activeTab === 'revenue' && (
            <section data-testid="revenue-section">
              <h2 className="section-title">Revenue Analysis</h2>
              <TrendChart data={trendData.charts.acvTimeSeries} valueFormat="currency" />

              <h3 className="subsection-title">Attainment by Product/Region/Category</h3>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Region</th>
                      <th>Category</th>
                      <th>QTD ACV</th>
                      <th>QTD Target</th>
                      <th>Attainment %</th>
                      <th>Gap</th>
                      <th>Pipeline</th>
                      <th>Coverage</th>
                      <th>Win Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(trendData.attainmentDetail).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.product}</td>
                        <td>{row.region}</td>
                        <td>{row.category}</td>
                        <td>
                          {formatCurrency(row.qtdAcv.current)}
                          <MetricDelta metric={row.qtdAcv} format="currency" />
                        </td>
                        <td>{formatCurrency(row.qtdTarget.current)}</td>
                        <td>
                          {formatPercent(row.qtdAttainmentPct.current)}
                          <MetricDelta metric={row.qtdAttainmentPct} format="percent" />
                        </td>
                        <td className={row.qtdGap.current < 0 ? 'negative' : 'positive'}>
                          {formatCurrency(row.qtdGap.current)}
                        </td>
                        <td>{formatCurrency(row.pipelineAcv.current)}</td>
                        <td>{row.pipelineCoverageX.current.toFixed(1)}x</td>
                        <td>{formatPercent(row.winRatePct.current)}</td>
                        <td><RAGBadge status={row.ragStatus.current} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="subsection-title">Source Attainment <span className="table-subtitle">(sorted by Attainment %, worst to best)</span></h3>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Region</th>
                      <th>Source</th>
                      <th>QTD ACV</th>
                      <th>Deals</th>
                      <th>Attainment %</th>
                      <th>Gap</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortByAttainment(filterData(trendData.sourceAttainment)).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.product}</td>
                        <td>{row.region}</td>
                        <td>{row.source}</td>
                        <td>
                          {formatCurrency(row.qtdAcv.current)}
                          <MetricDelta metric={row.qtdAcv} format="currency" />
                        </td>
                        <td>{row.qtdDeals.current}</td>
                        <td>{formatPercent(row.attainmentPct.current)}</td>
                        <td className={row.gap.current < 0 ? 'negative' : 'positive'}>
                          {formatCurrency(row.gap.current)}
                        </td>
                        <td><RAGBadge status={row.ragStatus.current} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Funnel Tab */}
          {activeTab === 'funnel' && (
            <section data-testid="funnel-section">
              <h2 className="section-title">Funnel Analysis</h2>
              <div className="charts-grid">
                <TrendChart data={trendData.charts.mqlTimeSeries} valueFormat="number" />
                <TrendChart data={trendData.charts.sqlTimeSeries} valueFormat="number" />
              </div>

              <h3 className="subsection-title">Funnel Health by Region</h3>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Region</th>
                      <th>MQL</th>
                      <th>SQL</th>
                      <th>SAL</th>
                      <th>SQO</th>
                      <th>MQL→SQL %</th>
                      <th>SQL→SAL %</th>
                      <th>SAL→SQO %</th>
                      <th>Bottleneck</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(trendData.funnelHealth).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.product}</td>
                        <td>{row.region}</td>
                        <td>
                          {row.actualMql.current}
                          <MetricDelta metric={row.actualMql} />
                        </td>
                        <td>
                          {row.actualSql.current}
                          <MetricDelta metric={row.actualSql} />
                        </td>
                        <td>
                          {row.actualSal.current}
                          <MetricDelta metric={row.actualSal} />
                        </td>
                        <td>
                          {row.actualSqo.current}
                          <MetricDelta metric={row.actualSqo} />
                        </td>
                        <td>{formatPercent(row.mqlToSqlRate.current)}</td>
                        <td>{formatPercent(row.sqlToSalRate.current)}</td>
                        <td>{formatPercent(row.salToSqoRate.current)}</td>
                        <td><span className="bottleneck-badge">{row.primaryBottleneck.current}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="subsection-title">Funnel by Category</h3>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Region</th>
                      <th>Category</th>
                      <th>MQL</th>
                      <th>SQL</th>
                      <th>SAL</th>
                      <th>SQO</th>
                      <th>TOF Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(trendData.funnelByCategory).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.product}</td>
                        <td>{row.region}</td>
                        <td>{row.category}</td>
                        <td>{row.actualMql.current} <MetricDelta metric={row.actualMql} /></td>
                        <td>{row.actualSql.current} <MetricDelta metric={row.actualSql} /></td>
                        <td>{row.actualSal.current} <MetricDelta metric={row.actualSal} /></td>
                        <td>{row.actualSqo.current} <MetricDelta metric={row.actualSqo} /></td>
                        <td>{row.weightedTofScore.current}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="subsection-title">Week-over-Week Trends</h3>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Region</th>
                      <th>MQL 7d</th>
                      <th>MQL WoW %</th>
                      <th>SQL 7d</th>
                      <th>SQL WoW %</th>
                      <th>SAL 7d</th>
                      <th>SQO 7d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(trendData.funnelTrends).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.product}</td>
                        <td>{row.region}</td>
                        <td>{row.mqlCurrent7d.current}</td>
                        <td className={row.mqlWowPct.current > 0 ? 'positive' : row.mqlWowPct.current < 0 ? 'negative' : ''}>
                          {row.mqlWowPct.current > 0 ? '+' : ''}{row.mqlWowPct.current}%
                        </td>
                        <td>{row.sqlCurrent7d.current}</td>
                        <td className={row.sqlWowPct.current > 0 ? 'positive' : row.sqlWowPct.current < 0 ? 'negative' : ''}>
                          {row.sqlWowPct.current > 0 ? '+' : ''}{row.sqlWowPct.current}%
                        </td>
                        <td>{row.salCurrent7d.current}</td>
                        <td>{row.sqoCurrent7d.current}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Pipeline & Losses Tab */}
          {activeTab === 'pipeline' && (
            <section data-testid="pipeline-section">
              <h2 className="section-title">Pipeline Analysis</h2>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Region</th>
                      <th>Category</th>
                      <th>Pipeline ACV</th>
                      <th>Coverage</th>
                      <th>Opps</th>
                      <th>Avg Age</th>
                      <th>Health</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(trendData.pipelineRCA).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.product}</td>
                        <td>{row.region}</td>
                        <td>{row.category}</td>
                        <td>
                          {formatCurrency(row.pipelineAcv.current)}
                          <MetricDelta metric={row.pipelineAcv} format="currency" />
                        </td>
                        <td>{row.pipelineCoverageX.current.toFixed(1)}x</td>
                        <td>{row.pipelineOpps.current}</td>
                        <td>{row.pipelineAvgAgeDays.current} days</td>
                        <td><span className={`health-badge health-${row.pipelineHealth.current.toLowerCase().replace('_', '-')}`}>{row.pipelineHealth.current}</span></td>
                        <td><SeverityBadge severity={row.severity.current} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="section-title">Loss Reason Analysis</h2>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Region</th>
                      <th>Loss Reason</th>
                      <th>Deals</th>
                      <th>Lost ACV</th>
                      <th>% of Regional Loss</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(trendData.lossReasonRCA).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.product}</td>
                        <td>{row.region}</td>
                        <td>{row.lossReason}</td>
                        <td>{row.dealCount.current} <MetricDelta metric={row.dealCount} /></td>
                        <td>{formatCurrency(row.lostAcv.current)}</td>
                        <td>{formatPercent(row.pctOfRegionalLoss.current)}</td>
                        <td><SeverityBadge severity={row.severity.current} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Google Ads Tab */}
          {activeTab === 'google_ads' && (
            <section data-testid="google-ads-section">
              <h2 className="section-title">Google Ads Performance</h2>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Region</th>
                      <th>Impressions</th>
                      <th>Clicks</th>
                      <th>CTR %</th>
                      <th>Spend</th>
                      <th>CPC</th>
                      <th>Conversions</th>
                      <th>CPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(trendData.googleAds).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.product}</td>
                        <td>{row.region}</td>
                        <td>{formatNumber(row.impressions.current)} <MetricDelta metric={row.impressions} /></td>
                        <td>{formatNumber(row.clicks.current)}</td>
                        <td>{formatPercent(row.ctrPct.current)}</td>
                        <td>{formatCurrency(row.adSpendUsd.current)}</td>
                        <td>{formatCurrency(row.cpcUsd.current)}</td>
                        <td>{formatNumber(row.conversions.current)}</td>
                        <td>{formatCurrency(row.cpaUsd.current)} <MetricDelta metric={row.cpaUsd} format="currency" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="subsection-title">Google Ads RCA</h3>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Region</th>
                      <th>CTR Perf</th>
                      <th>CPA Perf</th>
                      <th>Severity</th>
                      <th>Commentary</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(trendData.googleAdsRCA).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.product}</td>
                        <td>{row.region}</td>
                        <td><span className={`perf-badge perf-${row.ctrPerformance.current.toLowerCase()}`}>{row.ctrPerformance.current}</span></td>
                        <td><span className={`perf-badge perf-${row.cpaPerformance.current.toLowerCase()}`}>{row.cpaPerformance.current}</span></td>
                        <td><SeverityBadge severity={row.severity.current} /></td>
                        <td className="commentary-cell">{row.rcaCommentary.current}</td>
                        <td className="action-cell">{row.recommendedAction.current}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && (
            <section data-testid="insights-section">
              {/* Bright Spots */}
              {trendData.winsBrightSpots.length > 0 && (
                <>
                  <h2 className="section-title">Wins & Bright Spots</h2>
                  <div className="bright-spots-grid">
                    {filterData(trendData.winsBrightSpots).map((spot, idx) => (
                      <div key={idx} className="bright-spot-card">
                        <div className="spot-header">
                          <span className="spot-label">{spot.product} - {spot.region} - {spot.category}</span>
                          <span className={`tier-badge tier-${spot.performanceTier.current.toLowerCase().replace('_', '-')}`}>
                            {spot.performanceTier.current}
                          </span>
                        </div>
                        <div className="spot-metrics">
                          <div className="spot-metric">
                            <span className="metric-value">{formatPercent(spot.qtdAttainmentPct.current)}</span>
                            <span className="metric-label">Attainment</span>
                          </div>
                          <div className="spot-metric">
                            <span className="metric-value">{formatCurrency(spot.qtdAcv.current)}</span>
                            <span className="metric-label">ACV</span>
                          </div>
                          <div className="spot-metric">
                            <span className="metric-value">{formatPercent(spot.winRatePct.current)}</span>
                            <span className="metric-label">Win Rate</span>
                          </div>
                        </div>
                        <p className="spot-commentary">{spot.successCommentary.current}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Risk Pockets */}
              {trendData.topRiskPockets.length > 0 && (
                <>
                  <h2 className="section-title">Top Risk Pockets</h2>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Region</th>
                          <th>Category</th>
                          <th>Attainment</th>
                          <th>Gap</th>
                          <th>Win Rate</th>
                          <th>Pipeline</th>
                          <th>Coverage</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterData(trendData.topRiskPockets).map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.product}</td>
                            <td>{row.region}</td>
                            <td>{row.category}</td>
                            <td>{formatPercent(row.qtdAttainmentPct.current)}</td>
                            <td className="negative">{formatCurrency(row.qtdGap.current)}</td>
                            <td>{formatPercent(row.winRatePct.current)}</td>
                            <td>{formatCurrency(row.pipelineAcv.current)}</td>
                            <td>{row.pipelineCoverageX.current.toFixed(1)}x</td>
                            <td><RAGBadge status={row.ragStatus.current} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Momentum Indicators */}
              <h2 className="section-title">Momentum Indicators</h2>
              <div className="momentum-grid">
                {filterData(trendData.momentumIndicators).map((ind, idx) => (
                  <div key={idx} className={`momentum-card momentum-${ind.momentumTier.current.toLowerCase().replace('_', '-')}`}>
                    <div className="momentum-header">
                      <span className="momentum-label">{ind.product} - {ind.region}</span>
                      <span className="momentum-tier">{ind.momentumTier.current.replace('_', ' ')}</span>
                    </div>
                    <div className="momentum-trends">
                      <span className={`trend-indicator trend-${ind.mqlTrend.current.toLowerCase()}`}>MQL {ind.mqlTrend.current}</span>
                      <span className={`trend-indicator trend-${ind.sqlTrend.current.toLowerCase()}`}>SQL {ind.sqlTrend.current}</span>
                    </div>
                    <p className="momentum-commentary">{ind.momentumCommentary.current}</p>
                  </div>
                ))}
              </div>

              {/* Action Items */}
              <h2 className="section-title">Action Items</h2>
              <div className="action-items-section">
                <h3 className="urgency-header urgency-immediate">Immediate ({filterActionItems(trendData.actionItems.immediate).length})</h3>
                {filterActionItems(trendData.actionItems.immediate).map((item, idx) => (
                  <div key={idx} className="action-item-card action-immediate">
                    <div className="action-header">
                      <span className="action-category">{item.category}</span>
                      <span className="action-context">{item.product} {item.region && `- ${item.region}`}</span>
                      <span className={`severity-badge severity-${item.severity.toLowerCase()}`}>{item.severity}</span>
                      {item.isNew && <span className="new-badge">NEW</span>}
                    </div>
                    <div className="action-content">
                      <div className="action-issue-section">
                        <span className="action-label">Issue:</span>
                        <p className="action-issue">{item.issue}</p>
                      </div>
                      {item.reason && (
                        <div className="action-reason-section">
                          <span className="action-label">Root Cause:</span>
                          <p className="action-reason">{item.reason}</p>
                        </div>
                      )}
                      {item.metric && (
                        <div className="action-metric-section">
                          <span className="action-label">Key Metric:</span>
                          <span className="action-metric">{item.metric}</span>
                        </div>
                      )}
                      <div className="action-recommendation-section">
                        <span className="action-label">Recommended Action:</span>
                        <p className="action-recommendation">{item.action}</p>
                      </div>
                    </div>
                  </div>
                ))}

                <h3 className="urgency-header urgency-short-term">Short Term ({filterActionItems(trendData.actionItems.shortTerm).length})</h3>
                {filterActionItems(trendData.actionItems.shortTerm).map((item, idx) => (
                  <div key={idx} className="action-item-card action-short-term">
                    <div className="action-header">
                      <span className="action-category">{item.category}</span>
                      <span className="action-context">{item.product} {item.region && `- ${item.region}`}</span>
                      <span className={`severity-badge severity-${item.severity.toLowerCase()}`}>{item.severity}</span>
                      {item.isNew && <span className="new-badge">NEW</span>}
                    </div>
                    <div className="action-content">
                      <div className="action-issue-section">
                        <span className="action-label">Issue:</span>
                        <p className="action-issue">{item.issue}</p>
                      </div>
                      {item.reason && (
                        <div className="action-reason-section">
                          <span className="action-label">Root Cause:</span>
                          <p className="action-reason">{item.reason}</p>
                        </div>
                      )}
                      {item.metric && (
                        <div className="action-metric-section">
                          <span className="action-label">Key Metric:</span>
                          <span className="action-metric">{item.metric}</span>
                        </div>
                      )}
                      <div className="action-recommendation-section">
                        <span className="action-label">Recommended Action:</span>
                        <p className="action-recommendation">{item.action}</p>
                      </div>
                    </div>
                  </div>
                ))}

                <h3 className="urgency-header urgency-strategic">Strategic ({filterActionItems(trendData.actionItems.strategic).length})</h3>
                {filterActionItems(trendData.actionItems.strategic).map((item, idx) => (
                  <div key={idx} className="action-item-card action-strategic">
                    <div className="action-header">
                      <span className="action-category">{item.category}</span>
                      <span className="action-context">{item.product} {item.region && `- ${item.region}`}</span>
                      <span className={`severity-badge severity-${item.severity.toLowerCase()}`}>{item.severity}</span>
                      {item.isNew && <span className="new-badge">NEW</span>}
                    </div>
                    <div className="action-content">
                      <div className="action-issue-section">
                        <span className="action-label">Issue:</span>
                        <p className="action-issue">{item.issue}</p>
                      </div>
                      {item.reason && (
                        <div className="action-reason-section">
                          <span className="action-label">Root Cause:</span>
                          <p className="action-reason">{item.reason}</p>
                        </div>
                      )}
                      {item.metric && (
                        <div className="action-metric-section">
                          <span className="action-label">Key Metric:</span>
                          <span className="action-metric">{item.metric}</span>
                        </div>
                      )}
                      <div className="action-recommendation-section">
                        <span className="action-label">Recommended Action:</span>
                        <p className="action-recommendation">{item.action}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Deals Tab */}
          {activeTab === 'deals' && (
            <section data-testid="deals-section">
              {/* Deal Filters */}
              <div className="deal-filters">
                <div className="filter-group">
                  <label className="filter-label">Deal Type:</label>
                  <div className="filter-chips">
                    {DEAL_TYPES.map(type => (
                      <button
                        key={type}
                        className={`filter-chip ${selectedDealTypes.includes(type) ? 'active' : ''}`}
                        onClick={() => setSelectedDealTypes(prev =>
                          prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                        )}
                      >
                        {type}
                      </button>
                    ))}
                    {selectedDealTypes.length > 0 && (
                      <button className="clear-filter" onClick={() => setSelectedDealTypes([])}>Clear</button>
                    )}
                  </div>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Source:</label>
                  <div className="filter-chips">
                    {SOURCE_OPTIONS.map(source => (
                      <button
                        key={source}
                        className={`filter-chip ${selectedSources.includes(source) ? 'active' : ''}`}
                        onClick={() => setSelectedSources(prev =>
                          prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
                        )}
                      >
                        {source}
                      </button>
                    ))}
                    {selectedSources.length > 0 && (
                      <button className="clear-filter" onClick={() => setSelectedSources([])}>Clear</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Deal Summary Cards */}
              <div className="deal-summary-cards">
                <div className="deal-summary-card won">
                  <div className="deal-summary-icon">✓</div>
                  <div className="deal-summary-content">
                    <div className="deal-summary-value">{filterDeals(trendData.wonDeals).length}</div>
                    <div className="deal-summary-label">Won Deals</div>
                    <div className="deal-summary-acv">
                      {formatCurrency(filterDeals(trendData.wonDeals).reduce((sum, d) => sum + d.acv, 0))}
                    </div>
                  </div>
                </div>
                <div className="deal-summary-card lost">
                  <div className="deal-summary-icon">✗</div>
                  <div className="deal-summary-content">
                    <div className="deal-summary-value">{filterDeals(trendData.lostDeals).length}</div>
                    <div className="deal-summary-label">Lost Deals</div>
                    <div className="deal-summary-acv">
                      {formatCurrency(filterDeals(trendData.lostDeals).reduce((sum, d) => sum + d.acv, 0))}
                    </div>
                  </div>
                </div>
                <div className="deal-summary-card pipeline">
                  <div className="deal-summary-icon">◎</div>
                  <div className="deal-summary-content">
                    <div className="deal-summary-value">{filterDeals(trendData.pipelineDeals).length}</div>
                    <div className="deal-summary-label">Pipeline Deals</div>
                    <div className="deal-summary-acv">
                      {formatCurrency(filterDeals(trendData.pipelineDeals).reduce((sum, d) => sum + d.acv, 0))}
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="section-title">Won Deals (sorted by ACV, highest first)</h2>
              <div className="data-table-wrapper">
                <table className="data-table deals-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Opportunity</th>
                      <th>Product</th>
                      <th>Region</th>
                      <th>Category</th>
                      <th>Deal Type</th>
                      <th>ACV</th>
                      <th>Close Date</th>
                      <th>Source</th>
                      <th>Owner</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterDeals(trendData.wonDeals).sort((a, b) => b.acv - a.acv).map((deal, idx) => (
                      <tr key={idx} className="deal-row won-deal">
                        <td className="account-cell">{deal.accountName}</td>
                        <td className="opp-cell">{deal.opportunityName}</td>
                        <td><span className={`product-badge product-${deal.product.toLowerCase()}`}>{deal.product}</span></td>
                        <td>{deal.region}</td>
                        <td><span className={`category-badge cat-${deal.category.toLowerCase().replace(' ', '-')}`}>{deal.category}</span></td>
                        <td>{deal.dealType}</td>
                        <td className="acv-cell">{formatCurrency(deal.acv)}</td>
                        <td>{deal.closeDate}</td>
                        <td>{deal.source}</td>
                        <td>{deal.ownerName}</td>
                        <td><a href={deal.salesforceUrl} target="_blank" rel="noopener noreferrer" className="sf-link">SF ↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="section-title">Lost Deals <span className="table-subtitle">(sorted by ACV, highest first)</span></h2>
              <div className="data-table-wrapper">
                <table className="data-table deals-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Opportunity</th>
                      <th>Product</th>
                      <th>Region</th>
                      <th>Category</th>
                      <th>Deal Type</th>
                      <th>ACV</th>
                      <th>Loss Reason</th>
                      <th>Close Date</th>
                      <th>Source</th>
                      <th>Owner</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterDeals(trendData.lostDeals).sort((a, b) => b.acv - a.acv).map((deal, idx) => (
                      <tr key={idx} className="deal-row lost-deal">
                        <td className="account-cell">{deal.accountName}</td>
                        <td className="opp-cell">{deal.opportunityName}</td>
                        <td><span className={`product-badge product-${deal.product.toLowerCase()}`}>{deal.product}</span></td>
                        <td>{deal.region}</td>
                        <td><span className={`category-badge cat-${deal.category.toLowerCase().replace(' ', '-')}`}>{deal.category}</span></td>
                        <td>{deal.dealType}</td>
                        <td className="acv-cell negative">{formatCurrency(deal.acv)}</td>
                        <td className="loss-reason-cell">{deal.lossReason || '-'}</td>
                        <td>{deal.closeDate}</td>
                        <td>{deal.source}</td>
                        <td>{deal.ownerName}</td>
                        <td><a href={deal.salesforceUrl} target="_blank" rel="noopener noreferrer" className="sf-link">SF ↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="section-title">Pipeline Deals <span className="table-subtitle">(sorted by ACV, highest first)</span></h2>
              <div className="data-table-wrapper">
                <table className="data-table deals-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Opportunity</th>
                      <th>Product</th>
                      <th>Region</th>
                      <th>Category</th>
                      <th>Deal Type</th>
                      <th>ACV</th>
                      <th>Stage</th>
                      <th>Close Date</th>
                      <th>Source</th>
                      <th>Owner</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterDeals(trendData.pipelineDeals).sort((a, b) => b.acv - a.acv).map((deal, idx) => (
                      <tr key={idx} className="deal-row pipeline-deal">
                        <td className="account-cell">{deal.accountName}</td>
                        <td className="opp-cell">{deal.opportunityName}</td>
                        <td><span className={`product-badge product-${deal.product.toLowerCase()}`}>{deal.product}</span></td>
                        <td>{deal.region}</td>
                        <td><span className={`category-badge cat-${deal.category.toLowerCase().replace(' ', '-')}`}>{deal.category}</span></td>
                        <td>{deal.dealType}</td>
                        <td className="acv-cell">{formatCurrency(deal.acv)}</td>
                        <td><span className={`stage-badge stage-${deal.stage.toLowerCase().replace(' ', '-')}`}>{deal.stage}</span></td>
                        <td>{deal.closeDate}</td>
                        <td>{deal.source}</td>
                        <td>{deal.ownerName}</td>
                        <td><a href={deal.salesforceUrl} target="_blank" rel="noopener noreferrer" className="sf-link">SF ↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            <li>Analyze pipeline health and loss reasons</li>
            <li>Review Google Ads performance</li>
            <li>View action items and insights</li>
            <li>Drill into individual deals</li>
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
          flex-wrap: wrap;
        }

        .tab-btn {
          padding: 10px 16px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 13px;
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

        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin: 24px 0 16px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #e2e8f0;
        }

        .subsection-title {
          font-size: 15px;
          font-weight: 600;
          color: #475569;
          margin: 20px 0 12px 0;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }

        @media (max-width: 900px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }

        .exec-counts-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        @media (max-width: 768px) {
          .exec-counts-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .exec-card {
          padding: 20px;
          border-radius: 12px;
          text-align: center;
        }

        .exec-card.exceeding { background: #ecfdf5; border: 1px solid #a7f3d0; }
        .exec-card.at-risk { background: #fef2f2; border: 1px solid #fecaca; }
        .exec-card.attention { background: #fffbeb; border: 1px solid #fde68a; }
        .exec-card.momentum { background: #eff6ff; border: 1px solid #bfdbfe; }

        .exec-value {
          font-size: 36px;
          font-weight: 700;
          color: #1e293b;
        }

        .exec-label {
          font-size: 13px;
          color: #64748b;
          margin-top: 4px;
        }

        .data-table-wrapper {
          overflow-x: auto;
          margin-bottom: 20px;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .data-table th {
          background: #f8fafc;
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
          white-space: nowrap;
        }

        .data-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #e2e8f0;
          color: #1e293b;
        }

        .data-table tr:hover {
          background: #f8fafc;
        }

        .data-table .negative {
          color: #dc2626;
        }

        .data-table .positive {
          color: #16a34a;
        }

        .metric-delta {
          display: inline-block;
          font-size: 11px;
          margin-left: 4px;
          padding: 2px 4px;
          border-radius: 4px;
        }

        .trend-up { color: #16a34a; background: #dcfce7; }
        .trend-down { color: #dc2626; background: #fee2e2; }
        .trend-flat { color: #64748b; background: #f1f5f9; }

        .rag-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .rag-green { background: #dcfce7; color: #166534; }
        .rag-yellow { background: #fef9c3; color: #854d0e; }
        .rag-red { background: #fee2e2; color: #991b1b; }

        .severity-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .severity-critical { background: #fee2e2; color: #991b1b; }
        .severity-high { background: #ffedd5; color: #9a3412; }
        .severity-medium { background: #fef9c3; color: #854d0e; }
        .severity-low { background: #dcfce7; color: #166534; }

        .health-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .health-healthy { background: #dcfce7; color: #166534; }
        .health-adequate { background: #dbeafe; color: #1e40af; }
        .health-at-risk { background: #fef9c3; color: #854d0e; }
        .health-critical { background: #fee2e2; color: #991b1b; }

        .bottleneck-badge {
          display: inline-block;
          padding: 4px 8px;
          background: #f1f5f9;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #475569;
        }

        .perf-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .perf-strong, .perf-efficient { background: #dcfce7; color: #166534; }
        .perf-average { background: #fef9c3; color: #854d0e; }
        .perf-weak, .perf-expensive { background: #fee2e2; color: #991b1b; }

        .commentary-cell, .action-cell {
          max-width: 250px;
          font-size: 12px;
          color: #64748b;
        }

        .bright-spots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .bright-spot-card {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          border-radius: 12px;
          padding: 16px;
        }

        .spot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .spot-label {
          font-weight: 600;
          color: #166534;
        }

        .tier-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .tier-exceptional { background: #dcfce7; color: #166534; }
        .tier-on-track { background: #dbeafe; color: #1e40af; }
        .tier-needs-attention { background: #fef9c3; color: #854d0e; }

        .spot-metrics {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
        }

        .spot-metric {
          display: flex;
          flex-direction: column;
        }

        .spot-metric .metric-value {
          font-size: 18px;
          font-weight: 700;
          color: #166534;
        }

        .spot-metric .metric-label {
          font-size: 11px;
          color: #64748b;
        }

        .spot-commentary {
          font-size: 13px;
          color: #475569;
          margin: 0;
        }

        .momentum-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .momentum-card {
          border-radius: 12px;
          padding: 16px;
        }

        .momentum-strong-momentum { background: #dcfce7; border: 1px solid #a7f3d0; }
        .momentum-moderate-momentum { background: #dbeafe; border: 1px solid #bfdbfe; }
        .momentum-no-momentum { background: #f1f5f9; border: 1px solid #e2e8f0; }
        .momentum-declining { background: #fee2e2; border: 1px solid #fecaca; }

        .momentum-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .momentum-label {
          font-weight: 600;
          color: #1e293b;
        }

        .momentum-tier {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .momentum-trends {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }

        .trend-indicator {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .trend-indicator.trend-up { background: #dcfce7; color: #166534; }
        .trend-indicator.trend-down { background: #fee2e2; color: #991b1b; }
        .trend-indicator.trend-flat { background: #f1f5f9; color: #64748b; }

        .momentum-commentary {
          font-size: 13px;
          color: #475569;
          margin: 0;
        }

        .action-items-section {
          margin-bottom: 24px;
        }

        .urgency-header {
          font-size: 14px;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 6px;
          margin: 16px 0 8px 0;
        }

        .urgency-immediate { background: #fee2e2; color: #991b1b; }
        .urgency-short-term { background: #ffedd5; color: #9a3412; }
        .urgency-strategic { background: #dbeafe; color: #1e40af; }

        .action-item-card {
          padding: 16px 20px;
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .action-immediate { background: #fff5f5; border-left: 4px solid #dc2626; }
        .action-short-term { background: #fffaf0; border-left: 4px solid #ea580c; }
        .action-strategic { background: #f0f9ff; border-left: 4px solid #3b82f6; }

        .action-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .action-category {
          font-size: 11px;
          font-weight: 600;
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          color: #475569;
        }

        .action-context {
          font-size: 12px;
          color: #64748b;
        }

        .severity-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .severity-critical { background: #dc2626; color: white; }
        .severity-high { background: #ea580c; color: white; }
        .severity-medium { background: #ca8a04; color: white; }
        .severity-low { background: #64748b; color: white; }

        .new-badge {
          font-size: 10px;
          font-weight: 600;
          background: #3b82f6;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .action-content {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .action-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: block;
          margin-bottom: 4px;
        }

        .action-issue-section,
        .action-reason-section,
        .action-metric-section,
        .action-recommendation-section {
          padding-left: 12px;
          border-left: 2px solid #e2e8f0;
        }

        .action-issue {
          font-size: 14px;
          color: #1e293b;
          margin: 0;
          font-weight: 500;
        }

        .action-reason {
          font-size: 13px;
          color: #475569;
          margin: 0;
          font-style: italic;
        }

        .action-metric {
          font-size: 13px;
          color: #dc2626;
          font-weight: 600;
          font-family: 'SF Mono', monospace;
        }

        .action-recommendation {
          font-size: 13px;
          color: #16a34a;
          font-weight: 500;
          margin: 0;
        }

        /* Deal Filters */
        .deal-filters {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .filter-options {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .filter-chip {
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .filter-chip:hover {
          border-color: #3b82f6;
          background: #f0f9ff;
        }

        .filter-chip.selected {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .table-subtitle {
          font-size: 12px;
          font-weight: 400;
          color: #64748b;
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

        /* Pacing & Targets Styles */
        .quarter-progress-banner {
          display: flex;
          gap: 24px;
          padding: 16px 20px;
          background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
          border-radius: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .progress-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .progress-item .progress-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .progress-item .progress-value {
          font-size: 18px;
          font-weight: 600;
          color: white;
        }

        .progress-item.highlight {
          background: rgba(255, 255, 255, 0.1);
          padding: 8px 16px;
          border-radius: 8px;
        }

        .progress-item.highlight .progress-value {
          font-size: 24px;
          color: #4ade80;
        }

        .targets-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        @media (max-width: 768px) {
          .targets-grid {
            grid-template-columns: 1fr;
          }
        }

        .target-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }

        .target-card.combined {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-color: #bae6fd;
        }

        .target-product {
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 8px;
        }

        .target-value {
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
        }

        .target-label {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .grand-total-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        @media (max-width: 900px) {
          .grand-total-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .gt-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
        }

        .gt-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .gt-value {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
        }

        .gt-value.negative {
          color: #dc2626;
        }

        .gt-value.positive {
          color: #16a34a;
        }

        .pacing-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .pacing-green {
          background: #dcfce7;
          color: #166534;
        }

        .pacing-yellow {
          background: #fef9c3;
          color: #854d0e;
        }

        .pacing-red {
          background: #fee2e2;
          color: #991b1b;
        }

        /* Deal Summary Cards */
        .deal-summary-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        @media (max-width: 768px) {
          .deal-summary-cards {
            grid-template-columns: 1fr;
          }
        }

        .deal-summary-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          border-radius: 12px;
        }

        .deal-summary-card.won {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border: 1px solid #a7f3d0;
        }

        .deal-summary-card.lost {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border: 1px solid #fecaca;
        }

        .deal-summary-card.pipeline {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1px solid #bfdbfe;
        }

        .deal-summary-icon {
          font-size: 32px;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.8);
        }

        .deal-summary-card.won .deal-summary-icon {
          color: #16a34a;
        }

        .deal-summary-card.lost .deal-summary-icon {
          color: #dc2626;
        }

        .deal-summary-card.pipeline .deal-summary-icon {
          color: #3b82f6;
        }

        .deal-summary-content {
          flex: 1;
        }

        .deal-summary-value {
          font-size: 32px;
          font-weight: 700;
          color: #1e293b;
        }

        .deal-summary-label {
          font-size: 13px;
          color: #64748b;
        }

        .deal-summary-acv {
          font-size: 16px;
          font-weight: 600;
          color: #475569;
          margin-top: 4px;
        }

        /* Deal Table Styles */
        .deals-table {
          font-size: 12px;
        }

        .deals-table th {
          font-size: 11px;
          padding: 10px 6px;
        }

        .deals-table td {
          padding: 8px 6px;
        }

        .account-cell {
          font-weight: 500;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opp-cell {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .acv-cell {
          font-weight: 600;
          font-family: monospace;
        }

        .loss-reason-cell {
          max-width: 150px;
          font-size: 11px;
          color: #dc2626;
        }

        .product-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }

        .product-por {
          background: #dbeafe;
          color: #1e40af;
        }

        .product-r360 {
          background: #f3e8ff;
          color: #7c3aed;
        }

        .category-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
        }

        .cat-new-logo {
          background: #dcfce7;
          color: #166534;
        }

        .cat-expansion {
          background: #dbeafe;
          color: #1e40af;
        }

        .cat-migration {
          background: #fef9c3;
          color: #854d0e;
        }

        .stage-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
        }

        .stage-discovery {
          background: #f1f5f9;
          color: #475569;
        }

        .stage-proposal {
          background: #fef9c3;
          color: #854d0e;
        }

        .stage-negotiation {
          background: #dbeafe;
          color: #1e40af;
        }

        .sf-link {
          display: inline-block;
          padding: 4px 8px;
          background: #f1f5f9;
          border-radius: 4px;
          color: #3b82f6;
          text-decoration: none;
          font-size: 11px;
          font-weight: 500;
        }

        .sf-link:hover {
          background: #e2e8f0;
        }

        .deal-row.won-deal {
          background: rgba(220, 252, 231, 0.3);
        }

        .deal-row.lost-deal {
          background: rgba(254, 226, 226, 0.3);
        }

        .deal-row.pipeline-deal:hover {
          background: rgba(219, 234, 254, 0.5);
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
