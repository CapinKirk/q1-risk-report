'use client';

import { useState } from 'react';
import { Product, Region, ReportData } from '@/lib/types';

interface AIAnalysisTileProps {
  product: Product;
  region: Region;
  reportData: ReportData | null;
  isActive: boolean;
  onGenerate: () => void;
}

interface TileState {
  loading: boolean;
  analysis: string | null;
  error: string | null;
  generatedAt: string | null;
}

// Product colors
const PRODUCT_COLORS = {
  POR: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  R360: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
};

// Region colors
const REGION_COLORS = {
  AMER: { bg: '#fef3c7', text: '#92400e' },
  EMEA: { bg: '#e0e7ff', text: '#3730a3' },
  APAC: { bg: '#fce7f3', text: '#9d174d' },
};

// Filter report data by product and region
function filterReportData(reportData: ReportData, product: Product, region: Region): ReportData {
  const filterByRegion = <T extends { region?: Region }>(arr: T[]): T[] =>
    arr?.filter(item => item.region === region) || [];

  return {
    ...reportData,
    attainment_detail: {
      POR: product === 'POR' ? filterByRegion(reportData.attainment_detail?.POR || []) : [],
      R360: product === 'R360' ? filterByRegion(reportData.attainment_detail?.R360 || []) : [],
    },
    source_attainment: {
      POR: product === 'POR' ? filterByRegion(reportData.source_attainment?.POR || []) : [],
      R360: product === 'R360' ? filterByRegion(reportData.source_attainment?.R360 || []) : [],
    },
    funnel_by_category: {
      POR: product === 'POR' ? filterByRegion(reportData.funnel_by_category?.POR || []) : [],
      R360: product === 'R360' ? filterByRegion(reportData.funnel_by_category?.R360 || []) : [],
    },
    funnel_by_source: {
      POR: product === 'POR' ? filterByRegion(reportData.funnel_by_source?.POR || []) : [],
      R360: product === 'R360' ? filterByRegion(reportData.funnel_by_source?.R360 || []) : [],
    },
    pipeline_rca: {
      POR: product === 'POR' ? filterByRegion(reportData.pipeline_rca?.POR || []) : [],
      R360: product === 'R360' ? filterByRegion(reportData.pipeline_rca?.R360 || []) : [],
    },
    loss_reason_rca: {
      POR: product === 'POR' ? filterByRegion(reportData.loss_reason_rca?.POR || []) : [],
      R360: product === 'R360' ? filterByRegion(reportData.loss_reason_rca?.R360 || []) : [],
    },
    google_ads: {
      POR: product === 'POR' ? filterByRegion(reportData.google_ads?.POR || []) : [],
      R360: product === 'R360' ? filterByRegion(reportData.google_ads?.R360 || []) : [],
    },
  };
}

export default function AIAnalysisTile({ product, region, reportData, isActive, onGenerate }: AIAnalysisTileProps) {
  const [state, setState] = useState<TileState>({
    loading: false,
    analysis: null,
    error: null,
    generatedAt: null,
  });

  const generateAnalysis = async () => {
    if (!reportData || !isActive) return;

    setState({ loading: true, analysis: null, error: null, generatedAt: null });
    onGenerate();

    try {
      // Filter data for this specific product/region
      const filteredData = filterReportData(reportData, product, region);

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

  // Expose method for parent to trigger
  const triggerGenerate = generateAnalysis;

  // Parse markdown-like formatting for display
  const formatAnalysis = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return <h3 key={i} className="tile-h3">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('### ')) {
        return <h4 key={i} className="tile-h4">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="tile-bold">{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.includes('**')) {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="tile-p">
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.replace(/\*\*/g, '')}</strong>
                : part
            )}
          </p>
        );
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return <li key={i} className="tile-li">{line.replace(/^[-•]\s/, '')}</li>;
      }
      if (/^\d+\.\s/.test(line)) {
        return <li key={i} className="tile-li-num">{line.replace(/^\d+\.\s/, '')}</li>;
      }
      if (line.trim() === '') {
        return <br key={i} />;
      }
      return <p key={i} className="tile-p">{line}</p>;
    });
  };

  const productColor = PRODUCT_COLORS[product];
  const regionColor = REGION_COLORS[region];

  return (
    <div
      className={`ai-tile ${!isActive ? 'inactive' : ''}`}
      style={{
        border: `1px solid ${isActive ? productColor.border : '#e5e7eb'}`,
        opacity: isActive ? 1 : 0.5,
      }}
    >
      {/* Tile Header */}
      <div className="tile-header">
        <div className="tile-badges">
          <span
            className="badge product-badge"
            style={{ backgroundColor: productColor.bg, color: productColor.text }}
          >
            {product}
          </span>
          <span
            className="badge region-badge"
            style={{ backgroundColor: regionColor.bg, color: regionColor.text }}
          >
            {region}
          </span>
        </div>
        <button
          onClick={generateAnalysis}
          disabled={state.loading || !reportData || !isActive}
          className="tile-btn"
        >
          {state.loading ? (
            <span className="spinner-small" />
          ) : (
            'Generate'
          )}
        </button>
      </div>

      {/* Tile Content */}
      <div className="tile-content">
        {state.error && (
          <div className="tile-error">
            {state.error}
          </div>
        )}

        {!state.analysis && !state.loading && !state.error && (
          <div className="tile-placeholder">
            <p>Click Generate for AI insights on {product} {region}</p>
          </div>
        )}

        {state.loading && (
          <div className="tile-loading">
            <div className="spinner" />
            <p>Analyzing {product} {region}...</p>
          </div>
        )}

        {state.analysis && (
          <div className="tile-analysis">
            {state.generatedAt && (
              <div className="tile-timestamp">
                {new Date(state.generatedAt).toLocaleString()}
              </div>
            )}
            <div className="analysis-text">
              {formatAnalysis(state.analysis)}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .ai-tile {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 200px;
        }
        .ai-tile.inactive {
          pointer-events: none;
        }
        .tile-header {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafafa;
        }
        .tile-badges {
          display: flex;
          gap: 8px;
        }
        .badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.75em;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .tile-btn {
          padding: 6px 14px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.8em;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tile-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .tile-content {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          max-height: 400px;
        }
        .tile-error {
          padding: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.85em;
        }
        .tile-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 120px;
          color: #9ca3af;
          text-align: center;
          font-size: 0.9em;
        }
        .tile-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 120px;
          color: #64748b;
        }
        .spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #e2e8f0;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 12px;
        }
        .spinner-small {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          display: inline-block;
        }
        .tile-analysis {
          font-size: 0.85em;
          line-height: 1.5;
        }
        .tile-timestamp {
          font-size: 0.75em;
          color: #94a3b8;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        .analysis-text :global(.tile-h3) {
          font-size: 1em;
          font-weight: 600;
          margin: 12px 0 6px;
          color: #1e40af;
        }
        .analysis-text :global(.tile-h4) {
          font-size: 0.95em;
          font-weight: 600;
          margin: 10px 0 4px;
          color: #374151;
        }
        .analysis-text :global(.tile-bold) {
          font-weight: 600;
          margin: 8px 0 4px;
        }
        .analysis-text :global(.tile-p) {
          margin: 4px 0;
        }
        .analysis-text :global(.tile-li),
        .analysis-text :global(.tile-li-num) {
          margin-left: 16px;
          margin-bottom: 4px;
        }
        .analysis-text :global(.tile-li-num) {
          list-style-type: decimal;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Export a hook to control tile from parent
export function useTileControl() {
  const [tiles, setTiles] = useState<Record<string, TileState>>({});

  const getTileKey = (product: Product, region: Region) => `${product}-${region}`;

  return { tiles, setTiles, getTileKey };
}
