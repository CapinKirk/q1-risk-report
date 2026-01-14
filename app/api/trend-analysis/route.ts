import { NextResponse } from 'next/server';
import type {
  TrendAnalysisData,
  MetricComparison,
  RevenueTrendRow,
  FunnelTrendRow,
  TrendChartData,
  TimeSeriesDataPoint,
  Product,
  Region,
  Category,
} from '@/lib/types';

// Generate mock trend data based on date range
// This simulates what BigQuery would return
// For production, replace with actual BigQuery client

function calculateTrend(current: number, previous: number): 'UP' | 'DOWN' | 'FLAT' {
  const pctChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  if (pctChange > 1) return 'UP';
  if (pctChange < -1) return 'DOWN';
  return 'FLAT';
}

function createMetricComparison(current: number, previous: number): MetricComparison<number> {
  const delta = current - previous;
  const deltaPercent = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return {
    current,
    previous,
    delta,
    deltaPercent: Math.round(deltaPercent * 10) / 10,
    trend: calculateTrend(current, previous),
  };
}

function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function generateDailyTimeSeries(
  startDate: string,
  days: number,
  baseValue: number,
  variance: number,
  periodType: 'current' | 'previous'
): TimeSeriesDataPoint[] {
  const points: TimeSeriesDataPoint[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const randomFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
    const value = Math.round(baseValue * randomFactor * variance);
    points.push({
      date: date.toISOString().split('T')[0],
      value,
      periodType,
    });
  }

  return points;
}

function generateTrendData(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
  products: Product[],
  regions: Region[]
): TrendAnalysisData {
  const days = getDaysBetween(startDate, endDate);

  // Base metrics scaled by number of days
  const dailyAcvBase = 25000;
  const dailyMqlBase = 15;
  const dailySqlBase = 8;
  const dailySalBase = 5;
  const dailySqoBase = 3;

  // Generate revenue summary with realistic variance
  const currentTotalAcv = Math.round(dailyAcvBase * days * (0.85 + Math.random() * 0.3));
  const previousTotalAcv = Math.round(dailyAcvBase * days * (0.85 + Math.random() * 0.3));
  const currentDeals = Math.round(days * 2.5 * (0.8 + Math.random() * 0.4));
  const previousDeals = Math.round(days * 2.5 * (0.8 + Math.random() * 0.4));
  const currentPipeline = Math.round(currentTotalAcv * 3.5);

  // Generate funnel summary
  const currentMql = Math.round(dailyMqlBase * days * (0.9 + Math.random() * 0.2));
  const previousMql = Math.round(dailyMqlBase * days * (0.9 + Math.random() * 0.2));
  const currentSql = Math.round(dailySqlBase * days * (0.9 + Math.random() * 0.2));
  const previousSql = Math.round(dailySqlBase * days * (0.9 + Math.random() * 0.2));
  const currentSal = Math.round(dailySalBase * days * (0.9 + Math.random() * 0.2));
  const previousSal = Math.round(dailySalBase * days * (0.9 + Math.random() * 0.2));
  const currentSqo = Math.round(dailySqoBase * days * (0.9 + Math.random() * 0.2));
  const previousSqo = Math.round(dailySqoBase * days * (0.9 + Math.random() * 0.2));

  // Generate revenue by dimension
  const categories: Category[] = ['NEW LOGO', 'EXPANSION', 'MIGRATION'];
  const revenueByDimension: RevenueTrendRow[] = [];

  for (const product of products) {
    for (const region of regions) {
      for (const category of categories) {
        const productMult = product === 'POR' ? 0.7 : 0.3;
        const regionMult = region === 'AMER' ? 0.6 : region === 'EMEA' ? 0.25 : 0.15;
        const categoryMult = category === 'NEW LOGO' ? 0.5 : category === 'EXPANSION' ? 0.35 : 0.15;

        const baseAcv = currentTotalAcv * productMult * regionMult * categoryMult;
        const currentAcv = Math.round(baseAcv * (0.8 + Math.random() * 0.4));
        const prevAcv = Math.round(baseAcv * (0.8 + Math.random() * 0.4));
        const currentDealCount = Math.max(1, Math.round(currentDeals * productMult * regionMult * categoryMult));
        const prevDealCount = Math.max(1, Math.round(previousDeals * productMult * regionMult * categoryMult));
        const currentWinRate = 60 + Math.random() * 35;
        const prevWinRate = 60 + Math.random() * 35;

        revenueByDimension.push({
          product,
          region,
          category,
          acv: createMetricComparison(currentAcv, prevAcv),
          deals: createMetricComparison(currentDealCount, prevDealCount),
          winRate: createMetricComparison(
            Math.round(currentWinRate * 10) / 10,
            Math.round(prevWinRate * 10) / 10
          ),
        });
      }
    }
  }

  // Generate funnel by dimension
  const funnelByDimension: FunnelTrendRow[] = [];

  for (const product of products) {
    for (const region of regions) {
      const productMult = product === 'POR' ? 0.7 : 0.3;
      const regionMult = region === 'AMER' ? 0.6 : region === 'EMEA' ? 0.25 : 0.15;

      funnelByDimension.push({
        product,
        region,
        mql: createMetricComparison(
          Math.round(currentMql * productMult * regionMult),
          Math.round(previousMql * productMult * regionMult)
        ),
        sql: createMetricComparison(
          Math.round(currentSql * productMult * regionMult),
          Math.round(previousSql * productMult * regionMult)
        ),
        sal: createMetricComparison(
          Math.round(currentSal * productMult * regionMult),
          Math.round(previousSal * productMult * regionMult)
        ),
        sqo: createMetricComparison(
          Math.round(currentSqo * productMult * regionMult),
          Math.round(previousSqo * productMult * regionMult)
        ),
      });
    }
  }

  // Generate time series for charts
  const acvTimeSeries: TrendChartData = {
    metricName: 'ACV Won',
    currentPeriod: generateDailyTimeSeries(startDate, days, dailyAcvBase, 1, 'current'),
    previousPeriod: generateDailyTimeSeries(prevStartDate, days, dailyAcvBase, 0.95, 'previous'),
  };

  const mqlTimeSeries: TrendChartData = {
    metricName: 'MQL',
    currentPeriod: generateDailyTimeSeries(startDate, days, dailyMqlBase, 1, 'current'),
    previousPeriod: generateDailyTimeSeries(prevStartDate, days, dailyMqlBase, 0.9, 'previous'),
  };

  const sqlTimeSeries: TrendChartData = {
    metricName: 'SQL',
    currentPeriod: generateDailyTimeSeries(startDate, days, dailySqlBase, 1, 'current'),
    previousPeriod: generateDailyTimeSeries(prevStartDate, days, dailySqlBase, 0.85, 'previous'),
  };

  return {
    generatedAt: new Date().toISOString(),
    periodInfo: {
      current: { startDate, endDate },
      previous: { startDate: prevStartDate, endDate: prevEndDate },
      daysInPeriod: days,
    },
    filters: {
      products,
      regions,
    },
    revenueSummary: {
      totalACV: createMetricComparison(currentTotalAcv, previousTotalAcv),
      wonDeals: createMetricComparison(currentDeals, previousDeals),
      pipelineACV: createMetricComparison(currentPipeline, Math.round(currentPipeline * 0.9)),
      avgDealSize: createMetricComparison(
        Math.round(currentTotalAcv / currentDeals),
        Math.round(previousTotalAcv / previousDeals)
      ),
    },
    funnelSummary: {
      totalMQL: createMetricComparison(currentMql, previousMql),
      totalSQL: createMetricComparison(currentSql, previousSql),
      totalSAL: createMetricComparison(currentSal, previousSal),
      totalSQO: createMetricComparison(currentSqo, previousSqo),
    },
    revenueByDimension,
    funnelByDimension,
    charts: {
      acvTimeSeries,
      mqlTimeSeries,
      sqlTimeSeries,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startDate, endDate, products, regions } = body;

    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'Dates must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Calculate previous period
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - daysDiff + 1);

    const prevStartDate = prevStart.toISOString().split('T')[0];
    const prevEndDate = prevEnd.toISOString().split('T')[0];

    // Parse filters
    const productList: Product[] = (products && products.length > 0)
      ? products
      : ['POR', 'R360'];
    const regionList: Region[] = (regions && regions.length > 0)
      ? regions
      : ['AMER', 'EMEA', 'APAC'];

    // Generate trend data
    const data = generateTrendData(
      startDate,
      endDate,
      prevStartDate,
      prevEndDate,
      productList,
      regionList
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Trend analysis error:', error);
    return NextResponse.json(
      {
        error: 'Failed to run trend analysis',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/trend-analysis',
    method: 'POST',
    description: 'Runs trend analysis comparing two date periods',
    note: 'Currently using mock data generator. For production BigQuery integration, configure GOOGLE_APPLICATION_CREDENTIALS.',
    parameters: {
      startDate: 'YYYY-MM-DD (required)',
      endDate: 'YYYY-MM-DD (required)',
      products: 'Array of products ["POR", "R360"] (optional)',
      regions: 'Array of regions ["AMER", "EMEA", "APAC"] (optional)',
    },
    example: {
      startDate: '2026-01-08',
      endDate: '2026-01-14',
      products: ['POR'],
      regions: ['AMER', 'EMEA'],
    },
  });
}
