'use client';

import { useState } from 'react';
import { ReportData, Product, Region } from '@/lib/types';

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

// Filter report data by products and regions
function filterReportData(
  reportData: ReportData,
  products: Product[],
  regions: Region[]
): ReportData {
  const filterByRegion = <T extends { region?: Region }>(arr: T[] | undefined): T[] =>
    arr?.filter(item => !item.region || regions.length === 0 || regions.includes(item.region)) || [];

  const filterByProduct = (product: Product) =>
    products.length === 0 || products.includes(product);

  return {
    ...reportData,
    attainment_detail: {
      POR: filterByProduct('POR') ? filterByRegion(reportData.attainment_detail?.POR) : [],
      R360: filterByProduct('R360') ? filterByRegion(reportData.attainment_detail?.R360) : [],
    },
    source_attainment: {
      POR: filterByProduct('POR') ? filterByRegion(reportData.source_attainment?.POR) : [],
      R360: filterByProduct('R360') ? filterByRegion(reportData.source_attainment?.R360) : [],
    },
    funnel_by_category: {
      POR: filterByProduct('POR') ? filterByRegion(reportData.funnel_by_category?.POR) : [],
      R360: filterByProduct('R360') ? filterByRegion(reportData.funnel_by_category?.R360) : [],
    },
    funnel_by_source: {
      POR: filterByProduct('POR') ? filterByRegion(reportData.funnel_by_source?.POR) : [],
      R360: filterByProduct('R360') ? filterByRegion(reportData.funnel_by_source?.R360) : [],
    },
    pipeline_rca: {
      POR: filterByProduct('POR') ? filterByRegion(reportData.pipeline_rca?.POR) : [],
      R360: filterByProduct('R360') ? filterByRegion(reportData.pipeline_rca?.R360) : [],
    },
    loss_reason_rca: {
      POR: filterByProduct('POR') ? filterByRegion(reportData.loss_reason_rca?.POR) : [],
      R360: filterByProduct('R360') ? filterByRegion(reportData.loss_reason_rca?.R360) : [],
    },
    google_ads: {
      POR: filterByProduct('POR') ? filterByRegion(reportData.google_ads?.POR) : [],
      R360: filterByProduct('R360') ? filterByRegion(reportData.google_ads?.R360) : [],
    },
  };
}

// Parse markdown-like formatting for display
function formatAnalysis(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return <h3 key={i} className="analysis-h3">{line.replace('## ', '')}</h3>;
    }
    if (line.startsWith('### ')) {
      return <h4 key={i} className="analysis-h4">{line.replace('### ', '')}</h4>;
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      return <p key={i} className="analysis-bold">{line.replace(/\*\*/g, '')}</p>;
    }
    if (line.includes('**')) {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className="analysis-p">
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j}>{part.replace(/\*\*/g, '')}</strong>
              : part
          )}
        </p>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return <li key={i} className="analysis-li">{line.replace(/^[-*]\s/, '')}</li>;
    }
    if (/^\d+\.\s/.test(line)) {
      return <li key={i} className="analysis-li-num">{line.replace(/^\d+\.\s/, '')}</li>;
    }
    if (line.trim() === '') {
      return <br key={i} />;
    }
    return <p key={i} className="analysis-p">{line}</p>;
  });
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
          color: #1f2937;
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
          color: #64748b;
        }

        .btn-ghost:hover {
          background: #f1f5f9;
          color: #374151;
        }

        /* Content Panel */
        .content-panel {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          min-height: 200px;
        }

        .filter-context {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          border-bottom: 1px solid #f1f5f9;
          background: #fafafa;
          border-radius: 10px 10px 0 0;
          flex-wrap: wrap;
        }

        .filter-label {
          font-size: 0.9em;
          color: #6b7280;
        }

        .filter-value {
          font-size: 0.95em;
          font-weight: 600;
          color: #1f2937;
          padding: 4px 12px;
          background: #e0e7ff;
          border-radius: 6px;
        }

        .timestamp {
          font-size: 0.85em;
          color: #94a3b8;
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
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
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
          color: #374151;
          max-width: 450px;
          line-height: 1.6;
          margin-bottom: 8px;
        }

        .placeholder-hint {
          font-size: 0.9em;
          color: #9ca3af;
        }

        /* Loading State */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          color: #64748b;
        }

        .loading-state p {
          font-size: 1em;
          margin-top: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e2e8f0;
          border-top-color: #2563eb;
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
          color: #374151;
        }

        .analysis-content :global(.analysis-h3) {
          font-size: 1.25em;
          font-weight: 600;
          margin: 28px 0 14px;
          color: #1e40af;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }

        .analysis-content :global(.analysis-h3:first-child) {
          margin-top: 0;
        }

        .analysis-content :global(.analysis-h4) {
          font-size: 1.1em;
          font-weight: 600;
          margin: 22px 0 12px;
          color: #374151;
        }

        .analysis-content :global(.analysis-bold) {
          font-weight: 600;
          margin: 14px 0 8px;
          color: #1f2937;
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
