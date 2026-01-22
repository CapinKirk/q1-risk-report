'use client';

import { useState, useEffect } from 'react';
import {
  RenewalsData,
  RenewalOpportunity,
  RenewalSummary,
  SalesforceContract,
  Product,
  Region,
} from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import SortableHeader from './SortableHeader';
import { useSortableTable } from '@/lib/useSortableTable';

interface RenewalsSectionProps {
  products: Product[];
  regions: Region[];
  refreshKey?: number; // Increment to force re-fetch
}

// Product colors
const PRODUCT_COLORS: Record<Product, { bg: string; border: string; text: string }> = {
  POR: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  R360: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
};

// RAG colors
const RAG_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  GREEN: { bg: '#dcfce7', border: '#16a34a', text: '#166534' },
  YELLOW: { bg: '#fef3c7', border: '#ca8a04', text: '#92400e' },
  RED: { bg: '#fef2f2', border: '#dc2626', text: '#dc2626' },
};

export default function RenewalsSection({ products, regions, refreshKey = 0 }: RenewalsSectionProps) {
  const [renewalsData, setRenewalsData] = useState<RenewalsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'won' | 'pipeline' | 'upcoming' | 'missinguplift'>('won');
  const [dataSource, setDataSource] = useState<string>('');

  // Fetch renewals data
  useEffect(() => {
    const fetchRenewals = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (products.length > 0 && products.length < 2) {
          params.set('products', products.join(','));
        }
        if (regions.length > 0 && regions.length < 3) {
          params.set('regions', regions.join(','));
        }

        // When refreshKey > 0, request live Salesforce data
        if (refreshKey > 0) {
          params.set('refresh', 'true');
        }

        const response = await fetch(`/api/renewals?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch renewals');
        }

        setRenewalsData(data.data);
        setDataSource(data.metadata?.dataSource || 'bigquery');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRenewals();
  }, [products, regions, refreshKey]);

  // Calculate RAG from attainment
  const getRAG = (attainmentPct: number): 'GREEN' | 'YELLOW' | 'RED' => {
    if (attainmentPct >= 90) return 'GREEN';
    if (attainmentPct >= 70) return 'YELLOW';
    return 'RED';
  };

  // Calculate combined summary based on selected products
  const getCombinedSummary = (): RenewalSummary | null => {
    if (!renewalsData) return null;

    const selectedProducts = products.length > 0 ? products : ['POR', 'R360'] as Product[];
    const summaries = selectedProducts.map(p => renewalsData.summary[p]);

    if (summaries.length === 1) return summaries[0];

    // Combine summaries
    const q1Target = summaries.reduce((sum, s) => sum + (s.q1Target || 0), 0);
    const qtdTarget = summaries.reduce((sum, s) => sum + (s.qtdTarget || 0), 0);
    const forecastedBookings = summaries.reduce((sum, s) => sum + (s.forecastedBookings || 0), 0);
    // CRITICAL: Use q1Target (full quarter) for Q1 attainment, not qtdTarget (prorated)
    // This matches the "Q1 Target" display and user expectations
    const qtdAttainmentPct = q1Target > 0
      ? Math.round((forecastedBookings / q1Target) * 1000) / 10
      : 100;

    return {
      renewalCount: summaries.reduce((sum, s) => sum + s.renewalCount, 0),
      renewalACV: summaries.reduce((sum, s) => sum + s.renewalACV, 0),
      autoRenewalCount: summaries.reduce((sum, s) => sum + s.autoRenewalCount, 0),
      autoRenewalACV: summaries.reduce((sum, s) => sum + s.autoRenewalACV, 0),
      manualRenewalCount: summaries.reduce((sum, s) => sum + s.manualRenewalCount, 0),
      manualRenewalACV: summaries.reduce((sum, s) => sum + s.manualRenewalACV, 0),
      avgUpliftPct: Math.round(summaries.reduce((sum, s) => sum + s.avgUpliftPct, 0) / summaries.length),
      totalUpliftAmount: summaries.reduce((sum, s) => sum + s.totalUpliftAmount, 0),
      atRiskCount: summaries.reduce((sum, s) => sum + s.atRiskCount, 0),
      atRiskACV: summaries.reduce((sum, s) => sum + s.atRiskACV, 0),
      upcomingRenewals30: summaries.reduce((sum, s) => sum + s.upcomingRenewals30, 0),
      upcomingRenewals30ACV: summaries.reduce((sum, s) => sum + s.upcomingRenewals30ACV, 0),
      upcomingRenewals60: summaries.reduce((sum, s) => sum + s.upcomingRenewals60, 0),
      upcomingRenewals60ACV: summaries.reduce((sum, s) => sum + s.upcomingRenewals60ACV, 0),
      upcomingRenewals90: summaries.reduce((sum, s) => sum + s.upcomingRenewals90, 0),
      upcomingRenewals90ACV: summaries.reduce((sum, s) => sum + s.upcomingRenewals90ACV, 0),
      wonRenewalCount: summaries.reduce((sum, s) => sum + s.wonRenewalCount, 0),
      wonRenewalACV: summaries.reduce((sum, s) => sum + s.wonRenewalACV, 0),
      lostRenewalCount: summaries.reduce((sum, s) => sum + s.lostRenewalCount, 0),
      lostRenewalACV: summaries.reduce((sum, s) => sum + s.lostRenewalACV, 0),
      pipelineRenewalCount: summaries.reduce((sum, s) => sum + s.pipelineRenewalCount, 0),
      pipelineRenewalACV: summaries.reduce((sum, s) => sum + s.pipelineRenewalACV, 0),
      expectedRenewalACV: summaries.reduce((sum, s) => sum + (s.expectedRenewalACV || 0), 0),
      expectedRenewalACVWithUplift: summaries.reduce((sum, s) => sum + (s.expectedRenewalACVWithUplift || 0), 0),
      renewalRiskGap: summaries.reduce((sum, s) => sum + (s.renewalRiskGap || 0), 0),
      renewalRiskPct: summaries.length > 0 ? Math.round(summaries.reduce((sum, s) => sum + (s.renewalRiskPct || 0), 0) / summaries.length) : 0,
      // New RAG fields
      q1Target,
      qtdTarget,
      qtdAttainmentPct,
      forecastedBookings,
      ragStatus: getRAG(qtdAttainmentPct),
      // Missing uplift tracking - will be recalculated from filtered contracts below
      missingUpliftCount: summaries.reduce((sum, s) => sum + (s.missingUpliftCount || 0), 0),
      missingUpliftACV: summaries.reduce((sum, s) => sum + (s.missingUpliftACV || 0), 0),
      potentialLostUplift: summaries.reduce((sum, s) => sum + (s.potentialLostUplift || 0), 0),
    };
  };

  // Helper to get all missing uplift contracts (for summary recalculation)
  const getMissingUpliftContractsFiltered = (): SalesforceContract[] => {
    if (!renewalsData) return [];

    const selectedProducts = products.length > 0 ? products : ['POR', 'R360'] as Product[];
    const selectedRegions = regions.length > 0 ? regions : ['AMER', 'EMEA', 'APAC'] as Region[];

    let contracts: SalesforceContract[] = [];
    for (const p of selectedProducts) {
      const data = renewalsData.missingUpliftContracts?.[p] || [];
      contracts = [...contracts, ...data];
    }

    return contracts.filter(c => selectedRegions.includes(c.Region));
  };

  // Get filtered data based on selected products/regions
  const getFilteredOpps = (type: 'won' | 'lost' | 'pipeline'): RenewalOpportunity[] => {
    if (!renewalsData) return [];

    const selectedProducts = products.length > 0 ? products : ['POR', 'R360'] as Product[];
    const selectedRegions = regions.length > 0 ? regions : ['AMER', 'EMEA', 'APAC'] as Region[];

    let opps: RenewalOpportunity[] = [];
    for (const p of selectedProducts) {
      const data = type === 'won' ? renewalsData.wonRenewals[p]
        : type === 'lost' ? renewalsData.lostRenewals[p]
        : renewalsData.pipelineRenewals[p];
      opps = [...opps, ...data];
    }

    return opps.filter(o => selectedRegions.includes(o.region));
  };

  const getFilteredContracts = (type: 'upcoming' | 'missinguplift'): SalesforceContract[] => {
    if (!renewalsData) return [];

    const selectedProducts = products.length > 0 ? products : ['POR', 'R360'] as Product[];
    const selectedRegions = regions.length > 0 ? regions : ['AMER', 'EMEA', 'APAC'] as Region[];

    let contracts: SalesforceContract[] = [];
    for (const p of selectedProducts) {
      let data: SalesforceContract[];
      if (type === 'upcoming') {
        data = renewalsData.upcomingContracts[p];
      } else {
        data = renewalsData.missingUpliftContracts?.[p] || [];
      }
      contracts = [...contracts, ...data];
    }

    return contracts.filter(c => selectedRegions.includes(c.Region));
  };

  const summary = getCombinedSummary();

  // CRITICAL: Calculate missing uplift stats FROM FILTERED CONTRACTS
  // This ensures the warning banner matches the table exactly
  const filteredMissingUpliftContracts = getMissingUpliftContractsFiltered();
  const filteredMissingUpliftCount = filteredMissingUpliftContracts.length;
  const filteredMissingUpliftACV = filteredMissingUpliftContracts.reduce((sum, c) => sum + (c.CurrentACV || 0), 0);
  const filteredPotentialLostUplift = filteredMissingUpliftContracts.reduce((sum, c) => sum + (c.CurrentACV || 0) * 0.05, 0);

  // IMPORTANT: All hooks MUST be called before any early returns (React hooks rules)
  // Get filtered data for sorting hooks
  const wonOpps = getFilteredOpps('won');
  const pipelineOpps = getFilteredOpps('pipeline');
  const upcomingContracts = getFilteredContracts('upcoming');
  const missingUpliftContractsData = getFilteredContracts('missinguplift');

  // Sorting hooks for each table
  const renewalsTableWon = useSortableTable(
    wonOpps,
    wonOpps,
    (item: RenewalOpportunity, column: string) => {
      switch (column) {
        case 'account_name': return item.account_name;
        case 'product': return item.product;
        case 'region': return item.region;
        case 'acv': return item.acv;
        case 'uplift_amount': return item.uplift_amount || 0;
        case 'close_date': return item.close_date;
        case 'owner_name': return item.owner_name;
        default: return '';
      }
    }
  );

  const renewalsTablePipeline = useSortableTable(
    pipelineOpps,
    pipelineOpps,
    (item: RenewalOpportunity, column: string) => {
      switch (column) {
        case 'account_name': return item.account_name;
        case 'product': return item.product;
        case 'region': return item.region;
        case 'acv': return item.acv;
        case 'uplift_amount': return item.uplift_amount || 0;
        case 'close_date': return item.close_date;
        case 'owner_name': return item.owner_name;
        default: return '';
      }
    }
  );

  const contractsTableUpcoming = useSortableTable(
    upcomingContracts,
    upcomingContracts,
    (item: SalesforceContract, column: string) => {
      switch (column) {
        case 'ContractNumber': return item.ContractNumber;
        case 'AccountName': return item.AccountName;
        case 'Product': return item.Product;
        case 'Region': return item.Region;
        case 'EndDate': return item.EndDate;
        case 'DaysUntilRenewal': return item.DaysUntilRenewal;
        case 'AutoRenewal': return item.AutoRenewal;
        case 'IsAtRisk': return item.IsAtRisk;
        default: return '';
      }
    }
  );

  const missingUpliftTable = useSortableTable(
    missingUpliftContractsData,
    missingUpliftContractsData,
    (item: SalesforceContract, column: string) => {
      switch (column) {
        case 'ContractNumber': return item.ContractNumber;
        case 'AccountName': return item.AccountName;
        case 'Product': return item.Product;
        case 'Region': return item.Region;
        case 'CurrentACV': return item.CurrentACV;
        case 'UpliftAmount': return item.UpliftAmount;
        case 'PotentialLost': return item.CurrentACV * 0.05;
        case 'EndDate': return item.EndDate;
        case 'DaysUntilRenewal': return item.DaysUntilRenewal;
        default: return '';
      }
    }
  );

  if (loading) {
    return (
      <section className="renewals-section">
        <h2>Renewals Overview</h2>
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading renewals data...</p>
        </div>
        <style jsx>{`
          .renewals-section { margin-top: 24px; padding: 20px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-primary); }
          .loading-state { display: flex; flex-direction: column; align-items: center; padding: 40px; color: var(--text-tertiary); }
          .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </section>
    );
  }

  if (error) {
    return (
      <section className="renewals-section">
        <h2>Renewals Overview</h2>
        <div className="error-state">
          <p>Error loading renewals: {error}</p>
        </div>
        <style jsx>{`
          .renewals-section { margin-top: 24px; padding: 20px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-primary); }
          .error-state { padding: 20px; background: var(--danger-bg); border: 1px solid var(--danger-border); border-radius: 6px; color: var(--danger-text); }
        `}</style>
      </section>
    );
  }

  // Show section even with empty data
  const isEmpty = !renewalsData || !summary || (
    summary.wonRenewalCount === 0 &&
    summary.pipelineRenewalCount === 0 &&
    summary.upcomingRenewals90 === 0
  );

  // Use safe defaults if data is missing
  const safeData = renewalsData || {
    sfAvailable: false,
    bqDataOnly: false,
  };
  const safeSummary = summary || {
    wonRenewalCount: 0,
    wonRenewalACV: 0,
    pipelineRenewalCount: 0,
    pipelineRenewalACV: 0,
    avgUpliftPct: 0,
    totalUpliftAmount: 0,
    upcomingRenewals30: 0,
    upcomingRenewals30ACV: 0,
    upcomingRenewals90: 0,
    atRiskCount: 0,
    atRiskACV: 0,
    lostRenewalCount: 0,
    lostRenewalACV: 0,
    // RAG fields
    q1Target: 0,
    qtdTarget: 0,
    qtdAttainmentPct: 0,
    forecastedBookings: 0,
    ragStatus: 'RED' as const,
    // Missing uplift fields
    missingUpliftCount: 0,
    missingUpliftACV: 0,
    potentialLostUplift: 0,
  };

  // Get RAG color for display
  const ragColor = RAG_COLORS[safeSummary.ragStatus] || RAG_COLORS.RED;

  return (
    <section className="renewals-section" data-testid="renewals-section">
      <div className="section-header">
        <h2>
          <span className="section-icon">🔄</span>
          Renewals Overview
        </h2>
        {safeData.sfAvailable && (
          <span className="sf-badge">Live SF Data</span>
        )}
        {safeData.bqDataOnly && (
          <span className="bq-badge">BigQuery Only</span>
        )}
        {isEmpty && (
          <span className="empty-badge">No Data Available</span>
        )}
      </div>

      {/* RENEWAL BOOKINGS FORECAST - Prominent RAG Display */}
      <div
        className="renewal-forecast-card"
        style={{
          backgroundColor: ragColor.bg,
          borderColor: ragColor.border,
        }}
      >
        <div className="forecast-header">
          <h3>Q1 Renewal Bookings Forecast</h3>
          <span
            className="rag-badge-large"
            style={{
              backgroundColor: ragColor.border,
              color: 'white',
            }}
          >
            {safeSummary.ragStatus}
          </span>
        </div>
        <div className="forecast-metrics">
          <div className="forecast-metric">
            <span className="metric-label">Q1 Forecast</span>
            <span className="metric-value" style={{ color: ragColor.text }}>
              {formatCurrency(safeSummary.forecastedBookings || 0)}
            </span>
            <span className="metric-sub">
              Won ({formatCurrency(safeSummary.wonRenewalACV || 0)}) + Q1 Uplift ({formatCurrency(safeSummary.totalUpliftAmount || 0)})
            </span>
          </div>
          <div className="forecast-metric">
            <span className="metric-label">Q1 Target</span>
            <span className="metric-value">{formatCurrency(safeSummary.q1Target || 0)}</span>
            <span className="metric-sub">Full quarter target</span>
          </div>
          <div className="forecast-metric">
            <span className="metric-label">Projected Q1 Attainment</span>
            <span className="metric-value" style={{ color: ragColor.text }}>
              {safeSummary.qtdAttainmentPct?.toFixed(1) || 0}%
            </span>
            <span className="metric-sub">
              {(safeSummary.forecastedBookings || 0) >= (safeSummary.q1Target || 0)
                ? `Surplus: ${formatCurrency((safeSummary.forecastedBookings || 0) - (safeSummary.q1Target || 0))}`
                : `Gap: ${formatCurrency((safeSummary.q1Target || 0) - (safeSummary.forecastedBookings || 0))}`
              }
            </span>
          </div>
          <div className="forecast-metric">
            <span className="metric-label">Q1 Contracts</span>
            <span className="metric-value">{safeSummary.upcomingRenewals90 || 0}</span>
            <span className="metric-sub">{formatCurrency(safeSummary.totalUpliftAmount || 0)} uplift (thru Mar 31)</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card green card-success">
          <div className="kpi-label">Won Renewals (QTD)</div>
          <div className="kpi-value">{formatCurrency(safeSummary.wonRenewalACV)}</div>
          <div className="kpi-sub">{safeSummary.wonRenewalCount} deals</div>
        </div>
        <div className="kpi-card blue card-info">
          <div className="kpi-label">Pipeline Renewals</div>
          <div className="kpi-value">{formatCurrency(safeSummary.pipelineRenewalACV)}</div>
          <div className="kpi-sub">{safeSummary.pipelineRenewalCount} deals</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-label">Avg Uplift</div>
          <div className="kpi-value">{safeSummary.avgUpliftPct}%</div>
          <div className="kpi-sub">{formatCurrency(safeSummary.totalUpliftAmount)} total</div>
        </div>
        <div className="kpi-card orange card-warning">
          <div className="kpi-label">Upcoming (30d)</div>
          <div className="kpi-value">{safeSummary.upcomingRenewals30}</div>
          <div className="kpi-sub">{formatCurrency(safeSummary.upcomingRenewals30ACV)} ACV</div>
        </div>
        <div className="kpi-card gray card-danger">
          <div className="kpi-label">Lost Renewals</div>
          <div className="kpi-value">{formatCurrency(safeSummary.lostRenewalACV)}</div>
          <div className="kpi-sub">{safeSummary.lostRenewalCount} deals</div>
        </div>
      </div>

      {/* Missing Uplift Warning - only show if there are contracts missing uplift */}
      {/* CRITICAL: Use filteredMissingUplift* values (calculated from filtered contracts) */}
      {/* This ensures the warning banner MATCHES the table exactly */}
      {filteredMissingUpliftCount > 0 && (
        <div className="missing-uplift-warning">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <div className="warning-title">
              Revenue Leakage: {filteredMissingUpliftCount} Contracts Missing Uplift
            </div>
            <div className="warning-details">
              <span>{formatCurrency(filteredMissingUpliftACV)} ACV without configured uplift</span>
              <span className="separator">•</span>
              <span className="lost-revenue">
                {formatCurrency(filteredPotentialLostUplift)} potential lost bookings (5% uplift)
              </span>
            </div>
            <button
              className="view-contracts-btn"
              onClick={() => setActiveTab('missinguplift')}
            >
              View Contracts →
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'won' ? 'active' : ''}`}
          onClick={() => setActiveTab('won')}
        >
          Won ({safeSummary.wonRenewalCount})
        </button>
        <button
          className={`tab ${activeTab === 'pipeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('pipeline')}
        >
          Pipeline ({safeSummary.pipelineRenewalCount})
        </button>
        <button
          className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming ({safeSummary.upcomingRenewals90})
        </button>
        {filteredMissingUpliftCount > 0 && (
          <button
            className={`tab warning-tab ${activeTab === 'missinguplift' ? 'active' : ''}`}
            onClick={() => setActiveTab('missinguplift')}
          >
            ⚠️ Missing Uplift ({filteredMissingUpliftCount})
          </button>
        )}
      </div>

      {/* Table Content */}
      <div className="table-container">
        {(activeTab === 'won' || activeTab === 'pipeline') && (
          <table className="renewals-table">
            <thead>
              <tr>
                <SortableHeader
                  label="Account"
                  column="account_name"
                  sortDirection={activeTab === 'won' ? renewalsTableWon.getSortDirection('account_name') : renewalsTablePipeline.getSortDirection('account_name')}
                  onSort={activeTab === 'won' ? renewalsTableWon.handleSort : renewalsTablePipeline.handleSort}
                />
                <SortableHeader
                  label="Product"
                  column="product"
                  sortDirection={activeTab === 'won' ? renewalsTableWon.getSortDirection('product') : renewalsTablePipeline.getSortDirection('product')}
                  onSort={activeTab === 'won' ? renewalsTableWon.handleSort : renewalsTablePipeline.handleSort}
                />
                <SortableHeader
                  label="Region"
                  column="region"
                  sortDirection={activeTab === 'won' ? renewalsTableWon.getSortDirection('region') : renewalsTablePipeline.getSortDirection('region')}
                  onSort={activeTab === 'won' ? renewalsTableWon.handleSort : renewalsTablePipeline.handleSort}
                />
                <SortableHeader
                  label="ACV"
                  column="acv"
                  sortDirection={activeTab === 'won' ? renewalsTableWon.getSortDirection('acv') : renewalsTablePipeline.getSortDirection('acv')}
                  onSort={activeTab === 'won' ? renewalsTableWon.handleSort : renewalsTablePipeline.handleSort}
                />
                <SortableHeader
                  label="Uplift"
                  column="uplift_amount"
                  sortDirection={activeTab === 'won' ? renewalsTableWon.getSortDirection('uplift_amount') : renewalsTablePipeline.getSortDirection('uplift_amount')}
                  onSort={activeTab === 'won' ? renewalsTableWon.handleSort : renewalsTablePipeline.handleSort}
                />
                <SortableHeader
                  label="Close Date"
                  column="close_date"
                  sortDirection={activeTab === 'won' ? renewalsTableWon.getSortDirection('close_date') : renewalsTablePipeline.getSortDirection('close_date')}
                  onSort={activeTab === 'won' ? renewalsTableWon.handleSort : renewalsTablePipeline.handleSort}
                />
                <SortableHeader
                  label="Owner"
                  column="owner_name"
                  sortDirection={activeTab === 'won' ? renewalsTableWon.getSortDirection('owner_name') : renewalsTablePipeline.getSortDirection('owner_name')}
                  onSort={activeTab === 'won' ? renewalsTableWon.handleSort : renewalsTablePipeline.handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'won' ? renewalsTableWon.sortedData : renewalsTablePipeline.sortedData).slice(0, 20).map((opp, i) => (
                <tr key={i}>
                  <td>
                    <a href={opp.salesforce_url} target="_blank" rel="noopener noreferrer">
                      {opp.account_name}
                    </a>
                  </td>
                  <td>
                    <span
                      className="product-badge"
                      style={{
                        backgroundColor: PRODUCT_COLORS[opp.product].bg,
                        color: PRODUCT_COLORS[opp.product].text,
                      }}
                    >
                      {opp.product}
                    </span>
                  </td>
                  <td>{opp.region}</td>
                  <td className="money">{formatCurrency(opp.acv)}</td>
                  <td className={`money ${(opp.uplift_amount || 0) > 0 ? 'positive' : ''}`}>
                    {formatCurrency(opp.uplift_amount || 0)}
                  </td>
                  <td>{new Date(opp.close_date).toLocaleDateString()}</td>
                  <td>{opp.owner_name}</td>
                </tr>
              ))}
              {(activeTab === 'won' ? renewalsTableWon.sortedData : renewalsTablePipeline.sortedData).length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">No {activeTab} renewals found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'upcoming' && (
          <table className="renewals-table">
            <thead>
              <tr>
                <SortableHeader
                  label="Contract"
                  column="ContractNumber"
                  sortDirection={contractsTableUpcoming.getSortDirection('ContractNumber')}
                  onSort={contractsTableUpcoming.handleSort}
                />
                <SortableHeader
                  label="Account"
                  column="AccountName"
                  sortDirection={contractsTableUpcoming.getSortDirection('AccountName')}
                  onSort={contractsTableUpcoming.handleSort}
                />
                <SortableHeader
                  label="Product"
                  column="Product"
                  sortDirection={contractsTableUpcoming.getSortDirection('Product')}
                  onSort={contractsTableUpcoming.handleSort}
                />
                <SortableHeader
                  label="Region"
                  column="Region"
                  sortDirection={contractsTableUpcoming.getSortDirection('Region')}
                  onSort={contractsTableUpcoming.handleSort}
                />
                <SortableHeader
                  label="End Date"
                  column="EndDate"
                  sortDirection={contractsTableUpcoming.getSortDirection('EndDate')}
                  onSort={contractsTableUpcoming.handleSort}
                />
                <SortableHeader
                  label="Days Until"
                  column="DaysUntilRenewal"
                  sortDirection={contractsTableUpcoming.getSortDirection('DaysUntilRenewal')}
                  onSort={contractsTableUpcoming.handleSort}
                />
                <SortableHeader
                  label="Auto-Renew"
                  column="AutoRenewal"
                  sortDirection={contractsTableUpcoming.getSortDirection('AutoRenewal')}
                  onSort={contractsTableUpcoming.handleSort}
                />
                <SortableHeader
                  label="Status"
                  column="IsAtRisk"
                  sortDirection={contractsTableUpcoming.getSortDirection('IsAtRisk')}
                  onSort={contractsTableUpcoming.handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {contractsTableUpcoming.sortedData.slice(0, 20).map((contract, i) => (
                <tr key={i}>
                  <td>
                    <a
                      href={contract.SalesforceUrl || `https://por.my.salesforce.com/${contract.Id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {contract.ContractNumber}
                    </a>
                  </td>
                  <td>{contract.AccountName}</td>
                  <td>
                    <span
                      className="product-badge"
                      style={{
                        backgroundColor: PRODUCT_COLORS[contract.Product].bg,
                        color: PRODUCT_COLORS[contract.Product].text,
                      }}
                    >
                      {contract.Product}
                    </span>
                  </td>
                  <td>{contract.Region}</td>
                  <td>{new Date(contract.EndDate).toLocaleDateString()}</td>
                  <td className={contract.DaysUntilRenewal <= 30 ? 'urgent' : ''}>
                    {contract.DaysUntilRenewal}d
                  </td>
                  <td>
                    <span className={`auto-badge ${contract.AutoRenewal ? 'yes' : 'no'}`}>
                      {contract.AutoRenewal ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${contract.IsAtRisk ? 'atrisk' : 'ok'}`}>
                      {contract.IsAtRisk ? 'At Risk' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
              {contractsTableUpcoming.sortedData.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    {safeData.sfAvailable
                      ? 'No upcoming contracts found'
                      : 'Salesforce data unavailable - showing BigQuery data only'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'missinguplift' && (
          <table className="renewals-table">
            <thead>
              <tr>
                <SortableHeader
                  label="Contract #"
                  column="ContractNumber"
                  sortDirection={missingUpliftTable.getSortDirection('ContractNumber')}
                  onSort={missingUpliftTable.handleSort}
                />
                <SortableHeader
                  label="Account"
                  column="AccountName"
                  sortDirection={missingUpliftTable.getSortDirection('AccountName')}
                  onSort={missingUpliftTable.handleSort}
                />
                <SortableHeader
                  label="Product"
                  column="Product"
                  sortDirection={missingUpliftTable.getSortDirection('Product')}
                  onSort={missingUpliftTable.handleSort}
                />
                <SortableHeader
                  label="Region"
                  column="Region"
                  sortDirection={missingUpliftTable.getSortDirection('Region')}
                  onSort={missingUpliftTable.handleSort}
                />
                <SortableHeader
                  label="Current ACV"
                  column="CurrentACV"
                  sortDirection={missingUpliftTable.getSortDirection('CurrentACV')}
                  onSort={missingUpliftTable.handleSort}
                />
                <SortableHeader
                  label="Uplift Configured"
                  column="UpliftAmount"
                  sortDirection={missingUpliftTable.getSortDirection('UpliftAmount')}
                  onSort={missingUpliftTable.handleSort}
                />
                <SortableHeader
                  label="Potential Lost"
                  column="PotentialLost"
                  sortDirection={missingUpliftTable.getSortDirection('PotentialLost')}
                  onSort={missingUpliftTable.handleSort}
                />
                <SortableHeader
                  label="End Date"
                  column="EndDate"
                  sortDirection={missingUpliftTable.getSortDirection('EndDate')}
                  onSort={missingUpliftTable.handleSort}
                />
                <SortableHeader
                  label="Days Until"
                  column="DaysUntilRenewal"
                  sortDirection={missingUpliftTable.getSortDirection('DaysUntilRenewal')}
                  onSort={missingUpliftTable.handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {missingUpliftTable.sortedData.map((contract, i) => (
                <tr key={i} className="warning-row">
                  <td>
                    <a
                      href={contract.SalesforceUrl || `https://por.my.salesforce.com/${contract.Id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {contract.ContractNumber}
                    </a>
                  </td>
                  <td>{contract.AccountName}</td>
                  <td>
                    <span
                      className="product-badge"
                      style={{
                        backgroundColor: PRODUCT_COLORS[contract.Product].bg,
                        color: PRODUCT_COLORS[contract.Product].text,
                      }}
                    >
                      {contract.Product}
                    </span>
                  </td>
                  <td>{contract.Region}</td>
                  <td className="money">{formatCurrency(contract.CurrentACV)}</td>
                  <td className="warning-cell">
                    {formatCurrency(contract.UpliftAmount)} ({contract.UpliftPct}%)
                  </td>
                  <td className="lost-revenue">
                    {formatCurrency(contract.CurrentACV * 0.05)}
                  </td>
                  <td>{new Date(contract.EndDate).toLocaleDateString()}</td>
                  <td className={contract.DaysUntilRenewal <= 30 ? 'urgent' : ''}>
                    {contract.DaysUntilRenewal}d
                  </td>
                </tr>
              ))}
              {missingUpliftTable.sortedData.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-row">
                    No contracts with missing uplift found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .renewals-section {
          margin-top: 24px;
          padding: 20px;
          background: white;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .section-header h2 {
          margin: 0;
          font-size: 1.2em;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .section-icon {
          font-size: 1.1em;
        }
        .sf-badge, .bq-badge, .empty-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.7em;
          font-weight: 600;
        }
        .sf-badge {
          background: #dcfce7;
          color: #166534;
        }
        .bq-badge {
          background: #fef3c7;
          color: #92400e;
        }
        .empty-badge {
          background: #f1f5f9;
          color: #64748b;
        }
        /* Renewal Forecast Card - Prominent RAG Display */
        .renewal-forecast-card {
          padding: 20px 24px;
          border-radius: 12px;
          border: 2px solid;
          margin-bottom: 20px;
        }
        .forecast-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .forecast-header h3 {
          margin: 0;
          font-size: 1.1em;
          font-weight: 600;
          color: #1e293b;
        }
        .rag-badge-large {
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.85em;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .forecast-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        @media (max-width: 1000px) {
          .forecast-metrics { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .forecast-metrics { grid-template-columns: 1fr; }
        }
        .forecast-metric {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .forecast-metric .metric-label {
          font-size: 0.75em;
          color: #64748b;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .forecast-metric .metric-value {
          font-size: 1.4em;
          font-weight: 700;
          color: #1e293b;
        }
        .forecast-metric .metric-sub {
          font-size: 0.75em;
          color: #64748b;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        @media (max-width: 1200px) {
          .kpi-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 768px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .kpi-card {
          padding: 14px;
          border-radius: 8px;
          text-align: center;
        }
        .kpi-card.green { background: var(--success-bg); border: 1px solid var(--success-border); }
        .kpi-card.blue { background: var(--bg-tertiary); border: 1px solid var(--accent-blue); }
        .kpi-card.purple { background: var(--bg-tertiary); border: 1px solid #a78bfa; }
        .kpi-card.orange { background: var(--warning-bg); border: 1px solid var(--warning-border); }
        .kpi-card.red { background: var(--danger-bg); border: 1px solid var(--danger-border); }
        .kpi-card.gray { background: var(--bg-tertiary); border: 1px solid var(--border-secondary); }
        .kpi-label {
          font-size: 0.75em;
          color: var(--text-tertiary);
          font-weight: 500;
          margin-bottom: 6px;
        }
        .kpi-value {
          font-size: 1.3em;
          font-weight: 700;
          color: var(--text-primary);
        }
        .kpi-sub {
          font-size: 0.7em;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--border-primary);
          margin-bottom: 16px;
        }
        .tab {
          padding: 10px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 0.85em;
          font-weight: 500;
          color: var(--text-tertiary);
          transition: all 0.15s ease;
        }
        .tab:hover {
          color: var(--accent-blue);
        }
        .tab.active {
          color: var(--accent-blue);
          border-bottom-color: var(--accent-blue);
        }
        .table-container {
          overflow-x: auto;
        }
        .renewals-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85em;
        }
        .renewals-table th {
          text-align: left;
          padding: 10px 12px;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          font-weight: 600;
          border-bottom: 1px solid var(--border-primary);
        }
        .renewals-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-tertiary);
          color: var(--text-primary);
        }
        .renewals-table a {
          color: var(--link-color);
          text-decoration: none;
        }
        .renewals-table a:hover {
          text-decoration: underline;
        }
        .product-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 0.75em;
          font-weight: 600;
        }
        .money {
          font-family: monospace;
          text-align: right;
        }
        .money.positive {
          color: var(--green);
        }
        .urgent {
          color: var(--red);
          font-weight: 600;
        }
        .auto-badge {
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 0.75em;
          font-weight: 600;
        }
        .auto-badge.yes { background: var(--success-bg); color: var(--success-text); }
        .auto-badge.no { background: var(--warning-bg); color: var(--warning-text); }
        .status-badge {
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 0.75em;
          font-weight: 600;
        }
        .status-badge.ok { background: var(--success-bg); color: var(--success-text); }
        .status-badge.atrisk { background: var(--danger-bg); color: var(--danger-text); }
        .empty-row {
          text-align: center;
          color: var(--text-muted);
          padding: 30px !important;
        }
        /* Missing Uplift Warning Styles */
        .missing-uplift-warning {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: var(--warning-bg);
          border: 2px solid var(--warning-border);
          border-radius: 10px;
          margin-bottom: 20px;
        }
        .warning-icon {
          font-size: 24px;
        }
        .warning-content {
          flex: 1;
        }
        .warning-title {
          font-size: 1em;
          font-weight: 700;
          color: var(--warning-text);
          margin-bottom: 6px;
        }
        .warning-details {
          font-size: 0.85em;
          color: var(--text-secondary);
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .warning-details .separator {
          color: var(--warning-border);
        }
        .warning-details .lost-revenue {
          color: var(--red);
          font-weight: 600;
        }
        .view-contracts-btn {
          margin-top: 10px;
          padding: 6px 14px;
          background: var(--warning-border);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.8em;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .view-contracts-btn:hover {
          background: #d97706;
        }
        .tab.warning-tab {
          color: var(--red);
        }
        .tab.warning-tab.active {
          color: var(--red);
          border-bottom-color: var(--red);
        }
        .warning-row {
          background: var(--warning-bg);
        }
        .warning-row:hover {
          background: var(--bg-hover);
        }
        .warning-cell {
          color: var(--red);
          font-weight: 600;
        }
        .lost-revenue {
          color: #dc2626;
          font-weight: 600;
          font-family: monospace;
        }
      `}</style>
    </section>
  );
}
