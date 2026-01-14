'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrendChartData, TimeSeriesDataPoint } from '@/lib/types';

interface TrendChartProps {
  data: TrendChartData;
  valueFormat?: 'currency' | 'number' | 'percent';
  height?: number;
}

type ChartType = 'line' | 'area';

interface CombinedDataPoint {
  date: string;
  current: number | null;
  previous: number | null;
}

function formatValue(value: number, format: 'currency' | 'number' | 'percent'): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
}

function combineChartData(data: TrendChartData): CombinedDataPoint[] {
  const combined: Map<string, CombinedDataPoint> = new Map();

  // Process current period data
  data.currentPeriod.forEach((point) => {
    combined.set(point.date, {
      date: point.date,
      current: point.value,
      previous: null,
    });
  });

  // Process previous period data - align by day index
  data.previousPeriod.forEach((point, index) => {
    const currentDate = data.currentPeriod[index]?.date;
    if (currentDate && combined.has(currentDate)) {
      const existing = combined.get(currentDate)!;
      existing.previous = point.value;
    }
  });

  return Array.from(combined.values()).sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TrendChart({
  data,
  valueFormat = 'number',
  height = 300,
}: TrendChartProps) {
  const [chartType, setChartType] = useState<ChartType>('line');
  const combinedData = combineChartData(data);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-date">{formatDateShort(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="tooltip-value">
              {entry.name}: {formatValue(entry.value || 0, valueFormat)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data: combinedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    if (chartType === 'area') {
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            stroke="#64748b"
            fontSize={12}
          />
          <YAxis
            tickFormatter={(value) => formatValue(value, valueFormat)}
            stroke="#64748b"
            fontSize={12}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Area
            type="monotone"
            dataKey="current"
            name="Current Period"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="previous"
            name="Previous Period"
            stroke="#94a3b8"
            fill="#94a3b8"
            fillOpacity={0.1}
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </AreaChart>
      );
    }

    return (
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          stroke="#64748b"
          fontSize={12}
        />
        <YAxis
          tickFormatter={(value) => formatValue(value, valueFormat)}
          stroke="#64748b"
          fontSize={12}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line
          type="monotone"
          dataKey="current"
          name="Current Period"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="previous"
          name="Previous Period"
          stroke="#94a3b8"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: '#94a3b8', strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    );
  };

  return (
    <div className="trend-chart" data-testid="trend-chart">
      <div className="chart-header">
        <h4 className="chart-title">{data.metricName}</h4>
        <div className="chart-type-toggle">
          <button
            className={`toggle-btn ${chartType === 'line' ? 'active' : ''}`}
            onClick={() => setChartType('line')}
            data-testid="chart-type-line"
          >
            Line
          </button>
          <button
            className={`toggle-btn ${chartType === 'area' ? 'active' : ''}`}
            onClick={() => setChartType('area')}
            data-testid="chart-type-area"
          >
            Area
          </button>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      <style jsx>{`
        .trend-chart {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .chart-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .chart-type-toggle {
          display: flex;
          gap: 4px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 6px;
        }

        .toggle-btn {
          padding: 6px 12px;
          border: none;
          background: transparent;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .toggle-btn:hover {
          color: #3b82f6;
        }

        .toggle-btn.active {
          background: white;
          color: #3b82f6;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .chart-container {
          width: 100%;
        }

        :global(.chart-tooltip) {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 14px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        :global(.tooltip-date) {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }

        :global(.tooltip-value) {
          margin: 4px 0;
          font-size: 13px;
          font-weight: 500;
        }

        @media (max-width: 600px) {
          .chart-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
