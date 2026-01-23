'use client';

import { useState } from 'react';
import { ReportData, Product, Region, AttainmentRow, ProductTotal } from '@/lib/types';

interface AIAnalysisProps {
  reportData: ReportData | null;
  selectedProducts: Product[];
  selectedRegions: Region[];
}

interface AnalysisState {
  loading: boolean;
  analysis: string | null;
  error: string | null;
  generatedAt: string | null;
}

// Recalculate product totals based on filtered attainment data
function recalculateProductTotals(attainmentRows: AttainmentRow[]): ProductTotal {
  const fyTarget = attainmentRows.reduce((sum, row) => sum + (row.fy_target || 0), 0);
  const q1Target = attainmentRows.reduce((sum, row) => sum + (row.q1_target || 0), 0);
  const qtdTarget = attainmentRows.reduce((sum, row) => sum + (row.qtd_target || 0), 0);
  const qtdAcv = attainmentRows.reduce((sum, row) => sum + (row.qtd_acv || 0), 0);
  const pipelineAcv = attainmentRows.reduce((sum, row) => sum + (row.pipeline_acv || 0), 0);
  const wonDeals = attainmentRows.reduce((sum, row) => sum + (row.qtd_deals || 0), 0);
  const lostDeals = attainmentRows.reduce((sum, row) => sum + (row.qtd_lost_deals || 0), 0);
  const lostAcv = attainmentRows.reduce((sum, row) => sum + (row.qtd_lost_acv || 0), 0);
  const remaining = q1Target - qtdAcv;
  const totalDeals = wonDeals + lostDeals;

  return {
    total_fy_target: fyTarget,
    total_q1_target: q1Target,
    total_qtd_target: qtdTarget,
    total_qtd_acv: qtdAcv,
    total_qtd_attainment_pct: qtdTarget > 0 ? Math.round((qtdAcv / qtdTarget) * 100) : 100,
    total_pipeline_acv: pipelineAcv,
    total_pipeline_coverage_x: remaining > 0 ? Math.round((pipelineAcv / remaining) * 10) / 10 : 0,
    total_win_rate_pct: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 1000) / 10 : 0,
    total_won_deals: wonDeals,
    total_lost_deals: lostDeals,
    total_lost_acv: lostAcv,
  };
}

// Filter report data by products and regions with proper recalculation
function filterReportData(
  reportData: ReportData,
  products: Product[],
  regions: Region[]
): ReportData {
  const filterByRegion = <T extends { region?: Region }>(arr: T[] | undefined): T[] =>
    arr?.filter(item => !item.region || regions.length === 0 || regions.includes(item.region)) || [];

  const includePOR = products.length === 0 || products.includes('POR');
  const includeR360 = products.length === 0 || products.includes('R360');

  // Filter attainment data
  const filteredPOR = includePOR ? filterByRegion(reportData.attainment_detail?.POR) : [];
  const filteredR360 = includeR360 ? filterByRegion(reportData.attainment_detail?.R360) : [];

  // Recalculate product totals based on filtered data
  const emptyTotal: ProductTotal = {
    total_fy_target: 0, total_q1_target: 0, total_qtd_target: 0, total_qtd_acv: 0,
    total_qtd_attainment_pct: 0, total_pipeline_acv: 0, total_pipeline_coverage_x: 0,
    total_win_rate_pct: 0, total_won_deals: 0, total_lost_deals: 0, total_lost_acv: 0,
  };

  const porTotals = includePOR ? recalculateProductTotals(filteredPOR) : emptyTotal;
  const r360Totals = includeR360 ? recalculateProductTotals(filteredR360) : emptyTotal;

  // Calculate grand totals
  const combinedQtdTarget = porTotals.total_qtd_target + r360Totals.total_qtd_target;
  const combinedQtdAcv = porTotals.total_qtd_acv + r360Totals.total_qtd_acv;
  const combinedPipeline = porTotals.total_pipeline_acv + r360Totals.total_pipeline_acv;
  const totalQ1Target = porTotals.total_q1_target + r360Totals.total_q1_target;
  const totalRemaining = totalQ1Target - combinedQtdAcv;

  const combinedWonDeals = porTotals.total_won_deals + r360Totals.total_won_deals;
  const combinedLostDeals = porTotals.total_lost_deals + r360Totals.total_lost_deals;
  const combinedTotalDeals = combinedWonDeals + combinedLostDeals;

  return {
    ...reportData,
    grand_total: {
      total_fy_target: porTotals.total_fy_target + r360Totals.total_fy_target,
      total_q1_target: totalQ1Target,
      total_qtd_target: combinedQtdTarget,
      total_qtd_acv: combinedQtdAcv,
      total_qtd_attainment_pct: combinedQtdTarget > 0 ? Math.round((combinedQtdAcv / combinedQtdTarget) * 100) : 100,
      total_pipeline_acv: combinedPipeline,
      total_pipeline_coverage_x: totalRemaining > 0 ? Math.round((combinedPipeline / totalRemaining) * 10) / 10 : 0,
      total_win_rate_pct: combinedTotalDeals > 0 ? Math.round((combinedWonDeals / combinedTotalDeals) * 1000) / 10 : 0,
      total_won_deals: combinedWonDeals,
      total_lost_deals: combinedLostDeals,
    },
    product_totals: {
      POR: porTotals,
      R360: r360Totals,
    },
    attainment_detail: {
      POR: filteredPOR,
      R360: filteredR360,
    },
    source_attainment: {
      POR: includePOR ? filterByRegion(reportData.source_attainment?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.source_attainment?.R360) : [],
    },
    funnel_by_category: {
      POR: includePOR ? filterByRegion(reportData.funnel_by_category?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.funnel_by_category?.R360) : [],
    },
    funnel_by_source: {
      POR: includePOR ? filterByRegion(reportData.funnel_by_source?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.funnel_by_source?.R360) : [],
    },
    pipeline_rca: {
      POR: includePOR ? filterByRegion(reportData.pipeline_rca?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.pipeline_rca?.R360) : [],
    },
    loss_reason_rca: {
      POR: includePOR ? filterByRegion(reportData.loss_reason_rca?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.loss_reason_rca?.R360) : [],
    },
    google_ads: {
      POR: includePOR ? filterByRegion(reportData.google_ads?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.google_ads?.R360) : [],
    },
    google_ads_rca: {
      POR: includePOR ? (reportData.google_ads_rca?.POR || []) : [],
      R360: includeR360 ? (reportData.google_ads_rca?.R360 || []) : [],
    },
    mql_details: {
      POR: includePOR ? filterByRegion(reportData.mql_details?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.mql_details?.R360) : [],
    },
    sql_details: {
      POR: includePOR ? filterByRegion(reportData.sql_details?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.sql_details?.R360) : [],
    },
  };
}

// Parse markdown-like formatting for display
function formatAnalysis(text: string) {
  // Helper to parse inline bold text
  const parseInlineBold = (content: string): React.ReactNode => {
    if (!content.includes('**')) return content;
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, j) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={j}>{part.replace(/\*\*/g, '')}</strong>
        : part
    );
  };

  // Pre-process: split inline numbered lists into separate lines
  // Match patterns like "1. text 2. text 3. text" (numbers followed by periods inline)
  let preprocessed = text;

  // Split inline numbered lists: look for "1. text 2. text" pattern and put each on new line
  preprocessed = preprocessed.replace(/(\d+\.)\s+([^.]+?\.?)(?=\s*\d+\.\s|$)/g, (match, num, content) => {
    // Only split if there's another numbered item after this one (inline pattern)
    return `\n${num} ${content.trim()}`;
  });

  // Clean up any double newlines
  preprocessed = preprocessed.replace(/\n{3,}/g, '\n\n');

  // Track if we're in the "Additional Insights" section (items should be bullets not numbers)
  let inAdditionalInsights = false;

  const elements: React.ReactNode[] = [];
  let keyCounter = 0;

  preprocessed.split('\n').forEach((line) => {
    // Check if entering Additional Insights section
    if (/Additional\s+(Insights|Focus)/i.test(line)) {
      inAdditionalInsights = true;
    }
    // Reset when hitting a new major section
    if (/^\d+\.\s+[A-Z]{2,}/.test(line) || line.startsWith('##')) {
      inAdditionalInsights = false;
    }
    const i = keyCounter++;

    // Headers (check longer prefixes first)
    if (line.startsWith('#### ')) {
      elements.push(<h5 key={i} className="analysis-h5">{parseInlineBold(line.replace('#### ', ''))}</h5>);
      return;
    }
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="analysis-h4">{parseInlineBold(line.replace('### ', ''))}</h4>);
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="analysis-h3">{parseInlineBold(line.replace('## ', ''))}</h3>);
      return;
    }

    // Section label lines (Status:, Key Risks:, Action Items:, Root Cause Analysis:, etc.)
    const labelMatch = line.match(/^(Status|Key Risks?|Action Items?|Root Cause Analysis|Gap to Target|Regional Director Accountability|Likelihood|Top \d+ (?:global )?priorities|Additional (?:Focus Areas|Insights)|Loss Reasons?|MQL Disqualification|Source Channel|Funnel Conversion):?\s*(.*)$/i);
    if (labelMatch) {
      const [, label, value] = labelMatch;
      if (value && value.trim()) {
        // Check for RAG status in the value and color code it
        let formattedValue: React.ReactNode = parseInlineBold(value);
        if (label.toLowerCase() === 'status') {
          // Color code RED/YELLOW/GREEN in status line
          if (value.includes('RED')) {
            formattedValue = <span style={{ color: '#dc2626', fontWeight: 600 }}>{value}</span>;
          } else if (value.includes('YELLOW')) {
            formattedValue = <span style={{ color: '#ca8a04', fontWeight: 600 }}>{value}</span>;
          } else if (value.includes('GREEN')) {
            formattedValue = <span style={{ color: '#16a34a', fontWeight: 600 }}>{value}</span>;
          }
        }
        // Label with inline value
        elements.push(
          <p key={i} className="analysis-label-line">
            <span className="analysis-label">{label}:</span> {formattedValue}
          </p>
        );
      } else {
        // Label only (acts as sub-header)
        elements.push(<p key={i} className="analysis-label-only">{label}</p>);
      }
      return;
    }

    // Fully bold line
    if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<p key={i} className="analysis-bold">{line.replace(/\*\*/g, '')}</p>);
      return;
    }

    // Indented bullet points (2+ spaces before -)
    if (/^\s{2,}[-*]\s/.test(line)) {
      const content = line.replace(/^\s+[-*]\s/, '');
      elements.push(<li key={i} className="analysis-li-indent">{parseInlineBold(content)}</li>);
      return;
    }

    // Regular bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} className="analysis-li">{parseInlineBold(line.replace(/^[-*]\s/, ''))}</li>);
      return;
    }

    // Numbered list items - convert to bullets if in Additional Insights section
    if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, '');
      if (inAdditionalInsights) {
        // Use bullet style for Additional Insights items
        elements.push(<li key={i} className="analysis-li">{parseInlineBold(content)}</li>);
      } else {
        elements.push(<li key={i} className="analysis-li-num">{parseInlineBold(content)}</li>);
      }
      return;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<br key={i} />);
      return;
    }

    // Horizontal rule
    if (line.trim() === '---') {
      elements.push(<hr key={i} className="analysis-hr" />);
      return;
    }

    // Regular paragraph with potential inline bold
    if (line.includes('**')) {
      elements.push(<p key={i} className="analysis-p">{parseInlineBold(line)}</p>);
      return;
    }

    elements.push(<p key={i} className="analysis-p">{line}</p>);
  });

  return elements;
}

// Get display label for current filter selection
function getFilterLabel(products: Product[], regions: Region[]): string {
  const productLabel = products.length === 0 || products.length === 2
    ? 'All Products'
    : products[0];
  const regionLabel = regions.length === 0 || regions.length === 3
    ? 'All Regions'
    : regions.join(', ');
  return `${productLabel} • ${regionLabel}`;
}

export default function AIAnalysis({ reportData, selectedProducts, selectedRegions }: AIAnalysisProps) {
  const [state, setState] = useState<AnalysisState>({
    loading: false,
    analysis: null,
    error: null,
    generatedAt: null,
  });

  // Generate analysis based on current filter selection
  const generateAnalysis = async () => {
    if (!reportData) return;

    setState({ loading: true, analysis: null, error: null, generatedAt: null });

    try {
      const filteredData = filterReportData(reportData, selectedProducts, selectedRegions);

      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportData: filteredData,
          analysisType: 'bookings_miss',
          filterContext: {
            products: selectedProducts.length === 0 ? ['POR', 'R360'] : selectedProducts,
            regions: selectedRegions.length === 0 ? ['AMER', 'EMEA', 'APAC'] : selectedRegions,
            isFiltered: selectedProducts.length > 0 || selectedRegions.length > 0,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate analysis');
      }

      setState({
        loading: false,
        analysis: data.analysis,
        error: null,
        generatedAt: data.generated_at,
      });
    } catch (error: any) {
      setState({
        loading: false,
        analysis: null,
        error: error.message || 'Failed to generate analysis',
        generatedAt: null,
      });
    }
  };

  // Clear analysis
  const clearAnalysis = () => {
    setState({ loading: false, analysis: null, error: null, generatedAt: null });
  };

  const filterLabel = getFilterLabel(selectedProducts, selectedRegions);

  return (
    <section className="ai-analysis-section" data-testid="ai-analysis">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-title">
          <span className="ai-icon">AI</span>
          <h2>Analysis & Recommendations</h2>
        </div>
        <div className="header-actions">
          <button
            onClick={generateAnalysis}
            disabled={state.loading || !reportData}
            className="btn btn-primary"
          >
            {state.loading ? (
              <>
                <span className="spinner-small" />
                Analyzing...
              </>
            ) : (
              <>Generate Analysis</>
            )}
          </button>
          {state.analysis && (
            <button onClick={clearAnalysis} className="btn btn-ghost">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content Panel */}
      <div className="content-panel">
        {/* Filter Context */}
        <div className="filter-context">
          <span className="filter-label">Analyzing:</span>
          <span className="filter-value">{filterLabel}</span>
          {state.generatedAt && (
            <span className="timestamp">
              Generated: {new Date(state.generatedAt).toLocaleString()}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="panel-content">
          {state.error && (
            <div className="error-message">
              <span className="error-icon">!</span>
              {state.error}
            </div>
          )}

          {!state.analysis && !state.loading && !state.error && (
            <div className="placeholder">
              <div className="placeholder-icon">AI</div>
              <p className="placeholder-text">
                Click <strong>Generate Analysis</strong> to get AI-powered insights and recommendations
                for the current filter selection.
              </p>
              <p className="placeholder-hint">
                Use the filters above to narrow down to specific products or regions before generating.
              </p>
            </div>
          )}

          {state.loading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Analyzing {filterLabel}...</p>
            </div>
          )}

          {state.analysis && (
            <div className="analysis-content">
              {formatAnalysis(state.analysis)}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .ai-analysis-section {
          margin-top: 32px;
          margin-bottom: 32px;
        }

        .ai-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .ai-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ai-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          font-weight: 700;
          font-size: 0.85em;
          border-radius: 8px;
          letter-spacing: -0.5px;
        }

        .ai-header h2 {
          margin: 0;
          font-size: 1.35em;
          font-weight: 600;
          color: var(--text-primary);
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .btn {
          padding: 10px 18px;
          border: none;
          border-radius: 8px;
          font-size: 0.9em;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s ease;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-tertiary);
        }

        .btn-ghost:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        /* Content Panel */
        .content-panel {
          background: var(--bg-secondary);
          border: 2px solid var(--border-primary);
          border-radius: 12px;
          min-height: 200px;
        }

        .filter-context {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-tertiary);
          background: var(--bg-tertiary);
          border-radius: 10px 10px 0 0;
          flex-wrap: wrap;
        }

        .filter-label {
          font-size: 0.9em;
          color: var(--text-tertiary);
        }

        .filter-value {
          font-size: 0.95em;
          font-weight: 600;
          color: var(--text-primary);
          padding: 4px 12px;
          background: var(--accent-blue);
          color: white;
          border-radius: 6px;
        }

        .timestamp {
          font-size: 0.85em;
          color: var(--text-muted);
          margin-left: auto;
        }

        .panel-content {
          padding: 28px 32px;
        }

        /* Error State */
        .error-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: var(--danger-bg);
          border: 1px solid var(--danger-border);
          border-radius: 8px;
          color: var(--danger-text);
          font-size: 0.95em;
        }

        .error-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #dc2626;
          color: white;
          border-radius: 50%;
          font-weight: 700;
          font-size: 0.85em;
        }

        /* Placeholder State */
        .placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
        }

        .placeholder-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
          color: #6366f1;
          font-weight: 700;
          font-size: 1.2em;
          border-radius: 16px;
          margin-bottom: 20px;
        }

        .placeholder-text {
          font-size: 1em;
          color: var(--text-primary);
          max-width: 450px;
          line-height: 1.6;
          margin-bottom: 8px;
        }

        .placeholder-hint {
          font-size: 0.9em;
          color: var(--text-muted);
        }

        /* Loading State */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          color: var(--text-tertiary);
        }

        .loading-state p {
          font-size: 1em;
          margin-top: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--border-primary);
          border-top-color: var(--accent-blue);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          display: inline-block;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Analysis Content */
        .analysis-content {
          font-size: 1em;
          line-height: 1.75;
          color: var(--text-primary);
        }

        .analysis-content :global(.analysis-h3) {
          font-size: 1.25em;
          font-weight: 600;
          margin: 28px 0 14px;
          color: var(--accent-blue);
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-primary);
        }

        .analysis-content :global(.analysis-h3:first-child) {
          margin-top: 0;
        }

        .analysis-content :global(.analysis-h4) {
          font-size: 1.1em;
          font-weight: 600;
          margin: 22px 0 12px;
          color: var(--text-primary);
        }

        .analysis-content :global(.analysis-h5) {
          font-size: 1.05em;
          font-weight: 600;
          margin: 18px 0 10px;
          color: var(--text-secondary);
        }

        .analysis-content :global(.analysis-bold) {
          font-weight: 600;
          margin: 14px 0 8px;
          color: var(--text-primary);
        }

        .analysis-content :global(.analysis-label-only) {
          font-weight: 600;
          font-size: 0.95em;
          color: var(--accent-blue);
          margin: 16px 0 6px;
          padding: 6px 0;
          border-bottom: 1px solid var(--border-tertiary);
        }

        .analysis-content :global(.analysis-label-line) {
          margin: 8px 0;
          font-size: 0.95em;
        }

        .analysis-content :global(.analysis-label) {
          font-weight: 600;
          color: var(--text-secondary);
        }

        .analysis-content :global(.analysis-p) {
          margin: 10px 0;
        }

        .analysis-content :global(.analysis-li),
        .analysis-content :global(.analysis-li-num) {
          margin-left: 24px;
          margin-bottom: 10px;
          padding-left: 8px;
        }

        .analysis-content :global(.analysis-li) {
          list-style-type: disc;
        }

        .analysis-content :global(.analysis-li-num) {
          list-style-type: decimal;
        }

        .analysis-content :global(.analysis-li-indent) {
          margin-left: 48px;
          margin-bottom: 8px;
          padding-left: 8px;
          list-style-type: circle;
        }

        .analysis-content :global(.analysis-hr) {
          border: none;
          border-top: 1px solid var(--border-primary);
          margin: 24px 0;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .ai-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .header-actions {
            width: 100%;
          }

          .btn {
            flex: 1;
            justify-content: center;
          }

          .filter-context {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .timestamp {
            margin-left: 0;
          }

          .panel-content {
            padding: 20px 16px;
          }
        }
      `}</style>
    </section>
  );
}
