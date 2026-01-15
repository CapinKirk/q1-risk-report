'use client';

import { useState } from 'react';
import { ReportData } from '@/lib/types';

interface AIAnalysisProps {
  reportData: ReportData | null;
}

interface AnalysisState {
  loading: boolean;
  analysis: string | null;
  error: string | null;
  generatedAt: string | null;
}

export default function AIAnalysis({ reportData }: AIAnalysisProps) {
  const [state, setState] = useState<AnalysisState>({
    loading: false,
    analysis: null,
    error: null,
    generatedAt: null,
  });

  const generateAnalysis = async () => {
    if (!reportData) {
      setState(prev => ({ ...prev, error: 'No report data available' }));
      return;
    }

    setState({ loading: true, analysis: null, error: null, generatedAt: null });

    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportData,
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

  // Parse markdown-like formatting for display
  const formatAnalysis = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('## ')) {
        return <h3 key={i} style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '16px', marginBottom: '8px', color: '#1e40af' }}>{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('### ')) {
        return <h4 key={i} style={{ fontSize: '1em', fontWeight: 600, marginTop: '12px', marginBottom: '6px', color: '#374151' }}>{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} style={{ fontWeight: 600, marginTop: '12px', marginBottom: '4px' }}>{line.replace(/\*\*/g, '')}</p>;
      }
      // Bold within text
      if (line.includes('**')) {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} style={{ margin: '4px 0', lineHeight: 1.6 }}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.replace(/\*\*/g, '')}</strong>
                : part
            )}
          </p>
        );
      }
      // List items
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return <li key={i} style={{ marginLeft: '20px', marginBottom: '4px', lineHeight: 1.5 }}>{line.replace(/^[-•]\s/, '')}</li>;
      }
      // Numbered items
      if (/^\d+\.\s/.test(line)) {
        return <li key={i} style={{ marginLeft: '20px', marginBottom: '4px', lineHeight: 1.5, listStyleType: 'decimal' }}>{line.replace(/^\d+\.\s/, '')}</li>;
      }
      // Empty lines
      if (line.trim() === '') {
        return <br key={i} />;
      }
      // Regular paragraphs
      return <p key={i} style={{ margin: '4px 0', lineHeight: 1.6 }}>{line}</p>;
    });
  };

  return (
    <section className="ai-analysis-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2em' }}>🤖</span>
          AI Analysis & Recommendations
        </h2>
        <button
          onClick={generateAnalysis}
          disabled={state.loading || !reportData}
          style={{
            padding: '8px 16px',
            backgroundColor: state.loading ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: state.loading ? 'not-allowed' : 'pointer',
            fontSize: '0.9em',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {state.loading ? (
            <>
              <span className="spinner" style={{
                width: '14px',
                height: '14px',
                border: '2px solid #ffffff40',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              Analyzing...
            </>
          ) : (
            <>Generate Analysis</>
          )}
        </button>
      </div>

      {state.error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#dc2626',
          marginBottom: '16px',
        }}>
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {!state.analysis && !state.loading && !state.error && (
        <div style={{
          padding: '24px',
          backgroundColor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#64748b',
        }}>
          <p style={{ marginBottom: '8px' }}>Click "Generate Analysis" to get AI-powered insights on:</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li>• Root cause analysis for bookings misses</li>
            <li>• Specific recommended actions by segment</li>
            <li>• Risk assessment for Q1 target attainment</li>
            <li>• Pipeline and funnel health insights</li>
          </ul>
        </div>
      )}

      {state.loading && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#64748b',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e2e8f0',
            borderTop: '3px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p>Analyzing performance data with AI...</p>
          <p style={{ fontSize: '0.85em', color: '#94a3b8' }}>This may take 10-20 seconds</p>
        </div>
      )}

      {state.analysis && (
        <div style={{
          padding: '20px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          maxHeight: '600px',
          overflowY: 'auto',
        }}>
          {state.generatedAt && (
            <div style={{
              fontSize: '0.8em',
              color: '#94a3b8',
              marginBottom: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #f1f5f9',
            }}>
              Generated: {new Date(state.generatedAt).toLocaleString()}
            </div>
          )}
          <div className="analysis-content">
            {formatAnalysis(state.analysis)}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          display: inline-block;
        }
        .analysis-content ul, .analysis-content ol {
          margin: 8px 0;
          padding-left: 0;
        }
      `}</style>
    </section>
  );
}
