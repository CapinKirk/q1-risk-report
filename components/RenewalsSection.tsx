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

interface RenewalsSectionProps {
  products: Product[];
  regions: Region[];
}

// Product colors
const PRODUCT_COLORS: Record<Product, { bg: string; border: string; text: string }> = {
  POR: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  R360: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
};

export default function RenewalsSection({ products, regions }: RenewalsSectionProps) {
  const [renewalsData, setRenewalsData] = useState<RenewalsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'won' | 'pipeline' | 'upcoming' | 'atrisk'>('won');

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

        const response = await fetch(`/api/renewals?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch renewals');
        }

        setRenewalsData(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRenewals();
  }, [products, regions]);

  // Calculate combined summary based on selected products
  const getCombinedSummary = (): RenewalSummary | null => {
    if (!renewalsData) return null;

    const selectedProducts = products.length > 0 ? products : ['POR', 'R360'] as Product[];
    const summaries = selectedProducts.map(p => renewalsData.summary[p]);

    if (summaries.length === 1) return summaries[0];

    // Combine summaries
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
    };
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

  const getFilteredContracts = (type: 'upcoming' | 'atrisk'): SalesforceContract[] => {
    if (!renewalsData) return [];

    const selectedProducts = products.length > 0 ? products : ['POR', 'R360'] as Product[];
    const selectedRegions = regions.length > 0 ? regions : ['AMER', 'EMEA', 'APAC'] as Region[];

    let contracts: SalesforceContract[] = [];
    for (const p of selectedProducts) {
      const data = type === 'upcoming' ? renewalsData.upcomingContracts[p] : renewalsData.atRiskContracts[p];
      contracts = [...contracts, ...data];
    }

    return contracts.filter(c => selectedRegions.includes(c.Region));
  };

  const summary = getCombinedSummary();

  if (loading) {
    return (
      <section className="renewals-section">
        <h2>Renewals Overview</h2>
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading renewals data...</p>
        </div>
        <style jsx>{`
          .renewals-section { margin-top: 24px; padding: 20px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
          .loading-state { display: flex; flex-direction: column; align-items: center; padding: 40px; color: #64748b; }
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
          .renewals-section { margin-top: 24px; padding: 20px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
          .error-state { padding: 20px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #dc2626; }
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
  };

  return (
    <section className="renewals-section">
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

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card green">
          <div className="kpi-label">Won Renewals (QTD)</div>
          <div className="kpi-value">{formatCurrency(safeSummary.wonRenewalACV)}</div>
          <div className="kpi-sub">{safeSummary.wonRenewalCount} deals</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-label">Pipeline Renewals</div>
          <div className="kpi-value">{formatCurrency(safeSummary.pipelineRenewalACV)}</div>
          <div className="kpi-sub">{safeSummary.pipelineRenewalCount} deals</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-label">Avg Uplift</div>
          <div className="kpi-value">{safeSummary.avgUpliftPct}%</div>
          <div className="kpi-sub">{formatCurrency(safeSummary.totalUpliftAmount)} total</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-label">Upcoming (30d)</div>
          <div className="kpi-value">{safeSummary.upcomingRenewals30}</div>
          <div className="kpi-sub">{formatCurrency(safeSummary.upcomingRenewals30ACV)} ACV</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">At-Risk Contracts</div>
          <div className="kpi-value">{safeSummary.atRiskCount}</div>
          <div className="kpi-sub">{formatCurrency(safeSummary.atRiskACV)} at risk</div>
        </div>
        <div className="kpi-card gray">
          <div className="kpi-label">Lost Renewals</div>
          <div className="kpi-value">{formatCurrency(safeSummary.lostRenewalACV)}</div>
          <div className="kpi-sub">{safeSummary.lostRenewalCount} deals</div>
        </div>
      </div>

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
        <button
          className={`tab ${activeTab === 'atrisk' ? 'active' : ''}`}
          onClick={() => setActiveTab('atrisk')}
        >
          At Risk ({safeSummary.atRiskCount})
        </button>
      </div>

      {/* Table Content */}
      <div className="table-container">
        {(activeTab === 'won' || activeTab === 'pipeline') && (
          <table className="renewals-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Product</th>
                <th>Region</th>
                <th>ACV</th>
                <th>Uplift</th>
                <th>Close Date</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredOpps(activeTab === 'won' ? 'won' : 'pipeline').slice(0, 20).map((opp, i) => (
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
              {getFilteredOpps(activeTab === 'won' ? 'won' : 'pipeline').length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">No {activeTab} renewals found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {(activeTab === 'upcoming' || activeTab === 'atrisk') && (
          <table className="renewals-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Product</th>
                <th>Region</th>
                <th>End Date</th>
                <th>Days Until</th>
                <th>Auto-Renew</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredContracts(activeTab).slice(0, 20).map((contract, i) => (
                <tr key={i}>
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
              {getFilteredContracts(activeTab).length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {safeData.sfAvailable
                      ? `No ${activeTab === 'upcoming' ? 'upcoming' : 'at-risk'} contracts found`
                      : 'Salesforce data unavailable - showing BigQuery data only'}
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
        .kpi-card.green { background: #f0fdf4; border: 1px solid #86efac; }
        .kpi-card.blue { background: #eff6ff; border: 1px solid #93c5fd; }
        .kpi-card.purple { background: #faf5ff; border: 1px solid #c4b5fd; }
        .kpi-card.orange { background: #fff7ed; border: 1px solid #fdba74; }
        .kpi-card.red { background: #fef2f2; border: 1px solid #fca5a5; }
        .kpi-card.gray { background: #f8fafc; border: 1px solid #cbd5e1; }
        .kpi-label {
          font-size: 0.75em;
          color: #64748b;
          font-weight: 500;
          margin-bottom: 6px;
        }
        .kpi-value {
          font-size: 1.3em;
          font-weight: 700;
          color: #1e293b;
        }
        .kpi-sub {
          font-size: 0.7em;
          color: #94a3b8;
          margin-top: 4px;
        }
        .tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid #e2e8f0;
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
          color: #64748b;
          transition: all 0.15s ease;
        }
        .tab:hover {
          color: #2563eb;
        }
        .tab.active {
          color: #2563eb;
          border-bottom-color: #2563eb;
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
          background: #f8fafc;
          color: #64748b;
          font-weight: 600;
          border-bottom: 1px solid #e2e8f0;
        }
        .renewals-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #f1f5f9;
        }
        .renewals-table a {
          color: #2563eb;
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
          color: #16a34a;
        }
        .urgent {
          color: #dc2626;
          font-weight: 600;
        }
        .auto-badge {
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 0.75em;
          font-weight: 600;
        }
        .auto-badge.yes { background: #dcfce7; color: #166534; }
        .auto-badge.no { background: #fef3c7; color: #92400e; }
        .status-badge {
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 0.75em;
          font-weight: 600;
        }
        .status-badge.ok { background: #dcfce7; color: #166534; }
        .status-badge.atrisk { background: #fef2f2; color: #dc2626; }
        .empty-row {
          text-align: center;
          color: #94a3b8;
          padding: 30px !important;
        }
      `}</style>
    </section>
  );
}
