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
  Source,
  RAGStatus,
  AttainmentTrendRow,
  SourceAttainmentTrendRow,
  FunnelHealthTrendRow,
  FunnelByCategoryTrendRow,
  FunnelBySourceTrendRow,
  PipelineRCATrendRow,
  LossReasonTrendRow,
  GoogleAdsTrendRow,
  GoogleAdsRCATrendRow,
  ExecutiveCountsTrend,
  WinBrightSpotTrend,
  MomentumIndicatorTrend,
  TopRiskPocketTrend,
  FunnelRCAInsightTrend,
  FunnelTrendWoWRow,
  ActionItemTrend,
  DealDetailTrend,
} from '@/lib/types';

// Helper functions
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
    const randomFactor = 0.7 + Math.random() * 0.6;
    const value = Math.round(baseValue * randomFactor * variance);
    points.push({
      date: date.toISOString().split('T')[0],
      value,
      periodType,
    });
  }

  return points;
}

function randomRAG(): RAGStatus {
  const rand = Math.random();
  if (rand < 0.33) return 'GREEN';
  if (rand < 0.66) return 'YELLOW';
  return 'RED';
}

function randomVariance(base: number, range: number = 0.3): number {
  return Math.round(base * (1 - range + Math.random() * range * 2));
}

// Generate comprehensive trend data
function generateTrendData(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
  products: Product[],
  regions: Region[]
): TrendAnalysisData {
  const days = getDaysBetween(startDate, endDate);
  const categories: Category[] = ['NEW LOGO', 'EXPANSION', 'MIGRATION'];
  const sources: Source[] = ['INBOUND', 'OUTBOUND', 'AE SOURCED', 'AM SOURCED', 'TRADESHOW'];

  // Period info for pacing calculations
  const quarterStart = new Date(startDate);
  quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
  const quarterEnd = new Date(quarterStart);
  quarterEnd.setMonth(quarterEnd.getMonth() + 3, 0);
  const totalQuarterDays = Math.ceil((quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysElapsed = Math.ceil((new Date(endDate).getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const quarterPctComplete = Math.round((daysElapsed / totalQuarterDays) * 1000) / 10;

  const periodInfo = {
    quarterStart: quarterStart.toISOString().split('T')[0],
    asOfDate: endDate,
    daysElapsed,
    daysRemaining: totalQuarterDays - daysElapsed,
    totalDays: totalQuarterDays,
    quarterPctComplete,
  };

  // Quarterly targets
  const quarterlyTargets = {
    POR_Q1_target: 2659310,
    R360_Q1_target: 868569,
    combined_Q1_target: 3527879,
  };

  // Base daily metrics
  const dailyAcvBase = 25000;
  const dailyMqlBase = 15;
  const dailySqlBase = 8;
  const dailySalBase = 5;
  const dailySqoBase = 3;

  // Calculate summary metrics
  const currentTotalAcv = randomVariance(dailyAcvBase * days, 0.15);
  const previousTotalAcv = randomVariance(dailyAcvBase * days, 0.15);
  const currentDeals = Math.max(1, randomVariance(days * 2.5, 0.2));
  const previousDeals = Math.max(1, randomVariance(days * 2.5, 0.2));
  const currentPipeline = randomVariance(currentTotalAcv * 3.5, 0.1);
  const previousPipeline = randomVariance(previousTotalAcv * 3.5, 0.1);
  const currentLostDeals = randomVariance(days * 0.8, 0.3);
  const previousLostDeals = randomVariance(days * 0.8, 0.3);
  const currentLostAcv = randomVariance(dailyAcvBase * days * 0.3, 0.2);
  const previousLostAcv = randomVariance(dailyAcvBase * days * 0.3, 0.2);

  const currentMql = randomVariance(dailyMqlBase * days, 0.1);
  const previousMql = randomVariance(dailyMqlBase * days, 0.1);
  const currentSql = randomVariance(dailySqlBase * days, 0.1);
  const previousSql = randomVariance(dailySqlBase * days, 0.1);
  const currentSal = randomVariance(dailySalBase * days, 0.1);
  const previousSal = randomVariance(dailySalBase * days, 0.1);
  const currentSqo = randomVariance(dailySqoBase * days, 0.1);
  const previousSqo = randomVariance(dailySqoBase * days, 0.1);

  // Executive counts
  const executiveCounts: ExecutiveCountsTrend = {
    areasExceedingTarget: createMetricComparison(
      Math.floor(Math.random() * 5) + 1,
      Math.floor(Math.random() * 5) + 1
    ),
    areasAtRisk: createMetricComparison(
      Math.floor(Math.random() * 8) + 2,
      Math.floor(Math.random() * 8) + 2
    ),
    areasNeedingAttention: createMetricComparison(
      Math.floor(Math.random() * 4),
      Math.floor(Math.random() * 4)
    ),
    areasWithMomentum: createMetricComparison(
      Math.floor(Math.random() * 5) + 1,
      Math.floor(Math.random() * 5) + 1
    ),
  };

  // Revenue by dimension
  const revenueByDimension: RevenueTrendRow[] = [];
  for (const product of products) {
    for (const region of regions) {
      for (const category of categories) {
        const productMult = product === 'POR' ? 0.7 : 0.3;
        const regionMult = region === 'AMER' ? 0.6 : region === 'EMEA' ? 0.25 : 0.15;
        const categoryMult = category === 'NEW LOGO' ? 0.5 : category === 'EXPANSION' ? 0.35 : 0.15;

        const baseAcv = currentTotalAcv * productMult * regionMult * categoryMult;
        const currentAcv = randomVariance(baseAcv, 0.2);
        const prevAcv = randomVariance(baseAcv, 0.2);
        const currentDealCount = Math.max(1, randomVariance(currentDeals * productMult * regionMult * categoryMult, 0.2));
        const prevDealCount = Math.max(1, randomVariance(previousDeals * productMult * regionMult * categoryMult, 0.2));

        revenueByDimension.push({
          product,
          region,
          category,
          acv: createMetricComparison(currentAcv, prevAcv),
          deals: createMetricComparison(currentDealCount, prevDealCount),
          winRate: createMetricComparison(
            Math.round((60 + Math.random() * 35) * 10) / 10,
            Math.round((60 + Math.random() * 35) * 10) / 10
          ),
        });
      }
    }
  }

  // Funnel by dimension
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

  // Attainment detail
  const attainmentDetail: AttainmentTrendRow[] = [];
  for (const product of products) {
    for (const region of regions) {
      for (const category of categories) {
        const productMult = product === 'POR' ? 0.7 : 0.3;
        const regionMult = region === 'AMER' ? 0.6 : region === 'EMEA' ? 0.25 : 0.15;
        const categoryMult = category === 'NEW LOGO' ? 0.5 : category === 'EXPANSION' ? 0.35 : 0.15;
        const base = currentTotalAcv * productMult * regionMult * categoryMult;

        attainmentDetail.push({
          product,
          region,
          category,
          qtdTarget: createMetricComparison(randomVariance(base * 1.2, 0.1), randomVariance(base * 1.2, 0.1)),
          qtdAcv: createMetricComparison(randomVariance(base, 0.15), randomVariance(base, 0.15)),
          qtdAttainmentPct: createMetricComparison(randomVariance(85, 0.2), randomVariance(85, 0.2)),
          qtdGap: createMetricComparison(randomVariance(-base * 0.1, 0.3), randomVariance(-base * 0.1, 0.3)),
          qtdDeals: createMetricComparison(Math.max(1, randomVariance(10, 0.3)), Math.max(1, randomVariance(10, 0.3))),
          winRatePct: createMetricComparison(randomVariance(75, 0.15), randomVariance(75, 0.15)),
          pipelineAcv: createMetricComparison(randomVariance(base * 3, 0.2), randomVariance(base * 3, 0.2)),
          pipelineCoverageX: createMetricComparison(randomVariance(2.5, 0.25), randomVariance(2.5, 0.25)),
          qtdLostDeals: createMetricComparison(Math.floor(Math.random() * 5), Math.floor(Math.random() * 5)),
          qtdLostAcv: createMetricComparison(randomVariance(base * 0.2, 0.3), randomVariance(base * 0.2, 0.3)),
          ragStatus: { current: randomRAG(), previous: randomRAG() },
        });
      }
    }
  }

  // Source attainment
  const sourceAttainment: SourceAttainmentTrendRow[] = [];
  for (const product of products) {
    for (const region of regions) {
      for (const source of sources) {
        const productMult = product === 'POR' ? 0.7 : 0.3;
        const regionMult = region === 'AMER' ? 0.6 : region === 'EMEA' ? 0.25 : 0.15;
        const sourceMult = source === 'INBOUND' ? 0.4 : source === 'AM SOURCED' ? 0.3 : 0.1;
        const base = currentTotalAcv * productMult * regionMult * sourceMult;

        sourceAttainment.push({
          product,
          region,
          source,
          qtdTarget: createMetricComparison(randomVariance(base * 1.1, 0.1), randomVariance(base * 1.1, 0.1)),
          qtdAcv: createMetricComparison(randomVariance(base, 0.2), randomVariance(base, 0.2)),
          qtdDeals: createMetricComparison(Math.max(1, randomVariance(5, 0.3)), Math.max(1, randomVariance(5, 0.3))),
          attainmentPct: createMetricComparison(randomVariance(90, 0.2), randomVariance(90, 0.2)),
          gap: createMetricComparison(randomVariance(-base * 0.1, 0.5), randomVariance(-base * 0.1, 0.5)),
          ragStatus: { current: randomRAG(), previous: randomRAG() },
        });
      }
    }
  }

  // Funnel health
  const funnelHealth: FunnelHealthTrendRow[] = [];
  const bottlenecks = ['MQL', 'SQL', 'SAL', 'SQO'];
  for (const product of products) {
    for (const region of regions) {
      funnelHealth.push({
        product,
        region,
        actualMql: createMetricComparison(randomVariance(50, 0.2), randomVariance(50, 0.2)),
        actualSql: createMetricComparison(randomVariance(30, 0.2), randomVariance(30, 0.2)),
        actualSal: createMetricComparison(randomVariance(20, 0.2), randomVariance(20, 0.2)),
        actualSqo: createMetricComparison(randomVariance(10, 0.2), randomVariance(10, 0.2)),
        mqlPacingPct: createMetricComparison(randomVariance(100, 0.2), randomVariance(100, 0.2)),
        sqlPacingPct: createMetricComparison(randomVariance(100, 0.2), randomVariance(100, 0.2)),
        salPacingPct: createMetricComparison(randomVariance(100, 0.2), randomVariance(100, 0.2)),
        sqoPacingPct: createMetricComparison(randomVariance(100, 0.2), randomVariance(100, 0.2)),
        mqlToSqlRate: createMetricComparison(randomVariance(60, 0.15), randomVariance(60, 0.15)),
        sqlToSalRate: createMetricComparison(randomVariance(65, 0.15), randomVariance(65, 0.15)),
        salToSqoRate: createMetricComparison(randomVariance(50, 0.15), randomVariance(50, 0.15)),
        primaryBottleneck: {
          current: bottlenecks[Math.floor(Math.random() * bottlenecks.length)],
          previous: bottlenecks[Math.floor(Math.random() * bottlenecks.length)],
        },
      });
    }
  }

  // Funnel by category
  const funnelByCategory: FunnelByCategoryTrendRow[] = [];
  for (const product of products) {
    for (const region of regions) {
      for (const category of categories) {
        funnelByCategory.push({
          product,
          region,
          category,
          actualMql: createMetricComparison(randomVariance(25, 0.3), randomVariance(25, 0.3)),
          actualSql: createMetricComparison(randomVariance(15, 0.3), randomVariance(15, 0.3)),
          actualSal: createMetricComparison(randomVariance(10, 0.3), randomVariance(10, 0.3)),
          actualSqo: createMetricComparison(randomVariance(5, 0.3), randomVariance(5, 0.3)),
          mqlPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
          sqlPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
          salPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
          sqoPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
          weightedTofScore: createMetricComparison(randomVariance(100, 0.3), randomVariance(100, 0.3)),
        });
      }
    }
  }

  // Funnel by source
  const funnelBySource: FunnelBySourceTrendRow[] = [];
  for (const product of products) {
    for (const region of regions) {
      for (const category of categories) {
        for (const source of sources.slice(0, 2)) { // Just INBOUND and OUTBOUND for brevity
          funnelBySource.push({
            product,
            region,
            category,
            source,
            actualMql: createMetricComparison(randomVariance(15, 0.3), randomVariance(15, 0.3)),
            actualSql: createMetricComparison(randomVariance(8, 0.3), randomVariance(8, 0.3)),
            actualSal: createMetricComparison(randomVariance(5, 0.3), randomVariance(5, 0.3)),
            actualSqo: createMetricComparison(randomVariance(3, 0.3), randomVariance(3, 0.3)),
            mqlPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
            sqlPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
            salPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
            sqoPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
            weightedTofScore: createMetricComparison(randomVariance(100, 0.3), randomVariance(100, 0.3)),
          });
        }
      }
    }
  }

  // Funnel trends (WoW)
  const funnelTrends: FunnelTrendWoWRow[] = [];
  const trendOptions = ['UP', 'DOWN', 'FLAT'];
  for (const product of products) {
    for (const region of regions) {
      funnelTrends.push({
        product,
        region,
        mqlCurrent7d: createMetricComparison(randomVariance(30, 0.2), randomVariance(30, 0.2)),
        sqlCurrent7d: createMetricComparison(randomVariance(18, 0.2), randomVariance(18, 0.2)),
        salCurrent7d: createMetricComparison(randomVariance(12, 0.2), randomVariance(12, 0.2)),
        sqoCurrent7d: createMetricComparison(randomVariance(6, 0.2), randomVariance(6, 0.2)),
        mqlWowPct: createMetricComparison(randomVariance(0, 1.5) - 50, randomVariance(0, 1.5) - 50),
        sqlWowPct: createMetricComparison(randomVariance(0, 1.5) - 50, randomVariance(0, 1.5) - 50),
        salWowPct: createMetricComparison(randomVariance(0, 1.5) - 50, randomVariance(0, 1.5) - 50),
        sqoWowPct: createMetricComparison(randomVariance(0, 1.5) - 50, randomVariance(0, 1.5) - 50),
        mqlTrend: { current: trendOptions[Math.floor(Math.random() * 3)], previous: trendOptions[Math.floor(Math.random() * 3)] },
        sqlTrend: { current: trendOptions[Math.floor(Math.random() * 3)], previous: trendOptions[Math.floor(Math.random() * 3)] },
        salTrend: { current: trendOptions[Math.floor(Math.random() * 3)], previous: trendOptions[Math.floor(Math.random() * 3)] },
        sqoTrend: { current: trendOptions[Math.floor(Math.random() * 3)], previous: trendOptions[Math.floor(Math.random() * 3)] },
      });
    }
  }

  // Pipeline RCA
  const pipelineRCA: PipelineRCATrendRow[] = [];
  const pipelineHealthOptions = ['HEALTHY', 'ADEQUATE', 'AT_RISK', 'CRITICAL'];
  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  for (const product of products) {
    for (const region of regions) {
      for (const category of categories) {
        const healthIdx = Math.floor(Math.random() * 4);
        pipelineRCA.push({
          product,
          region,
          category,
          pipelineAcv: createMetricComparison(randomVariance(500000, 0.3), randomVariance(500000, 0.3)),
          pipelineCoverageX: createMetricComparison(randomVariance(2.5, 0.3), randomVariance(2.5, 0.3)),
          pipelineOpps: createMetricComparison(randomVariance(25, 0.3), randomVariance(25, 0.3)),
          pipelineAvgAgeDays: createMetricComparison(randomVariance(90, 0.25), randomVariance(90, 0.25)),
          pipelineHealth: { current: pipelineHealthOptions[healthIdx], previous: pipelineHealthOptions[Math.floor(Math.random() * 4)] },
          severity: { current: severities[healthIdx], previous: severities[Math.floor(Math.random() * 4)] },
          rcaCommentary: {
            current: `${region} ${category} pipeline requires attention - ${pipelineHealthOptions[healthIdx].toLowerCase()} status.`,
            previous: 'Pipeline was in previous state.',
          },
          recommendedAction: {
            current: 'Review pipeline health and take corrective action.',
            previous: 'Previous recommended action.',
          },
        });
      }
    }
  }

  // Loss reason RCA
  const lossReasonRCA: LossReasonTrendRow[] = [];
  const lossReasons = ['Pricing was too high', 'Not Ready to Buy', 'Timing', 'Competitor', 'Not Interested'];
  for (const product of products) {
    for (const region of regions) {
      for (const reason of lossReasons.slice(0, 3)) {
        lossReasonRCA.push({
          product,
          region,
          lossReason: reason,
          dealCount: createMetricComparison(Math.floor(Math.random() * 8) + 1, Math.floor(Math.random() * 8) + 1),
          lostAcv: createMetricComparison(randomVariance(50000, 0.4), randomVariance(50000, 0.4)),
          pctOfRegionalLoss: createMetricComparison(randomVariance(30, 0.5), randomVariance(30, 0.5)),
          severity: { current: severities[Math.floor(Math.random() * 4)], previous: severities[Math.floor(Math.random() * 4)] },
        });
      }
    }
  }

  // Google Ads
  const googleAds: GoogleAdsTrendRow[] = [];
  for (const product of products) {
    for (const region of regions) {
      googleAds.push({
        product,
        region,
        impressions: createMetricComparison(randomVariance(5000, 0.2), randomVariance(5000, 0.2)),
        clicks: createMetricComparison(randomVariance(400, 0.2), randomVariance(400, 0.2)),
        adSpendUsd: createMetricComparison(randomVariance(5000, 0.15), randomVariance(5000, 0.15)),
        conversions: createMetricComparison(randomVariance(30, 0.25), randomVariance(30, 0.25)),
        ctrPct: createMetricComparison(randomVariance(10, 0.2), randomVariance(10, 0.2)),
        cpcUsd: createMetricComparison(randomVariance(12, 0.15), randomVariance(12, 0.15)),
        cpaUsd: createMetricComparison(randomVariance(300, 0.3), randomVariance(300, 0.3)),
      });
    }
  }

  // Google Ads RCA
  const googleAdsRCA: GoogleAdsRCATrendRow[] = [];
  const ctrPerf = ['STRONG', 'AVERAGE', 'WEAK'];
  const cpaPerf = ['EFFICIENT', 'AVERAGE', 'EXPENSIVE'];
  for (const product of products) {
    for (const region of regions) {
      const ctrIdx = Math.floor(Math.random() * 3);
      const cpaIdx = Math.floor(Math.random() * 3);
      googleAdsRCA.push({
        product,
        region,
        ctrPct: createMetricComparison(randomVariance(10, 0.2), randomVariance(10, 0.2)),
        cpaUsd: createMetricComparison(randomVariance(300, 0.3), randomVariance(300, 0.3)),
        ctrPerformance: { current: ctrPerf[ctrIdx], previous: ctrPerf[Math.floor(Math.random() * 3)] },
        cpaPerformance: { current: cpaPerf[cpaIdx], previous: cpaPerf[Math.floor(Math.random() * 3)] },
        severity: { current: severities[cpaIdx], previous: severities[Math.floor(Math.random() * 4)] },
        rcaCommentary: {
          current: `${product} ${region} campaigns showing ${cpaPerf[cpaIdx].toLowerCase()} CPA performance.`,
          previous: 'Previous period commentary.',
        },
        recommendedAction: {
          current: cpaIdx === 2 ? 'Optimize bidding and negative keywords.' : 'Continue current strategy.',
          previous: 'Previous recommended action.',
        },
      });
    }
  }

  // Wins / Bright spots
  const winsBrightSpots: WinBrightSpotTrend[] = [];
  const performanceTiers = ['EXCEPTIONAL', 'ON_TRACK', 'NEEDS_ATTENTION'];
  for (const product of products) {
    for (const region of regions) {
      if (Math.random() > 0.5) { // Only some combos have bright spots
        const tierIdx = Math.floor(Math.random() * 2); // Mostly exceptional or on track
        winsBrightSpots.push({
          product,
          region,
          category: categories[Math.floor(Math.random() * 3)],
          qtdAttainmentPct: createMetricComparison(randomVariance(130, 0.15), randomVariance(130, 0.15)),
          qtdAcv: createMetricComparison(randomVariance(100000, 0.2), randomVariance(100000, 0.2)),
          qtdTarget: createMetricComparison(randomVariance(80000, 0.1), randomVariance(80000, 0.1)),
          pipelineCoverageX: createMetricComparison(randomVariance(2, 0.2), randomVariance(2, 0.2)),
          winRatePct: createMetricComparison(randomVariance(85, 0.1), randomVariance(85, 0.1)),
          performanceTier: { current: performanceTiers[tierIdx], previous: performanceTiers[Math.floor(Math.random() * 3)] },
          successCommentary: {
            current: `${region} showing strong performance with high win rate.`,
            previous: 'Previous period showed similar trends.',
          },
        });
      }
    }
  }

  // Momentum indicators
  const momentumIndicators: MomentumIndicatorTrend[] = [];
  const momentumTiers = ['STRONG_MOMENTUM', 'MODERATE_MOMENTUM', 'NO_MOMENTUM', 'DECLINING'];
  for (const product of products) {
    for (const region of regions) {
      const tierIdx = Math.floor(Math.random() * 4);
      momentumIndicators.push({
        product,
        region,
        momentumTier: { current: momentumTiers[tierIdx], previous: momentumTiers[Math.floor(Math.random() * 4)] },
        positiveMomentumCount: createMetricComparison(Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)),
        mqlWowPct: createMetricComparison(randomVariance(0, 1.5) - 30, randomVariance(0, 1.5) - 30),
        sqlWowPct: createMetricComparison(randomVariance(0, 1.5) - 20, randomVariance(0, 1.5) - 20),
        mqlTrend: { current: trendOptions[Math.floor(Math.random() * 3)], previous: trendOptions[Math.floor(Math.random() * 3)] },
        sqlTrend: { current: trendOptions[Math.floor(Math.random() * 3)], previous: trendOptions[Math.floor(Math.random() * 3)] },
        momentumCommentary: {
          current: `${region} showing ${momentumTiers[tierIdx].toLowerCase().replace('_', ' ')}.`,
          previous: 'Previous momentum state.',
        },
      });
    }
  }

  // Top risk pockets
  const topRiskPockets: TopRiskPocketTrend[] = [];
  for (const product of products) {
    for (const region of regions) {
      if (Math.random() > 0.4) { // Some have risk pockets
        topRiskPockets.push({
          product,
          region,
          category: categories[Math.floor(Math.random() * 3)],
          qtdTarget: createMetricComparison(randomVariance(80000, 0.15), randomVariance(80000, 0.15)),
          qtdAcv: createMetricComparison(randomVariance(40000, 0.2), randomVariance(40000, 0.2)),
          qtdGap: createMetricComparison(randomVariance(-40000, 0.3), randomVariance(-40000, 0.3)),
          qtdAttainmentPct: createMetricComparison(randomVariance(50, 0.25), randomVariance(50, 0.25)),
          winRatePct: createMetricComparison(randomVariance(40, 0.3), randomVariance(40, 0.3)),
          pipelineAcv: createMetricComparison(randomVariance(200000, 0.3), randomVariance(200000, 0.3)),
          pipelineCoverageX: createMetricComparison(randomVariance(1.5, 0.25), randomVariance(1.5, 0.25)),
          ragStatus: { current: 'RED', previous: Math.random() > 0.5 ? 'RED' : 'YELLOW' },
        });
      }
    }
  }

  // Funnel RCA insights
  const funnelRCAInsights: FunnelRCAInsightTrend[] = [];
  for (const product of products) {
    for (const region of regions) {
      const sevIdx = Math.floor(Math.random() * 4);
      funnelRCAInsights.push({
        product,
        region,
        primaryBottleneck: { current: bottlenecks[Math.floor(Math.random() * 4)], previous: bottlenecks[Math.floor(Math.random() * 4)] },
        severity: { current: severities[sevIdx], previous: severities[Math.floor(Math.random() * 4)] },
        rcaCommentary: {
          current: `${region} funnel showing conversion issues at bottleneck stage.`,
          previous: 'Previous period had different bottleneck.',
        },
        recommendedAction: {
          current: 'Coach AEs on discovery, review qualification criteria.',
          previous: 'Previous action recommendation.',
        },
        mqlPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
        sqlPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
        salPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
        sqoPacingPct: createMetricComparison(randomVariance(100, 0.25), randomVariance(100, 0.25)),
      });
    }
  }

  // Funnel milestone attainment - MQL/SQL/SAL/SQO attainment based on date range
  const funnelMilestoneAttainment: any[] = [];
  for (const product of products) {
    for (const region of regions) {
      const productMult = product === 'POR' ? 0.7 : 0.3;
      const regionMult = region === 'AMER' ? 0.6 : region === 'EMEA' ? 0.25 : 0.15;

      // Calculate actual vs target for each milestone
      const mqlTarget = Math.round(100 * productMult * regionMult * (days / 30));
      const sqlTarget = Math.round(50 * productMult * regionMult * (days / 30));
      const salTarget = Math.round(35 * productMult * regionMult * (days / 30));
      const sqoTarget = Math.round(20 * productMult * regionMult * (days / 30));

      const mqlActual = randomVariance(mqlTarget, 0.25);
      const sqlActual = randomVariance(sqlTarget, 0.25);
      const salActual = randomVariance(salTarget, 0.25);
      const sqoActual = randomVariance(sqoTarget, 0.25);

      const mqlAttainment = mqlTarget > 0 ? Math.round((mqlActual / mqlTarget) * 1000) / 10 : 0;
      const sqlAttainment = sqlTarget > 0 ? Math.round((sqlActual / sqlTarget) * 1000) / 10 : 0;
      const salAttainment = salTarget > 0 ? Math.round((salActual / salTarget) * 1000) / 10 : 0;
      const sqoAttainment = sqoTarget > 0 ? Math.round((sqoActual / sqoTarget) * 1000) / 10 : 0;

      // Aggregated funnel score (weighted average)
      const funnelScore = Math.round((mqlAttainment * 0.15 + sqlAttainment * 0.25 + salAttainment * 0.30 + sqoAttainment * 0.30) * 10) / 10;

      const prevMqlAttainment = randomVariance(mqlAttainment, 0.15);
      const prevSqlAttainment = randomVariance(sqlAttainment, 0.15);
      const prevSalAttainment = randomVariance(salAttainment, 0.15);
      const prevSqoAttainment = randomVariance(sqoAttainment, 0.15);
      const prevFunnelScore = Math.round((prevMqlAttainment * 0.15 + prevSqlAttainment * 0.25 + prevSalAttainment * 0.30 + prevSqoAttainment * 0.30) * 10) / 10;

      funnelMilestoneAttainment.push({
        product,
        region,
        mqlTarget: createMetricComparison(mqlTarget, Math.round(mqlTarget * 0.9)),
        mqlActual: createMetricComparison(mqlActual, randomVariance(mqlActual, 0.15)),
        mqlAttainmentPct: createMetricComparison(mqlAttainment, prevMqlAttainment),
        mqlRag: { current: mqlAttainment >= 90 ? 'GREEN' : mqlAttainment >= 70 ? 'YELLOW' : 'RED', previous: randomRAG() },
        sqlTarget: createMetricComparison(sqlTarget, Math.round(sqlTarget * 0.9)),
        sqlActual: createMetricComparison(sqlActual, randomVariance(sqlActual, 0.15)),
        sqlAttainmentPct: createMetricComparison(sqlAttainment, prevSqlAttainment),
        sqlRag: { current: sqlAttainment >= 90 ? 'GREEN' : sqlAttainment >= 70 ? 'YELLOW' : 'RED', previous: randomRAG() },
        salTarget: createMetricComparison(salTarget, Math.round(salTarget * 0.9)),
        salActual: createMetricComparison(salActual, randomVariance(salActual, 0.15)),
        salAttainmentPct: createMetricComparison(salAttainment, prevSalAttainment),
        salRag: { current: salAttainment >= 90 ? 'GREEN' : salAttainment >= 70 ? 'YELLOW' : 'RED', previous: randomRAG() },
        sqoTarget: createMetricComparison(sqoTarget, Math.round(sqoTarget * 0.9)),
        sqoActual: createMetricComparison(sqoActual, randomVariance(sqoActual, 0.15)),
        sqoAttainmentPct: createMetricComparison(sqoAttainment, prevSqoAttainment),
        sqoRag: { current: sqoAttainment >= 90 ? 'GREEN' : sqoAttainment >= 70 ? 'YELLOW' : 'RED', previous: randomRAG() },
        funnelScore: createMetricComparison(funnelScore, prevFunnelScore),
        funnelScoreRag: { current: funnelScore >= 90 ? 'GREEN' : funnelScore >= 70 ? 'YELLOW' : 'RED', previous: randomRAG() },
      });
    }
  }

  // Detailed action items with specific issues, reasons, and recommended actions
  const immediateActions: ActionItemTrend[] = [];
  const shortTermActions: ActionItemTrend[] = [];
  const strategicActions: ActionItemTrend[] = [];

  // Generate detailed immediate actions based on actual data patterns
  const immediateIssues = [
    {
      category: 'PIPELINE',
      issue: 'Pipeline coverage below 1.5x for Q1 remaining target',
      reason: 'Insufficient qualified opportunities to meet quota. Current pipeline will not sustain deal velocity needed.',
      action: 'Schedule pipeline generation blitz with SDR team. Review all dormant opportunities for reactivation. Consider targeted outbound campaign to high-fit accounts.',
      metric: 'Coverage: 1.2x vs 2.0x required',
    },
    {
      category: 'FUNNEL',
      issue: 'SQL to SAL conversion rate dropped 35% week-over-week',
      reason: 'Discovery calls not progressing to proposals. AEs report prospects are not ready to buy or lack budget confirmation.',
      action: 'Review discovery call recordings for skill gaps. Implement mandatory BANT qualification before SAL stage. Coach AEs on multi-threading and champion identification.',
      metric: 'SQL→SAL: 42% vs 65% target',
    },
    {
      category: 'LOSS_REASON',
      issue: 'Pricing objections caused 5 losses totaling $127K this period',
      reason: 'Competitors offering aggressive discounts. Deals lost primarily in mid-market segment where price sensitivity is highest.',
      action: 'Request deal desk review of pricing strategy. Prepare competitive battle cards with value differentiation. Consider promotional pricing for at-risk deals in pipeline.',
      metric: '5 deals / $127K lost to pricing',
    },
    {
      category: 'GOOGLE_ADS',
      issue: 'CPA increased 45% while conversion volume dropped',
      reason: 'Rising bid costs in competitive keywords. Landing page conversion rate declined after recent website changes.',
      action: 'Pause underperforming campaigns immediately. A/B test new landing page variants. Shift budget to high-intent keywords with better ROAS.',
      metric: 'CPA: $485 vs $335 target',
    },
    {
      category: 'TREND',
      issue: 'New Logo attainment at 38% with 85% of quarter remaining',
      reason: 'New business pipeline is 60% of required coverage. Win rates on new logos have declined due to longer sales cycles.',
      action: 'Reallocate SDR resources to new logo prospecting. Accelerate enterprise deals in late-stage. Review ICP fit on recent losses.',
      metric: 'Attainment: 38% vs 15% expected',
    },
  ];

  const shortTermIssues = [
    {
      category: 'FUNNEL',
      issue: 'MQL volume 25% below target for the period',
      reason: 'Inbound lead generation underperforming. Content marketing campaigns have lower engagement than benchmarks.',
      action: 'Launch retargeting campaign to website visitors. Promote gated content through paid social. Review SEO rankings for key terms.',
      metric: 'MQL: 45 actual vs 60 target',
    },
    {
      category: 'PIPELINE',
      issue: 'Average deal age exceeding 90 days for 12 opportunities',
      reason: 'Deals stalled in negotiation without clear next steps. Decision makers not engaged or procurement delays.',
      action: 'Conduct deal review on all 90+ day opportunities. Implement close plan with mutual action dates. Escalate to leadership for executive engagement.',
      metric: '12 deals > 90 days old',
    },
    {
      category: 'TREND',
      issue: 'EMEA region showing negative momentum on all funnel metrics',
      reason: 'Reduced marketing spend in region. Two AE vacancies impacting coverage. Seasonal slowdown in key verticals.',
      action: 'Request additional marketing budget allocation. Accelerate hiring for open AE positions. Focus on expansion opportunities with existing customers.',
      metric: 'All metrics trending DOWN',
    },
    {
      category: 'LOSS_REASON',
      issue: 'Competitor XYZ won 3 deals in target vertical this month',
      reason: 'Competitor launched new product feature that addresses key pain point. Pricing is 20% below our list price.',
      action: 'Document competitive intelligence and update battle cards. Schedule product team briefing on feature gap. Develop ROI calculator to justify premium.',
      metric: '3 losses / $89K to XYZ Corp',
    },
  ];

  const strategicIssues = [
    {
      category: 'FUNNEL',
      issue: 'Outbound channel contributing only 15% of pipeline vs 30% target',
      reason: 'SDR team focused on inbound follow-up. Outbound sequences have low response rates. Target account list needs refresh.',
      action: 'Rebalance SDR allocation to 50/50 inbound/outbound. Refresh outbound sequences with new messaging. Review and update target account list based on ICP analysis.',
      metric: 'Outbound: 15% vs 30% target',
    },
    {
      category: 'PIPELINE',
      issue: 'Expansion revenue below historical run rate',
      reason: 'Customer success team bandwidth limited. Upsell motion not systematized. Product adoption metrics not triggering expansion conversations.',
      action: 'Implement automated expansion triggers based on usage. Train CSMs on expansion selling. Create dedicated expansion pipeline review cadence.',
      metric: 'Expansion: $45K vs $85K historical',
    },
    {
      category: 'GOOGLE_ADS',
      issue: 'Brand awareness campaigns showing diminishing returns',
      reason: 'Market saturation in primary channels. Frequency cap reached for target audiences. Creative fatigue on existing ad variants.',
      action: 'Test new channels (LinkedIn, YouTube). Refresh creative assets with new messaging. Expand audience targeting to adjacent segments.',
      metric: 'ROAS declining 3 consecutive months',
    },
  ];

  for (const item of immediateIssues) {
    const product = products[Math.floor(Math.random() * products.length)];
    const region = regions[Math.floor(Math.random() * regions.length)];
    immediateActions.push({
      urgency: 'IMMEDIATE',
      category: item.category,
      product,
      region,
      issue: item.issue,
      reason: item.reason,
      action: item.action,
      metric: item.metric,
      severity: 'CRITICAL',
      isNew: Math.random() > 0.5,
      isResolved: false,
    });
  }

  for (const item of shortTermIssues) {
    const product = products[Math.floor(Math.random() * products.length)];
    const region = regions[Math.floor(Math.random() * regions.length)];
    shortTermActions.push({
      urgency: 'SHORT_TERM',
      category: item.category,
      product,
      region,
      issue: item.issue,
      reason: item.reason,
      action: item.action,
      metric: item.metric,
      severity: 'HIGH',
      isNew: Math.random() > 0.6,
      isResolved: false,
    });
  }

  for (const item of strategicIssues) {
    const product = products[Math.floor(Math.random() * products.length)];
    const region = regions[Math.floor(Math.random() * regions.length)];
    strategicActions.push({
      urgency: 'STRATEGIC',
      category: item.category,
      product,
      region,
      issue: item.issue,
      reason: item.reason,
      action: item.action,
      metric: item.metric,
      severity: 'MEDIUM',
      isNew: Math.random() > 0.7,
      isResolved: false,
    });
  }

  // Grand total and product totals
  const grandTotal = {
    product: 'ALL',
    totalQ1Target: quarterlyTargets.combined_Q1_target,
    totalQtdTarget: createMetricComparison(
      Math.round(quarterlyTargets.combined_Q1_target * (daysElapsed / totalQuarterDays)),
      Math.round(quarterlyTargets.combined_Q1_target * ((daysElapsed - days) / totalQuarterDays))
    ),
    totalQtdDeals: createMetricComparison(currentDeals, previousDeals),
    totalQtdAcv: createMetricComparison(currentTotalAcv, previousTotalAcv),
    totalQtdAttainmentPct: createMetricComparison(
      Math.round((currentTotalAcv / (quarterlyTargets.combined_Q1_target * (daysElapsed / totalQuarterDays))) * 1000) / 10,
      Math.round((previousTotalAcv / (quarterlyTargets.combined_Q1_target * ((daysElapsed - days) / totalQuarterDays))) * 1000) / 10
    ),
    totalQ1ProgressPct: createMetricComparison(
      Math.round((currentTotalAcv / quarterlyTargets.combined_Q1_target) * 1000) / 10,
      Math.round((previousTotalAcv / quarterlyTargets.combined_Q1_target) * 1000) / 10
    ),
    totalQtdGap: createMetricComparison(
      currentTotalAcv - Math.round(quarterlyTargets.combined_Q1_target * (daysElapsed / totalQuarterDays)),
      previousTotalAcv - Math.round(quarterlyTargets.combined_Q1_target * ((daysElapsed - days) / totalQuarterDays))
    ),
    totalLostDeals: createMetricComparison(currentLostDeals, previousLostDeals),
    totalLostAcv: createMetricComparison(currentLostAcv, previousLostAcv),
    totalWinRatePct: createMetricComparison(
      Math.round((currentDeals / (currentDeals + currentLostDeals)) * 1000) / 10,
      Math.round((previousDeals / (previousDeals + previousLostDeals)) * 1000) / 10
    ),
    totalPipelineAcv: createMetricComparison(currentPipeline, previousPipeline),
    totalPipelineCoverageX: createMetricComparison(
      Math.round((currentPipeline / (quarterlyTargets.combined_Q1_target - currentTotalAcv)) * 10) / 10,
      Math.round((previousPipeline / (quarterlyTargets.combined_Q1_target - previousTotalAcv)) * 10) / 10
    ),
  };

  const productTotals: Record<string, any> = {};
  for (const product of products) {
    const productMult = product === 'POR' ? 0.75 : 0.25;
    const q1Target = product === 'POR' ? quarterlyTargets.POR_Q1_target : quarterlyTargets.R360_Q1_target;
    const currAcv = Math.round(currentTotalAcv * productMult);
    const prevAcv = Math.round(previousTotalAcv * productMult);
    const currDeals = Math.round(currentDeals * productMult);
    const prevDealsP = Math.round(previousDeals * productMult);
    const currLost = Math.round(currentLostDeals * (product === 'POR' ? 0.2 : 0.8));
    const prevLost = Math.round(previousLostDeals * (product === 'POR' ? 0.2 : 0.8));
    const currPipe = Math.round(currentPipeline * productMult);
    const prevPipe = Math.round(previousPipeline * productMult);

    productTotals[product] = {
      product,
      totalQ1Target: q1Target,
      totalQtdTarget: createMetricComparison(
        Math.round(q1Target * (daysElapsed / totalQuarterDays)),
        Math.round(q1Target * ((daysElapsed - days) / totalQuarterDays))
      ),
      totalQtdDeals: createMetricComparison(currDeals, prevDealsP),
      totalQtdAcv: createMetricComparison(currAcv, prevAcv),
      totalQtdAttainmentPct: createMetricComparison(
        Math.round((currAcv / (q1Target * (daysElapsed / totalQuarterDays))) * 1000) / 10,
        Math.round((prevAcv / (q1Target * ((daysElapsed - days) / totalQuarterDays))) * 1000) / 10
      ),
      totalQ1ProgressPct: createMetricComparison(
        Math.round((currAcv / q1Target) * 1000) / 10,
        Math.round((prevAcv / q1Target) * 1000) / 10
      ),
      totalQtdGap: createMetricComparison(
        currAcv - Math.round(q1Target * (daysElapsed / totalQuarterDays)),
        prevAcv - Math.round(q1Target * ((daysElapsed - days) / totalQuarterDays))
      ),
      totalLostDeals: createMetricComparison(currLost, prevLost),
      totalLostAcv: createMetricComparison(Math.round(currentLostAcv * (product === 'POR' ? 0.2 : 0.8)), Math.round(previousLostAcv * (product === 'POR' ? 0.2 : 0.8))),
      totalWinRatePct: createMetricComparison(
        currLost > 0 ? Math.round((currDeals / (currDeals + currLost)) * 1000) / 10 : 100,
        prevLost > 0 ? Math.round((prevDealsP / (prevDealsP + prevLost)) * 1000) / 10 : 100
      ),
      totalPipelineAcv: createMetricComparison(currPipe, prevPipe),
      totalPipelineCoverageX: createMetricComparison(
        Math.round((currPipe / Math.max(1, q1Target - currAcv)) * 10) / 10,
        Math.round((prevPipe / Math.max(1, q1Target - prevAcv)) * 10) / 10
      ),
    };
  }

  // Funnel pacing with targets vs actuals
  const funnelPacing: any[] = [];
  for (const product of products) {
    for (const region of regions) {
      const productMult = product === 'POR' ? 0.7 : 0.3;
      const regionMult = region === 'AMER' ? 0.6 : region === 'EMEA' ? 0.25 : 0.15;
      const baseMql = Math.round(100 * productMult * regionMult);
      const baseSql = Math.round(50 * productMult * regionMult);
      const baseSal = Math.round(35 * productMult * regionMult);
      const baseSqo = Math.round(20 * productMult * regionMult);

      for (const source of ['INBOUND', 'OUTBOUND']) {
        const sourceMult = source === 'INBOUND' ? 0.6 : 0.4;
        const actualMql = randomVariance(Math.round(baseMql * sourceMult * (days / 30)), 0.2);
        const targetMql = Math.round(baseMql * sourceMult * (days / 30));
        const actualSql = randomVariance(Math.round(baseSql * sourceMult * (days / 30)), 0.2);
        const targetSql = Math.round(baseSql * sourceMult * (days / 30));
        const actualSal = randomVariance(Math.round(baseSal * sourceMult * (days / 30)), 0.2);
        const targetSal = Math.round(baseSal * sourceMult * (days / 30));
        const actualSqo = randomVariance(Math.round(baseSqo * sourceMult * (days / 30)), 0.2);
        const targetSqo = Math.round(baseSqo * sourceMult * (days / 30));

        const mqlPacing = targetMql > 0 ? Math.round((actualMql / targetMql) * 100) : 0;
        const sqlPacing = targetSql > 0 ? Math.round((actualSql / targetSql) * 100) : 0;
        const salPacing = targetSal > 0 ? Math.round((actualSal / targetSal) * 100) : 0;
        const sqoPacing = targetSqo > 0 ? Math.round((actualSqo / targetSqo) * 100) : 0;

        funnelPacing.push({
          product,
          region,
          sourceChannel: source,
          actualMql: createMetricComparison(actualMql, randomVariance(actualMql, 0.15)),
          targetMql: createMetricComparison(targetMql, Math.round(targetMql * 0.9)),
          mqlPacingPct: createMetricComparison(mqlPacing, randomVariance(mqlPacing, 0.2)),
          mqlRag: { current: mqlPacing >= 90 ? 'GREEN' : mqlPacing >= 70 ? 'YELLOW' : 'RED', previous: randomRAG() },
          actualSql: createMetricComparison(actualSql, randomVariance(actualSql, 0.15)),
          targetSql: createMetricComparison(targetSql, Math.round(targetSql * 0.9)),
          sqlPacingPct: createMetricComparison(sqlPacing, randomVariance(sqlPacing, 0.2)),
          sqlRag: { current: sqlPacing >= 90 ? 'GREEN' : sqlPacing >= 70 ? 'YELLOW' : 'RED', previous: randomRAG() },
          actualSal: createMetricComparison(actualSal, randomVariance(actualSal, 0.15)),
          targetSal: createMetricComparison(targetSal, Math.round(targetSal * 0.9)),
          salPacingPct: createMetricComparison(salPacing, randomVariance(salPacing, 0.2)),
          salRag: { current: salPacing >= 90 ? 'GREEN' : salPacing >= 70 ? 'YELLOW' : 'RED', previous: randomRAG() },
          actualSqo: createMetricComparison(actualSqo, randomVariance(actualSqo, 0.15)),
          targetSqo: createMetricComparison(targetSqo, Math.round(targetSqo * 0.9)),
          sqoPacingPct: createMetricComparison(sqoPacing, randomVariance(sqoPacing, 0.2)),
          sqoRag: { current: sqoPacing >= 90 ? 'GREEN' : sqoPacing >= 70 ? 'YELLOW' : 'RED', previous: randomRAG() },
          inboundTargetAcv: createMetricComparison(randomVariance(40000 * productMult * regionMult, 0.1), randomVariance(38000 * productMult * regionMult, 0.1)),
          mqlToSqlRate: createMetricComparison(targetMql > 0 ? Math.round((actualSql / actualMql) * 1000) / 10 : 0, randomVariance(60, 0.2)),
          sqlToSalRate: createMetricComparison(actualSql > 0 ? Math.round((actualSal / actualSql) * 1000) / 10 : 0, randomVariance(65, 0.2)),
          salToSqoRate: createMetricComparison(actualSal > 0 ? Math.round((actualSqo / actualSal) * 1000) / 10 : 0, randomVariance(55, 0.2)),
        });
      }
    }
  }

  // Pipeline attainment - detailed pipeline metrics by product/region/category
  const pipelineAttainment: any[] = [];
  for (const product of products) {
    for (const region of regions) {
      for (const category of categories) {
        const productMult = product === 'POR' ? 0.75 : 0.25;
        const regionMult = region === 'AMER' ? 0.6 : region === 'EMEA' ? 0.25 : 0.15;
        const categoryMult = category === 'NEW LOGO' ? 0.4 : category === 'EXPANSION' ? 0.45 : 0.15;
        const q1Target = (product === 'POR' ? quarterlyTargets.POR_Q1_target : quarterlyTargets.R360_Q1_target) * regionMult * categoryMult;
        const qtdTarget = q1Target * (daysElapsed / totalQuarterDays);
        const prevQtdTarget = q1Target * ((daysElapsed - days) / totalQuarterDays);
        const currAcv = randomVariance(qtdTarget, 0.25);
        const prevAcv = randomVariance(prevQtdTarget, 0.25);
        const currPipe = randomVariance(q1Target * 2.5, 0.3);
        const prevPipe = randomVariance(q1Target * 2.5, 0.3);
        const remainingTarget = Math.max(0, q1Target - currAcv);
        const currCoverage = remainingTarget > 0 ? currPipe / remainingTarget : 99;
        const prevRemainingTarget = Math.max(0, q1Target - prevAcv);
        const prevCoverage = prevRemainingTarget > 0 ? prevPipe / prevRemainingTarget : 99;
        const currAttainment = qtdTarget > 0 ? (currAcv / qtdTarget) * 100 : 0;
        const prevAttainment = prevQtdTarget > 0 ? (prevAcv / prevQtdTarget) * 100 : 0;

        pipelineAttainment.push({
          product,
          region,
          category,
          q1Target: createMetricComparison(Math.round(q1Target), Math.round(q1Target)),
          qtdTarget: createMetricComparison(Math.round(qtdTarget), Math.round(prevQtdTarget)),
          qtdAcv: createMetricComparison(Math.round(currAcv), Math.round(prevAcv)),
          qtdAttainmentPct: createMetricComparison(Math.round(currAttainment * 10) / 10, Math.round(prevAttainment * 10) / 10),
          q1ProgressPct: createMetricComparison(
            Math.round((currAcv / q1Target) * 1000) / 10,
            Math.round((prevAcv / q1Target) * 1000) / 10
          ),
          qtdGap: createMetricComparison(Math.round(currAcv - qtdTarget), Math.round(prevAcv - prevQtdTarget)),
          pipelineAcv: createMetricComparison(Math.round(currPipe), Math.round(prevPipe)),
          pipelineCoverageX: createMetricComparison(Math.round(currCoverage * 10) / 10, Math.round(prevCoverage * 10) / 10),
          pipelineOpps: createMetricComparison(Math.round(currPipe / 25000), Math.round(prevPipe / 25000)),
          pipelineAvgAgeDays: createMetricComparison(randomVariance(45, 0.3), randomVariance(42, 0.3)),
          requiredRunRate: createMetricComparison(
            Math.round(remainingTarget / Math.max(1, periodInfo.daysRemaining)),
            Math.round(prevRemainingTarget / Math.max(1, periodInfo.daysRemaining + days))
          ),
          ragStatus: {
            current: currAttainment >= 90 ? 'GREEN' : currAttainment >= 70 ? 'YELLOW' : 'RED',
            previous: prevAttainment >= 90 ? 'GREEN' : prevAttainment >= 70 ? 'YELLOW' : 'RED',
          },
        });
      }
    }
  }

  // Deal lists with realistic account names
  const accountNames = [
    'Acme Rentals Inc', 'United Equipment Co', 'Pro-Tool Services', 'Builder\'s Choice Rental',
    'Heavy Duty Rentals', 'All-Star Equipment', 'Premier Tool Hire', 'Industrial Solutions',
    'Metro Equipment', 'Capital Rental Group', 'Southwest Rentals', 'Pacific Tools Inc',
    'Mountain View Rentals', 'Coastal Equipment', 'Prairie Land Tools', 'Urban Rentals LLC',
    'Delta Equipment Co', 'Summit Rental Services', 'Valley Tool Hire', 'Horizon Rentals',
  ];
  const ownerNames = ['Harry Shelton', 'Joel Gibbs', 'Sarah Chen', 'Marcus Williams', 'Emily Rodriguez', 'David Park', 'Amanda Foster', 'Ryan O\'Brien'];
  const wonDeals: DealDetailTrend[] = [];
  const lostDeals: DealDetailTrend[] = [];
  const pipelineDeals: DealDetailTrend[] = [];
  const dealTypes = ['New Business', 'Existing Business', 'Migration'];
  const stages = ['Closed Won', 'Closed Lost', 'Negotiation', 'Proposal', 'Discovery'];

  // Generate more realistic deals
  for (let i = 0; i < 15; i++) {
    const product = products[i % products.length];
    const region = regions[i % regions.length];
    const category = categories[i % categories.length];
    const acv = randomVariance(product === 'POR' ? 35000 : 15000, 0.5);
    const closeDate = new Date(startDate);
    closeDate.setDate(closeDate.getDate() + Math.floor(Math.random() * days));

    wonDeals.push({
      opportunityId: `006an00000${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      accountName: accountNames[i % accountNames.length],
      opportunityName: `${category === 'NEW LOGO' ? 'New ' : category === 'EXPANSION' ? 'Expansion - ' : 'Migration - '}${product} System for ${accountNames[i % accountNames.length]}`,
      product,
      region,
      category,
      dealType: dealTypes[category === 'NEW LOGO' ? 0 : category === 'EXPANSION' ? 1 : 2],
      acv,
      closeDate: closeDate.toISOString().split('T')[0],
      stage: 'Closed Won',
      isWon: true,
      isClosed: true,
      lossReason: null,
      source: sources[Math.floor(Math.random() * sources.length)],
      ownerName: ownerNames[Math.floor(Math.random() * ownerNames.length)],
      ownerId: `0054u000008${Math.random().toString(36).substring(2, 8)}`,
      salesforceUrl: `https://por.my.salesforce.com/006an00000${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      periodType: 'current',
    });
  }

  for (let i = 0; i < 8; i++) {
    const product = products[i % products.length];
    const region = regions[i % regions.length];
    const category = categories[i % categories.length];
    const acv = randomVariance(product === 'POR' ? 25000 : 12000, 0.5);
    const closeDate = new Date(startDate);
    closeDate.setDate(closeDate.getDate() + Math.floor(Math.random() * days));

    lostDeals.push({
      opportunityId: `006an00000${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      accountName: accountNames[(i + 10) % accountNames.length],
      opportunityName: `${product} System for ${accountNames[(i + 10) % accountNames.length]}`,
      product,
      region,
      category,
      dealType: dealTypes[category === 'NEW LOGO' ? 0 : category === 'EXPANSION' ? 1 : 2],
      acv,
      closeDate: closeDate.toISOString().split('T')[0],
      stage: 'Closed Lost',
      isWon: false,
      isClosed: true,
      lossReason: lossReasons[Math.floor(Math.random() * lossReasons.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      ownerName: ownerNames[Math.floor(Math.random() * ownerNames.length)],
      ownerId: `0054u000008${Math.random().toString(36).substring(2, 8)}`,
      salesforceUrl: `https://por.my.salesforce.com/006an00000${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      periodType: 'current',
    });
  }

  for (let i = 0; i < 25; i++) {
    const product = products[i % products.length];
    const region = regions[i % regions.length];
    const category = categories[i % categories.length];
    const acv = randomVariance(product === 'POR' ? 45000 : 20000, 0.6);
    const closeDate = new Date(endDate);
    closeDate.setDate(closeDate.getDate() + Math.floor(Math.random() * 60));
    const stageIdx = Math.floor(Math.random() * 3) + 2; // Negotiation, Proposal, Discovery

    pipelineDeals.push({
      opportunityId: `006Ki000004${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      accountName: accountNames[i % accountNames.length],
      opportunityName: `${product} ${category === 'EXPANSION' ? 'Expansion' : category === 'MIGRATION' ? 'Migration' : 'New System'} for ${accountNames[i % accountNames.length]}`,
      product,
      region,
      category,
      dealType: dealTypes[category === 'NEW LOGO' ? 0 : category === 'EXPANSION' ? 1 : 2],
      acv,
      closeDate: closeDate.toISOString().split('T')[0],
      stage: stages[stageIdx],
      isWon: false,
      isClosed: false,
      lossReason: null,
      source: sources[Math.floor(Math.random() * sources.length)],
      ownerName: ownerNames[Math.floor(Math.random() * ownerNames.length)],
      ownerId: `0054u000005${Math.random().toString(36).substring(2, 8)}`,
      salesforceUrl: `https://por.my.salesforce.com/006Ki000004${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      periodType: 'current',
    });
  }

  // Charts
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

  const pipelineTimeSeries: TrendChartData = {
    metricName: 'Pipeline ACV',
    currentPeriod: generateDailyTimeSeries(startDate, days, dailyAcvBase * 3, 1, 'current'),
    previousPeriod: generateDailyTimeSeries(prevStartDate, days, dailyAcvBase * 3, 0.92, 'previous'),
  };

  return {
    generatedAt: new Date().toISOString(),
    periodInfo: {
      current: { startDate, endDate },
      previous: { startDate: prevStartDate, endDate: prevEndDate },
      daysInPeriod: days,
    },
    // Quarter pacing info
    period: periodInfo,
    quarterlyTargets,
    grandTotal,
    productTotals,
    filters: {
      products,
      regions,
    },
    revenueSummary: {
      totalACV: createMetricComparison(currentTotalAcv, previousTotalAcv),
      wonDeals: createMetricComparison(currentDeals, previousDeals),
      pipelineACV: createMetricComparison(currentPipeline, previousPipeline),
      avgDealSize: createMetricComparison(
        Math.round(currentTotalAcv / currentDeals),
        Math.round(previousTotalAcv / previousDeals)
      ),
      lostDeals: createMetricComparison(currentLostDeals, previousLostDeals),
      lostACV: createMetricComparison(currentLostAcv, previousLostAcv),
      winRatePct: createMetricComparison(
        Math.round((currentDeals / (currentDeals + currentLostDeals)) * 1000) / 10,
        Math.round((previousDeals / (previousDeals + previousLostDeals)) * 1000) / 10
      ),
    },
    funnelSummary: {
      totalMQL: createMetricComparison(currentMql, previousMql),
      totalSQL: createMetricComparison(currentSql, previousSql),
      totalSAL: createMetricComparison(currentSal, previousSal),
      totalSQO: createMetricComparison(currentSqo, previousSqo),
    },
    executiveCounts,
    winsBrightSpots,
    momentumIndicators,
    topRiskPockets,
    revenueByDimension,
    funnelByDimension,
    attainmentDetail,
    sourceAttainment,
    funnelHealth,
    funnelByCategory,
    funnelBySource,
    funnelTrends,
    funnelPacing,
    pipelineAttainment,
    funnelMilestoneAttainment,
    funnelRCAInsights,
    pipelineRCA,
    lossReasonRCA,
    googleAds,
    googleAdsRCA,
    actionItems: {
      immediate: immediateActions,
      shortTerm: shortTermActions,
      strategic: strategicActions,
    },
    wonDeals,
    lostDeals,
    pipelineDeals,
    charts: {
      acvTimeSeries,
      mqlTimeSeries,
      sqlTimeSeries,
      pipelineTimeSeries,
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
    description: 'Runs comprehensive trend analysis comparing two date periods with full report details',
    note: 'Currently using mock data generator. For production BigQuery integration, configure GOOGLE_APPLICATION_CREDENTIALS.',
    sections: [
      'revenueSummary', 'funnelSummary', 'executiveCounts', 'winsBrightSpots',
      'momentumIndicators', 'topRiskPockets', 'revenueByDimension', 'funnelByDimension',
      'attainmentDetail', 'sourceAttainment', 'funnelHealth', 'funnelByCategory',
      'funnelBySource', 'funnelTrends', 'funnelRCAInsights', 'pipelineRCA',
      'lossReasonRCA', 'googleAds', 'googleAdsRCA', 'actionItems',
      'wonDeals', 'lostDeals', 'pipelineDeals', 'charts'
    ],
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
