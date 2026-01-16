'use client';

import { useState, useRef, useCallback } from 'react';
import { ReportData, Product, Region, AIAnalysisTile as AITileType } from '@/lib/types';
import { ALL_PRODUCTS, ALL_REGIONS } from '@/lib/constants/dimensions';

interface AIAnalysisProps {
  reportData: ReportData | null;
}

interface TileState {
  loading: boolean;
  analysis: string | null;
  error: string | null;
  generatedAt: string | null;
}

// Product colors
const PRODUCT_COLORS: Record<Product, { bg: string; border: string; text: string; active: string }> = {
  POR: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', active: '#2563eb' },
  R360: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d', active: '#16a34a' },
};

// Region colors
const REGION_COLORS: Record<Region, { bg: string; text: string; active: string }> = {
  AMER: { bg: '#fef3c7', text: '#92400e', active: '#f59e0b' },
  EMEA: { bg: '#e0e7ff', text: '#3730a3', active: '#6366f1' },
  APAC: { bg: '#fce7f3', text: '#9d174d', active: '#ec4899' },
};

// Filter report data by product and region
function filterReportData(reportData: ReportData, product: Product, region: Region): ReportData {
  const filterByRegion = <T extends { region?: Region }>(arr: T[] | undefined): T[] =>
    arr?.filter(item => item.region === region) || [];

  return {
    ...reportData,
    attainment_detail: {
      POR: product === 'POR' ? filterByRegion(reportData.attainment_detail?.POR) : [],
      R360: product === 'R360' ? filterByRegion(reportData.attainment_detail?.R360) : [],
    },
    source_attainment: {
      POR: product === 'POR' ? filterByRegion(reportData.source_attainment?.POR) : [],
      R360: product === 'R360' ? filterByRegion(reportData.source_attainment?.R360) : [],
    },
    funnel_by_category: {
      POR: product === 'POR' ? filterByRegion(reportData.funnel_by_category?.POR) : [],
      R360: product === 'R360' ? filterByRegion(reportData.funnel_by_category?.R360) : [],
    },
    funnel_by_source: {
      POR: product === 'POR' ? filterByRegion(reportData.funnel_by_source?.POR) : [],
      R360: product === 'R360' ? filterByRegion(reportData.funnel_by_source?.R360) : [],
    },
    pipeline_rca: {
      POR: product === 'POR' ? filterByRegion(reportData.pipeline_rca?.POR) : [],
      R360: product === 'R360' ? filterByRegion(reportData.pipeline_rca?.R360) : [],
    },
    loss_reason_rca: {
      POR: product === 'POR' ? filterByRegion(reportData.loss_reason_rca?.POR) : [],
      R360: product === 'R360' ? filterByRegion(reportData.loss_reason_rca?.R360) : [],
    },
    google_ads: {
      POR: product === 'POR' ? filterByRegion(reportData.google_ads?.POR) : [],
      R360: product === 'R360' ? filterByRegion(reportData.google_ads?.R360) : [],
    },
  };
}

// Parse markdown-like formatting for display
function formatAnalysis(text: string) {
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
}

export default function AIAnalysis({ reportData }: AIAnalysisProps) {
  // Local filters for AI tiles
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(['POR', 'R360']);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(['AMER', 'EMEA']);

  // Tile states
  const [tileStates, setTileStates] = useState<Record<string, TileState>>({});
  const [generatingAll, setGeneratingAll] = useState(false);

  const getTileKey = (product: Product, region: Region) => `${product}-${region}`;

  const isTileActive = (product: Product, region: Region) =>
    selectedProducts.includes(product) && selectedRegions.includes(region);

  // Toggle product filter
  const toggleProduct = (product: Product) => {
    setSelectedProducts(prev =>
      prev.includes(product)
        ? prev.filter(p => p !== product)
        : [...prev, product]
    );
  };

  // Toggle region filter
  const toggleRegion = (region: Region) => {
    setSelectedRegions(prev =>
      prev.includes(region)
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  };

  // Generate analysis for a single tile
  const generateForTile = async (product: Product, region: Region) => {
    if (!reportData) return;

    const key = getTileKey(product, region);
    setTileStates(prev => ({
      ...prev,
      [key]: { loading: true, analysis: null, error: null, generatedAt: null },
    }));

    try {
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

      setTileStates(prev => ({
        ...prev,
        [key]: {
          loading: false,
          analysis: data.analysis,
          error: null,
          generatedAt: data.generated_at,
        },
      }));
    } catch (error: any) {
      setTileStates(prev => ({
        ...prev,
        [key]: {
          loading: false,
          analysis: null,
          error: error.message || 'Failed to generate analysis',
          generatedAt: null,
        },
      }));
    }
  };

  // Generate all active tiles
  const generateAll = async () => {
    if (!reportData) return;

    setGeneratingAll(true);

    const activeTiles: { product: Product; region: Region }[] = [];
    for (const product of selectedProducts) {
      for (const region of selectedRegions) {
        activeTiles.push({ product, region });
      }
    }

    // Generate sequentially to avoid rate limits
    for (const tile of activeTiles) {
      await generateForTile(tile.product, tile.region);
    }

    setGeneratingAll(false);
  };

  // Clear all analysis
  const clearAll = () => {
    setTileStates({});
  };

  // Get active tile count
  const activeTileCount = selectedProducts.length * selectedRegions.length;

  return (
    <section className="ai-analysis-section">
      {/* Header */}
      <div className="ai-header">
        <h2>
          <span className="ai-icon">🤖</span>
          AI Analysis & Recommendations
        </h2>
        <div className="header-actions">
          <button
            onClick={generateAll}
            disabled={generatingAll || !reportData || activeTileCount === 0}
            className="btn btn-primary"
          >
            {generatingAll ? (
              <>
                <span className="spinner-small" />
                Generating...
              </>
            ) : (
              <>Generate All ({activeTileCount})</>
            )}
          </button>
          <button onClick={clearAll} className="btn btn-secondary">
            Clear All
          </button>
        </div>
      </div>

      {/* Local Filters */}
      <div className="ai-filters">
        <div className="filter-group">
          <span className="filter-label">Products:</span>
          <div className="filter-buttons">
            {ALL_PRODUCTS.map(product => (
              <button
                key={product}
                onClick={() => toggleProduct(product)}
                className={`filter-btn ${selectedProducts.includes(product) ? 'active' : ''}`}
                style={{
                  backgroundColor: selectedProducts.includes(product)
                    ? PRODUCT_COLORS[product].active
                    : PRODUCT_COLORS[product].bg,
                  color: selectedProducts.includes(product)
                    ? 'white'
                    : PRODUCT_COLORS[product].text,
                  borderColor: PRODUCT_COLORS[product].border,
                }}
              >
                {product}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-label">Regions:</span>
          <div className="filter-buttons">
            {ALL_REGIONS.map(region => (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                className={`filter-btn ${selectedRegions.includes(region) ? 'active' : ''}`}
                style={{
                  backgroundColor: selectedRegions.includes(region)
                    ? REGION_COLORS[region].active
                    : REGION_COLORS[region].bg,
                  color: selectedRegions.includes(region)
                    ? 'white'
                    : REGION_COLORS[region].text,
                }}
              >
                {region}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tiles Grid */}
      <div className="tiles-grid">
        {ALL_PRODUCTS.map(product =>
          ALL_REGIONS.map(region => {
            const key = getTileKey(product, region);
            const state = tileStates[key] || { loading: false, analysis: null, error: null, generatedAt: null };
            const active = isTileActive(product, region);

            return (
              <div
                key={key}
                className={`ai-tile ${!active ? 'inactive' : ''}`}
                style={{
                  border: `2px solid ${active ? PRODUCT_COLORS[product].border : '#e5e7eb'}`,
                  opacity: active ? 1 : 0.4,
                }}
              >
                {/* Tile Header */}
                <div className="tile-header">
                  <div className="tile-badges">
                    <span
                      className="badge"
                      style={{ backgroundColor: PRODUCT_COLORS[product].bg, color: PRODUCT_COLORS[product].text }}
                    >
                      {product}
                    </span>
                    <span
                      className="badge"
                      style={{ backgroundColor: REGION_COLORS[region].bg, color: REGION_COLORS[region].text }}
                    >
                      {region}
                    </span>
                  </div>
                  <button
                    onClick={() => generateForTile(product, region)}
                    disabled={state.loading || !reportData || !active}
                    className="tile-btn"
                  >
                    {state.loading ? <span className="spinner-small" /> : 'Generate'}
                  </button>
                </div>

                {/* Tile Content */}
                <div className="tile-content">
                  {state.error && (
                    <div className="tile-error">{state.error}</div>
                  )}

                  {!state.analysis && !state.loading && !state.error && (
                    <div className="tile-placeholder">
                      <p>Click Generate for AI insights</p>
                    </div>
                  )}

                  {state.loading && (
                    <div className="tile-loading">
                      <div className="spinner" />
                      <p>Analyzing...</p>
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
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        .ai-analysis-section {
          margin-top: 24px;
        }
        .ai-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .ai-header h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 1.25em;
        }
        .ai-icon {
          font-size: 1.2em;
        }
        .header-actions {
          display: flex;
          gap: 8px;
        }
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 0.9em;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
        }
        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        .btn-secondary:hover {
          background: #e2e8f0;
        }
        .ai-filters {
          display: flex;
          gap: 24px;
          margin-bottom: 20px;
          padding: 12px 16px;
          background: #f8fafc;
          border-radius: 8px;
          flex-wrap: wrap;
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .filter-label {
          font-size: 0.85em;
          color: #64748b;
          font-weight: 500;
        }
        .filter-buttons {
          display: flex;
          gap: 6px;
        }
        .filter-btn {
          padding: 6px 14px;
          border: 1px solid transparent;
          border-radius: 6px;
          font-size: 0.8em;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .filter-btn:hover {
          transform: translateY(-1px);
        }
        .tiles-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 1200px) {
          .tiles-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 768px) {
          .tiles-grid {
            grid-template-columns: 1fr;
          }
        }
        .ai-tile {
          background: white;
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 200px;
          transition: opacity 0.2s ease;
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
          font-size: 0.7em;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .tile-btn {
          padding: 5px 12px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 0.75em;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .tile-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .tile-content {
          flex: 1;
          padding: 14px;
          overflow-y: auto;
          max-height: 350px;
        }
        .tile-error {
          padding: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.8em;
        }
        .tile-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 100px;
          color: #9ca3af;
          text-align: center;
          font-size: 0.85em;
        }
        .tile-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 100px;
          color: #64748b;
        }
        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #e2e8f0;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 10px;
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
          font-size: 0.8em;
          line-height: 1.5;
        }
        .tile-timestamp {
          font-size: 0.7em;
          color: #94a3b8;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f1f5f9;
        }
        .analysis-text :global(.tile-h3) {
          font-size: 0.95em;
          font-weight: 600;
          margin: 10px 0 5px;
          color: #1e40af;
        }
        .analysis-text :global(.tile-h4) {
          font-size: 0.9em;
          font-weight: 600;
          margin: 8px 0 4px;
          color: #374151;
        }
        .analysis-text :global(.tile-bold) {
          font-weight: 600;
          margin: 6px 0 3px;
        }
        .analysis-text :global(.tile-p) {
          margin: 3px 0;
        }
        .analysis-text :global(.tile-li),
        .analysis-text :global(.tile-li-num) {
          margin-left: 14px;
          margin-bottom: 3px;
        }
        .analysis-text :global(.tile-li-num) {
          list-style-type: decimal;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}
