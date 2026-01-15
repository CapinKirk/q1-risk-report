'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Region, Product, Category, Source, ReportData, AttainmentRow, RAGStatus } from '@/lib/types';
import { filterReportData, parseRegionsFromURL, parseProductsFromURL, parseCategoriesFromURL, parseSourcesFromURL } from '@/lib/filterData';
import ReportFilter from '@/components/ReportFilter';
import UserMenu from '@/components/UserMenu';
import ExecutiveKPICards from '@/components/ExecutiveKPICards';
import ExecutiveSummary from '@/components/ExecutiveSummary';
import BrightSpots from '@/components/BrightSpots';
import MomentumTracker from '@/components/MomentumTracker';
import AttainmentTable from '@/components/AttainmentTable';
import SourceAttainment from '@/components/SourceAttainment';
import HitsMisses from '@/components/HitsMisses';
import ActionItemsDashboard from '@/components/ActionItemsDashboard';
import FunnelMilestoneAttainment from '@/components/FunnelMilestoneAttainment';
import PipelineCoverage from '@/components/PipelineCoverage';
import LostOpportunities from '@/components/LostOpportunities';
import GoogleAdsPerf from '@/components/GoogleAdsPerf';
import OpportunitiesTable from '@/components/OpportunitiesTable';
import LoadingOverlay from '@/components/LoadingOverlay';

// Import the pre-generated data as fallback
import reportDataJson from '@/data/report-data.json';

// Transform API response to ReportData format
function transformAPIResponse(apiData: any): ReportData {
  // Check if this is static fallback data (already in ReportData format)
  if (apiData.source === 'static' || apiData.attainment_detail?.POR) {
    // Static data is already in the correct format
    return apiData as ReportData;
  }

  // Group attainment by product (for BigQuery response)
  const attainmentByProduct: { POR: AttainmentRow[]; R360: AttainmentRow[] } = {
    POR: [],
    R360: [],
  };

  for (const row of apiData.attainment_detail || []) {
    const attainmentRow: AttainmentRow = {
      product: row.product,
      region: row.region,
      category: row.category,
      q1_target: row.q1_target || 0,
      qtd_target: row.qtd_target || 0,
      qtd_acv: row.qtd_acv || 0,
      qtd_attainment_pct: row.qtd_attainment_pct || 0,
      qtd_gap: row.qtd_gap || 0,
      pipeline_acv: row.pipeline_acv || 0,
      pipeline_coverage_x: row.pipeline_coverage_x || 0,
      win_rate_pct: row.win_rate_pct || 0,
      qtd_lost_deals: row.qtd_lost_deals || 0,
      qtd_lost_acv: row.qtd_lost_acv || 0,
      rag_status: row.rag_status || 'RED',
    };

    if (row.product === 'POR') {
      attainmentByProduct.POR.push(attainmentRow);
    } else {
      attainmentByProduct.R360.push(attainmentRow);
    }
  }

  // Transform Google Ads data (already grouped by product from API)
  const googleAdsData = apiData.google_ads || { POR: [], R360: [] };

  // Transform Pipeline RCA data (already grouped by product from API)
  const pipelineRcaData = apiData.pipeline_rca || { POR: [], R360: [] };

  // Group funnel pacing by product
  const funnelByProduct: { POR: any[]; R360: any[] } = { POR: [], R360: [] };

  for (const row of apiData.funnel_pacing || []) {
    const mqlPct = row.mql_pacing_pct || 0;
    const sqlPct = row.sql_pacing_pct || 0;
    const salPct = row.sal_pacing_pct || 0;
    const sqoPct = row.sqo_pacing_pct || 0;

    // Calculate weighted TOF score: MQL=10%, SQL=20%, SAL=30%, SQO=40%
    const weightedTofScore = (mqlPct * 0.10) + (sqlPct * 0.20) + (salPct * 0.30) + (sqoPct * 0.40);

    const funnelRow = {
      category: 'NEW LOGO' as Category,
      region: row.region,
      weighted_tof_score: Math.round(weightedTofScore * 10) / 10,
      q1_target_mql: row.target_mql || 0,
      qtd_target_mql: row.target_mql || 0,
      actual_mql: row.actual_mql || 0,
      mql_pacing_pct: mqlPct,
      mql_gap: (row.actual_mql || 0) - (row.target_mql || 0),
      q1_target_sql: row.target_sql || 0,
      qtd_target_sql: row.target_sql || 0,
      actual_sql: row.actual_sql || 0,
      sql_pacing_pct: sqlPct,
      sql_gap: (row.actual_sql || 0) - (row.target_sql || 0),
      q1_target_sal: row.target_sal || 0,
      qtd_target_sal: row.target_sal || 0,
      actual_sal: row.actual_sal || 0,
      sal_pacing_pct: salPct,
      sal_gap: (row.actual_sal || 0) - (row.target_sal || 0),
      q1_target_sqo: row.target_sqo || 0,
      qtd_target_sqo: row.target_sqo || 0,
      actual_sqo: row.actual_sqo || 0,
      sqo_pacing_pct: sqoPct,
      sqo_gap: (row.actual_sqo || 0) - (row.target_sqo || 0),
    };

    if (row.product === 'POR') {
      funnelByProduct.POR.push(funnelRow);
    } else {
      funnelByProduct.R360.push(funnelRow);
    }
  }

  // Transform deals by product
  const wonDealsByProduct: { POR: any[]; R360: any[] } = { POR: [], R360: [] };
  const lostDealsByProduct: { POR: any[]; R360: any[] } = { POR: [], R360: [] };
  const pipelineDealsByProduct: { POR: any[]; R360: any[] } = { POR: [], R360: [] };

  for (const deal of apiData.won_deals || []) {
    const dealObj = {
      opportunity_id: deal.salesforce_url?.split('/').pop() || '',
      account_name: deal.account_name || '',
      opportunity_name: deal.opportunity_name || '',
      product: deal.product,
      region: deal.region,
      category: deal.category,
      deal_type: deal.deal_type || '',
      acv: deal.acv || 0,
      close_date: deal.close_date || '',
      stage: 'Closed Won',
      is_won: true,
      is_closed: true,
      loss_reason: null,
      source: deal.source || 'N/A',
      owner_name: deal.owner_name || '',
      owner_id: '',
      salesforce_url: deal.salesforce_url || '',
    };
    if (deal.product === 'POR') {
      wonDealsByProduct.POR.push(dealObj);
    } else {
      wonDealsByProduct.R360.push(dealObj);
    }
  }

  for (const deal of apiData.lost_deals || []) {
    const dealObj = {
      opportunity_id: deal.salesforce_url?.split('/').pop() || '',
      account_name: deal.account_name || '',
      opportunity_name: deal.opportunity_name || '',
      product: deal.product,
      region: deal.region,
      category: deal.category,
      deal_type: deal.deal_type || '',
      acv: deal.acv || 0,
      close_date: deal.close_date || '',
      stage: 'Closed Lost',
      is_won: false,
      is_closed: true,
      loss_reason: deal.loss_reason || null,
      source: deal.source || 'N/A',
      owner_name: deal.owner_name || '',
      owner_id: '',
      salesforce_url: deal.salesforce_url || '',
    };
    if (deal.product === 'POR') {
      lostDealsByProduct.POR.push(dealObj);
    } else {
      lostDealsByProduct.R360.push(dealObj);
    }
  }

  for (const deal of apiData.pipeline_deals || []) {
    const dealObj = {
      opportunity_id: deal.salesforce_url?.split('/').pop() || '',
      account_name: deal.account_name || '',
      opportunity_name: deal.opportunity_name || '',
      product: deal.product,
      region: deal.region,
      category: deal.category,
      deal_type: deal.deal_type || '',
      acv: deal.acv || 0,
      close_date: deal.close_date || '',
      stage: deal.stage || 'Pipeline',
      is_won: false,
      is_closed: false,
      loss_reason: null,
      source: deal.source || 'N/A',
      owner_name: deal.owner_name || '',
      owner_id: '',
      salesforce_url: deal.salesforce_url || '',
    };
    if (deal.product === 'POR') {
      pipelineDealsByProduct.POR.push(dealObj);
    } else {
      pipelineDealsByProduct.R360.push(dealObj);
    }
  }

  // Build the ReportData object
  return {
    report_date: apiData.report_date || new Date().toISOString().split('T')[0],
    query_version: '3.0.0-live',
    period: {
      as_of_date: apiData.period?.as_of_date || apiData.report_date || new Date().toISOString().split('T')[0],
      quarter_pct_complete: apiData.period?.quarter_pct_complete || 0,
      days_elapsed: apiData.period?.days_elapsed || 0,
      total_days: apiData.period?.total_days || 90,
    },
    grand_total: {
      total_q1_target: apiData.grand_total?.total_q1_target || 0,
      total_qtd_target: apiData.grand_total?.total_qtd_target || 0,
      total_qtd_acv: apiData.grand_total?.total_qtd_acv || 0,
      total_qtd_attainment_pct: apiData.grand_total?.total_qtd_attainment_pct || 0,
      total_pipeline_acv: apiData.grand_total?.total_pipeline_acv || 0,
      total_pipeline_coverage_x: apiData.grand_total?.total_pipeline_coverage_x || 0,
      total_win_rate_pct: apiData.grand_total?.total_win_rate_pct || 0,
    },
    product_totals: {
      POR: {
        total_q1_target: apiData.product_totals?.POR?.total_q1_target || 0,
        total_qtd_target: apiData.product_totals?.POR?.total_qtd_target || 0,
        total_qtd_acv: apiData.product_totals?.POR?.total_qtd_acv || 0,
        total_qtd_attainment_pct: apiData.product_totals?.POR?.total_qtd_attainment_pct || 0,
        total_pipeline_acv: apiData.product_totals?.POR?.total_pipeline_acv || 0,
        total_pipeline_coverage_x: apiData.product_totals?.POR?.total_pipeline_coverage_x || 0,
        total_win_rate_pct: apiData.product_totals?.POR?.total_win_rate_pct || 0,
        total_lost_deals: apiData.product_totals?.POR?.total_lost_deals || 0,
        total_lost_acv: apiData.product_totals?.POR?.total_lost_acv || 0,
      },
      R360: {
        total_q1_target: apiData.product_totals?.R360?.total_q1_target || 0,
        total_qtd_target: apiData.product_totals?.R360?.total_qtd_target || 0,
        total_qtd_acv: apiData.product_totals?.R360?.total_qtd_acv || 0,
        total_qtd_attainment_pct: apiData.product_totals?.R360?.total_qtd_attainment_pct || 0,
        total_pipeline_acv: apiData.product_totals?.R360?.total_pipeline_acv || 0,
        total_pipeline_coverage_x: apiData.product_totals?.R360?.total_pipeline_coverage_x || 0,
        total_win_rate_pct: apiData.product_totals?.R360?.total_win_rate_pct || 0,
        total_lost_deals: apiData.product_totals?.R360?.total_lost_deals || 0,
        total_lost_acv: apiData.product_totals?.R360?.total_lost_acv || 0,
      },
    },
    attainment_detail: attainmentByProduct,
    source_attainment: apiData.source_attainment || { POR: [], R360: [] },
    funnel_by_category: funnelByProduct,
    funnel_by_source: { POR: [], R360: [] },
    pipeline_rca: pipelineRcaData,
    loss_reason_rca: { POR: [], R360: [] },
    google_ads: googleAdsData,
    google_ads_rca: { POR: [], R360: [] },
    funnel_rca_insights: { POR: [], R360: [] },
    won_deals: wonDealsByProduct,
    lost_deals: lostDealsByProduct,
    pipeline_deals: pipelineDealsByProduct,
  };
}

function ReportContent() {
  const searchParams = useSearchParams();
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(['AMER', 'EMEA', 'APAC']);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(['POR', 'R360']);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(['NEW LOGO', 'EXPANSION', 'MIGRATION']);
  const [selectedSources, setSelectedSources] = useState<Source[]>(['INBOUND', 'OUTBOUND', 'AE SOURCED', 'AM SOURCED', 'TRADESHOW', 'PARTNERSHIPS']);
  const [filteredData, setFilteredData] = useState<ReportData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [useLiveData, setUseLiveData] = useState(true); // Default to live mode
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);

  // Date range state - default to Q1 2026
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Track if initial load is complete
  const initialLoadComplete = useRef(false);
  const fetchInProgress = useRef(false);

  // Load and parse data - fallback to static JSON
  const rawData = reportDataJson as ReportData;

  // Fetch live data from BigQuery API
  const fetchLiveData = useCallback(async (
    products: Product[],
    regions: Region[],
    dateStart: string,
    dateEnd: string
  ) => {
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const response = await fetch('/api/report-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: dateStart,
          endDate: dateEnd,
          products: products.length === 2 ? [] : products, // Empty array means all products
          regions: regions.length === 3 ? [] : regions,     // Empty array means all regions
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to fetch data from BigQuery');
      }

      // Transform API response to ReportData format
      const transformedData = transformAPIResponse(result);
      setLastFetchTime(new Date().toLocaleTimeString());

      return transformedData;
    } catch (error: any) {
      console.error('Live data fetch error:', error);
      setRefreshError(error.message || 'Failed to fetch live data');
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Handle manual data refresh
  const handleRefresh = async () => {
    const liveData = await fetchLiveData(selectedProducts, selectedRegions, startDate, endDate);
    if (liveData) {
      const filtered = filterReportData(liveData, selectedRegions, selectedProducts, selectedCategories, selectedSources);
      setFilteredData(filtered);
      setUseLiveData(true);
    }
  };

  // Handle date range change
  const handleDateChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    // Automatically fetch new data when dates change
    if (useLiveData && !fetchInProgress.current) {
      fetchInProgress.current = true;
      fetchLiveData(selectedProducts, selectedRegions, newStart, newEnd).then(liveData => {
        fetchInProgress.current = false;
        if (liveData) {
          const filtered = filterReportData(liveData, selectedRegions, selectedProducts, selectedCategories, selectedSources);
          setFilteredData(filtered);
        }
      });
    }
  };

  // Initialize filters from URL on mount
  useEffect(() => {
    const regions = parseRegionsFromURL(searchParams);
    const products = parseProductsFromURL(searchParams);
    const categories = parseCategoriesFromURL(searchParams);
    const sources = parseSourcesFromURL(searchParams);
    setSelectedRegions(regions);
    setSelectedProducts(products);
    setSelectedCategories(categories);
    setSelectedSources(sources);
  }, [searchParams]);

  // Fetch live data when product/region filters change
  useEffect(() => {
    // For initial load, start with static data but also fetch live
    if (!initialLoadComplete.current) {
      // First load - immediately show static data
      if (rawData) {
        const filtered = filterReportData(rawData, selectedRegions, selectedProducts, selectedCategories, selectedSources);
        setFilteredData(filtered);
      }
      initialLoadComplete.current = true;

      // Also fetch live data in background for initial load if live mode enabled
      if (useLiveData && !fetchInProgress.current) {
        fetchInProgress.current = true;
        fetchLiveData(selectedProducts, selectedRegions, startDate, endDate).then(liveData => {
          fetchInProgress.current = false;
          if (liveData) {
            const filtered = filterReportData(liveData, selectedRegions, selectedProducts, selectedCategories, selectedSources);
            setFilteredData(filtered);
          }
        });
      }
      return;
    }

    // For subsequent filter changes
    if (useLiveData) {
      // Debounce live data fetching to prevent rapid API calls
      const debounceTimer = setTimeout(async () => {
        if (!fetchInProgress.current) {
          fetchInProgress.current = true;
          const liveData = await fetchLiveData(selectedProducts, selectedRegions, startDate, endDate);
          fetchInProgress.current = false;
          if (liveData) {
            const filtered = filterReportData(liveData, selectedRegions, selectedProducts, selectedCategories, selectedSources);
            setFilteredData(filtered);
          }
        }
      }, 500); // 500ms debounce to prevent rapid API calls

      return () => clearTimeout(debounceTimer);
    } else {
      // Apply client-side filtering to static data
      if (rawData) {
        const filtered = filterReportData(rawData, selectedRegions, selectedProducts, selectedCategories, selectedSources);
        setFilteredData(filtered);
      }
    }
  }, [selectedRegions, selectedProducts, selectedCategories, selectedSources, rawData, useLiveData, fetchLiveData, startDate, endDate]);

  if (!filteredData) {
    return <div className="loading">Loading report data...</div>;
  }

  const { period, query_version } = filteredData;

  return (
    <div className="container">
      <LoadingOverlay isLoading={isRefreshing} />

      <div className="header-bar">
        <div>
          <h1>Q1 2026 Risk Analysis Report</h1>
          <div className="meta">
            <span>Report Date: {period.as_of_date}</span>
            <span>Q1 Progress: {period.quarter_pct_complete.toFixed(1)}% ({period.days_elapsed}/{period.total_days} days)</span>
            <span>Version: {query_version || '2.7.0'}</span>
            {useLiveData && lastFetchTime && (
              <span className="live-indicator">
                <span className="live-dot"></span>
                Live Data (Updated: {lastFetchTime})
              </span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <label className="live-toggle" title="When enabled, filter changes will fetch fresh data from BigQuery">
            <input
              type="checkbox"
              checked={useLiveData}
              onChange={(e) => {
                setUseLiveData(e.target.checked);
                if (e.target.checked) {
                  // Immediately fetch live data when toggled on
                  handleRefresh();
                }
              }}
              disabled={isRefreshing}
            />
            <span className="toggle-label">Live Mode</span>
          </label>
          <button
            className={`refresh-button ${useLiveData ? 'live-active' : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
            title={useLiveData ? 'Refresh live data from BigQuery' : 'Fetch fresh data from BigQuery'}
          >
            <span className={`refresh-icon ${isRefreshing ? 'spinning' : ''}`}>↻</span>
            {isRefreshing ? 'Loading...' : (useLiveData ? 'Refresh' : 'Go Live')}
          </button>
          <UserMenu />
        </div>
      </div>

      {refreshError && (
        <div className="refresh-error">
          <strong>Refresh failed:</strong> {refreshError}
          <button onClick={() => setRefreshError(null)}>×</button>
        </div>
      )}

      <ReportFilter
        selectedRegions={selectedRegions}
        selectedProducts={selectedProducts}
        selectedCategories={selectedCategories}
        selectedSources={selectedSources}
        onRegionChange={setSelectedRegions}
        onProductChange={setSelectedProducts}
        onCategoryChange={setSelectedCategories}
        onSourceChange={setSelectedSources}
      />

      {/* Date Range Selector */}
      <div className="date-range-bar" data-testid="date-range-bar">
        <span className="filter-label">Date Range:</span>
        <div className="date-inputs">
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleDateChange(e.target.value, endDate)}
            className="date-input"
            data-testid="start-date"
          />
          <span className="date-separator">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleDateChange(startDate, e.target.value)}
            className="date-input"
            data-testid="end-date"
          />
        </div>
        <div className="date-presets">
          <button
            className="preset-btn"
            onClick={() => handleDateChange('2026-01-01', new Date().toISOString().split('T')[0])}
            data-testid="preset-qtd"
          >
            QTD
          </button>
          <button
            className="preset-btn"
            onClick={() => {
              const today = new Date();
              const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
              handleDateChange(weekAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]);
            }}
            data-testid="preset-7d"
          >
            Last 7 Days
          </button>
          <button
            className="preset-btn"
            onClick={() => {
              const today = new Date();
              const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
              handleDateChange(monthAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]);
            }}
            data-testid="preset-30d"
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Executive KPI Overview Cards */}
      {filteredData.executive_counts && (
        <ExecutiveKPICards counts={filteredData.executive_counts} />
      )}

      <ExecutiveSummary data={filteredData} />

      {/* Bright Spots - Areas exceeding targets */}
      {filteredData.wins_bright_spots && (
        <BrightSpots wins={filteredData.wins_bright_spots} />
      )}

      {/* Momentum Tracker - WoW trend indicators */}
      {filteredData.momentum_indicators && (
        <MomentumTracker momentum={filteredData.momentum_indicators} period={period} />
      )}

      <AttainmentTable data={filteredData} />
      <SourceAttainment data={filteredData} />

      {/* Pipeline Milestone Attainment - MQL/SQL/SAL/SQO with Funnel Score */}
      {filteredData.funnel_by_category && (
        <FunnelMilestoneAttainment funnelData={filteredData.funnel_by_category} />
      )}

      <HitsMisses data={filteredData} />

      {/* Action Items Dashboard */}
      {filteredData.action_items && (
        <ActionItemsDashboard actionItems={filteredData.action_items} period={period} />
      )}

      <PipelineCoverage data={filteredData} />
      <LostOpportunities data={filteredData} />

      {/* Opportunities Table with filtering and pagination */}
      <OpportunitiesTable data={filteredData} selectedRegions={selectedRegions} />

      <GoogleAdsPerf data={filteredData} />

      <footer className="footer">
        <p>
          Generated {new Date().toISOString().split('T')[0]} | Version {query_version || '2.7.0'} | Data as of {period.as_of_date}
        </p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <ReportContent />
    </Suspense>
  );
}
