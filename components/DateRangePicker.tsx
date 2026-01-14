'use client';

import { useState, useMemo } from 'react';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangePickerProps {
  onAnalyze: (range: DateRange) => void;
  isLoading: boolean;
  disabled?: boolean;
}

type PresetKey = 'last7' | 'last14' | 'last30' | 'mtd' | 'qtd' | 'custom';

interface Preset {
  label: string;
  getRange: () => DateRange;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getPresets(): Record<PresetKey, Preset> {
  const today = new Date();

  return {
    last7: {
      label: 'Last 7 Days',
      getRange: () => {
        const end = new Date(today);
        const start = new Date(today);
        start.setDate(start.getDate() - 6);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      },
    },
    last14: {
      label: 'Last 14 Days',
      getRange: () => {
        const end = new Date(today);
        const start = new Date(today);
        start.setDate(start.getDate() - 13);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      },
    },
    last30: {
      label: 'Last 30 Days',
      getRange: () => {
        const end = new Date(today);
        const start = new Date(today);
        start.setDate(start.getDate() - 29);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      },
    },
    mtd: {
      label: 'MTD',
      getRange: () => {
        const end = new Date(today);
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      },
    },
    qtd: {
      label: 'QTD',
      getRange: () => {
        const end = new Date(today);
        const quarter = Math.floor(today.getMonth() / 3);
        const start = new Date(today.getFullYear(), quarter * 3, 1);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      },
    },
    custom: {
      label: 'Custom',
      getRange: () => {
        const end = new Date(today);
        const start = new Date(today);
        start.setDate(start.getDate() - 6);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      },
    },
  };
}

function calculatePreviousPeriod(start: string, end: string): DateRange {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff + 1);

  return {
    startDate: formatDate(prevStart),
    endDate: formatDate(prevEnd),
  };
}

export default function DateRangePicker({ onAnalyze, isLoading, disabled }: DateRangePickerProps) {
  const presets = useMemo(() => getPresets(), []);
  const [activePreset, setActivePreset] = useState<PresetKey>('last7');
  const [startDate, setStartDate] = useState(presets.last7.getRange().startDate);
  const [endDate, setEndDate] = useState(presets.last7.getRange().endDate);
  const [error, setError] = useState<string | null>(null);

  const previousPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    return calculatePreviousPeriod(startDate, endDate);
  }, [startDate, endDate]);

  const daysInPeriod = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const handlePresetClick = (key: PresetKey) => {
    setActivePreset(key);
    setError(null);
    if (key !== 'custom') {
      const range = presets[key].getRange();
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setActivePreset('custom');
    setError(null);
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
  };

  const handleAnalyze = () => {
    // Validation
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();

    if (start > end) {
      setError('Start date must be before end date');
      return;
    }

    if (end > today) {
      setError('End date cannot be in the future');
      return;
    }

    if (daysInPeriod > 365) {
      setError('Date range cannot exceed 365 days');
      return;
    }

    setError(null);
    onAnalyze({ startDate, endDate });
  };

  return (
    <div className="date-range-picker" data-testid="date-range-picker">
      <div className="preset-buttons">
        {(Object.keys(presets) as PresetKey[]).map((key) => (
          <button
            key={key}
            className={`preset-btn ${activePreset === key ? 'active' : ''}`}
            onClick={() => handlePresetClick(key)}
            disabled={disabled || isLoading}
            data-testid={`preset-${key}`}
          >
            {presets[key].label}
          </button>
        ))}
      </div>

      <div className="date-inputs">
        <div className="date-input-group">
          <label htmlFor="start-date">Start Date</label>
          <input
            type="date"
            id="start-date"
            value={startDate}
            onChange={(e) => handleDateChange('start', e.target.value)}
            disabled={disabled || isLoading}
            data-testid="start-date-input"
          />
        </div>
        <div className="date-input-group">
          <label htmlFor="end-date">End Date</label>
          <input
            type="date"
            id="end-date"
            value={endDate}
            onChange={(e) => handleDateChange('end', e.target.value)}
            disabled={disabled || isLoading}
            data-testid="end-date-input"
          />
        </div>
        <button
          className="analyze-btn"
          onClick={handleAnalyze}
          disabled={disabled || isLoading || !startDate || !endDate}
          data-testid="analyze-btn"
        >
          {isLoading ? (
            <>
              <span className="spinner">↻</span>
              Analyzing...
            </>
          ) : (
            'Analyze'
          )}
        </button>
      </div>

      {error && (
        <div className="date-error" data-testid="date-error">
          {error}
        </div>
      )}

      {previousPeriod && !error && (
        <div className="period-preview" data-testid="period-preview">
          <div className="period-info">
            <span className="period-label">Current Period:</span>
            <span className="period-dates">{startDate} to {endDate} ({daysInPeriod} days)</span>
          </div>
          <div className="period-info">
            <span className="period-label">Previous Period:</span>
            <span className="period-dates">{previousPeriod.startDate} to {previousPeriod.endDate} ({daysInPeriod} days)</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .date-range-picker {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .preset-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .preset-btn {
          padding: 8px 16px;
          border: 1px solid #cbd5e1;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          transition: all 0.15s ease;
        }

        .preset-btn:hover:not(:disabled) {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .preset-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .preset-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .date-inputs {
          display: flex;
          gap: 16px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .date-input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .date-input-group label {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .date-input-group input {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 14px;
          min-width: 150px;
        }

        .date-input-group input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .date-input-group input:disabled {
          background: #f1f5f9;
          cursor: not-allowed;
        }

        .analyze-btn {
          padding: 10px 24px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.15s ease;
        }

        .analyze-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .analyze-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .date-error {
          margin-top: 12px;
          padding: 10px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 13px;
        }

        .period-preview {
          margin-top: 16px;
          padding: 12px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }

        .period-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .period-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .period-dates {
          font-size: 14px;
          color: #1e293b;
          font-family: monospace;
        }

        @media (max-width: 600px) {
          .date-inputs {
            flex-direction: column;
            align-items: stretch;
          }

          .date-input-group input {
            width: 100%;
          }

          .analyze-btn {
            width: 100%;
            justify-content: center;
          }

          .period-preview {
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
