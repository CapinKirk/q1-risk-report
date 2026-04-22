/**
 * Shared aggregation utilities for stage-level funnel details.
 *
 * These were originally defined inside app/api/ai-analysis/route.ts and
 * re-computed on every AI request. That meant each call had to SHIP the
 * full mql_details/sql_details/sal_details/sqo_details arrays (~4.2MB
 * across all four) from client → server so the server could re-aggregate
 * them — which blew past Vercel's 4.5MB request-body cap on wide filter
 * scopes and made the "Generate Analysis" button return HTML 413.
 *
 * Moving these to a shared module lets /api/report-data pre-compute them
 * once (server-side) and ship just the aggregated results (~10-20KB total).
 * The AI route reads the pre-computed field; the client no longer needs
 * to send raw details for aggregation purposes.
 */

export interface DropoffData {
  count: number;
  acv: number;
  byRegion: Record<string, number>;
  bySource: Record<string, { count: number; acv: number }>;
  bySourceType: {
    PAID: { count: number; acv: number };
    ORGANIC: { count: number; acv: number };
    OTHER: { count: number; acv: number };
  };
}

export interface SourceStats {
  total: number;
  converted: number;
  lost: number;
  lostAcv: number;
  convRate: number;
  lossRate: number;
}

export interface StageStats {
  total: number;
  converted: number;
  lost: number;
  active: number;
  lostAcv: number;
  conversionRate: number;
  lossRate: number;
}

// Classify a source string as Paid / Organic / Other
export function classifySource(source: string): 'PAID' | 'ORGANIC' | 'OTHER' {
  const s = (source || '').toUpperCase();
  if (s.includes('PAID') || s.includes('PPC') || s.includes('CPC') || s.includes('GOOGLE ADS') ||
      s.includes('BING ADS') || s.includes('FACEBOOK ADS') || s.includes('LINKEDIN ADS') ||
      s.includes('DISPLAY') || s.includes('RETARGETING') || s === 'INBOUND') {
    return 'PAID';
  }
  if (s.includes('ORGANIC') || s.includes('SEO') || s.includes('DIRECT') || s.includes('REFERRAL') ||
      s.includes('SOCIAL') || s.includes('EMAIL') || s.includes('CONTENT') || s.includes('WEBINAR')) {
    return 'ORGANIC';
  }
  return 'OTHER';
}

// Aggregate dropoff reasons for one stage's detail rows.
export function aggregateDropoffReasons(
  details: any[], statusField: string, lostStatuses: string[]
): Record<string, DropoffData> {
  const reasons: Record<string, DropoffData> = {};
  for (const row of details) {
    const status = row[statusField];
    if (!lostStatuses.includes(status)) continue;
    const reason = row.loss_reason && row.loss_reason !== 'N/A' && row.loss_reason !== 'No Reason Provided'
      ? row.loss_reason
      : status === 'REVERTED' ? 'Reverted/Disqualified'
      : status === 'STALLED' ? 'Stalled (No Activity)'
      : 'No Reason Provided';
    const source = row.source || 'Unknown';
    const sourceType = classifySource(source);
    const acv = row.opportunity_acv || 0;
    if (!reasons[reason]) {
      reasons[reason] = {
        count: 0, acv: 0, byRegion: {}, bySource: {},
        bySourceType: { PAID: { count: 0, acv: 0 }, ORGANIC: { count: 0, acv: 0 }, OTHER: { count: 0, acv: 0 } },
      };
    }
    reasons[reason].count += 1;
    reasons[reason].acv += acv;
    reasons[reason].byRegion[row.region] = (reasons[reason].byRegion[row.region] || 0) + 1;
    if (!reasons[reason].bySource[source]) reasons[reason].bySource[source] = { count: 0, acv: 0 };
    reasons[reason].bySource[source].count += 1;
    reasons[reason].bySource[source].acv += acv;
    reasons[reason].bySourceType[sourceType].count += 1;
    reasons[reason].bySourceType[sourceType].acv += acv;
  }
  return reasons;
}

// Aggregate dropoffs grouped by source channel.
export function aggregateDropoffsBySource(
  details: any[], statusField: string, lostStatuses: string[], convertedStatuses: string[]
): Record<string, SourceStats> {
  const sources: Record<string, { total: number; converted: number; lost: number; lostAcv: number }> = {};
  for (const row of details) {
    const source = row.source || 'Unknown';
    const status = row[statusField];
    if (!sources[source]) sources[source] = { total: 0, converted: 0, lost: 0, lostAcv: 0 };
    sources[source].total += 1;
    if (convertedStatuses.includes(status)) sources[source].converted += 1;
    if (lostStatuses.includes(status)) {
      sources[source].lost += 1;
      sources[source].lostAcv += row.opportunity_acv || 0;
    }
  }
  const result: Record<string, SourceStats> = {};
  for (const [source, data] of Object.entries(sources)) {
    result[source] = {
      ...data,
      convRate: data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0,
      lossRate: data.total > 0 ? Math.round((data.lost / data.total) * 100) : 0,
    };
  }
  return result;
}

// Aggregate by Paid vs Organic vs Other source type.
export function aggregateBySourceType(
  details: any[], statusField: string, lostStatuses: string[], convertedStatuses: string[]
): Record<string, SourceStats> {
  const types: Record<string, { total: number; converted: number; lost: number; lostAcv: number }> = {
    PAID: { total: 0, converted: 0, lost: 0, lostAcv: 0 },
    ORGANIC: { total: 0, converted: 0, lost: 0, lostAcv: 0 },
    OTHER: { total: 0, converted: 0, lost: 0, lostAcv: 0 },
  };
  for (const row of details) {
    const sourceType = classifySource(row.source || '');
    const status = row[statusField];
    types[sourceType].total += 1;
    if (convertedStatuses.includes(status)) types[sourceType].converted += 1;
    if (lostStatuses.includes(status)) {
      types[sourceType].lost += 1;
      types[sourceType].lostAcv += row.opportunity_acv || 0;
    }
  }
  const result: Record<string, SourceStats> = {};
  for (const [type, data] of Object.entries(types)) {
    result[type] = {
      ...data,
      convRate: data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0,
      lossRate: data.total > 0 ? Math.round((data.lost / data.total) * 100) : 0,
    };
  }
  return result;
}

// Simple counts per stage (total / converted / lost / active / lostAcv + rates).
export function calcStageStats(
  details: any[], statusField: string, convertedStatuses: string[], lostStatuses: string[]
): StageStats {
  const total = details.length;
  const converted = details.filter(d => convertedStatuses.includes(d[statusField])).length;
  const lost = details.filter(d => lostStatuses.includes(d[statusField])).length;
  const active = details.filter(d => d[statusField] === 'ACTIVE').length;
  const lostAcv = details.filter(d => lostStatuses.includes(d[statusField]))
    .reduce((sum, d) => sum + (d.opportunity_acv || 0), 0);
  return {
    total, converted, lost, active, lostAcv,
    conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
    lossRate: total > 0 ? Math.round((lost / total) * 100) : 0,
  };
}

// Convenience — compute every aggregate the AI prompt needs for one stage.
// statuses: { converted: [...], lost: [...] }
export function buildStageAggregation(
  details: any[], statusField: string,
  statuses: { converted: readonly string[]; lost: readonly string[] }
) {
  const converted = [...statuses.converted];
  const lost = [...statuses.lost];
  return {
    stats: calcStageStats(details, statusField, converted, lost),
    dropoff_reasons: aggregateDropoffReasons(details, statusField, lost),
    by_source: aggregateDropoffsBySource(details, statusField, lost, converted),
    by_source_type: aggregateBySourceType(details, statusField, lost, converted),
  };
}

export type StageAggregation = ReturnType<typeof buildStageAggregation>;

// Package for one product: pre-computed aggregates for all four funnel stages.
export interface FunnelDropoffAggregations {
  mql: StageAggregation;
  sql: StageAggregation;
  sal: StageAggregation;
  sqo: StageAggregation;
}

// Status-set constants — keeps the two call sites (report-data + ai-analysis)
// in sync with a single source of truth.
export const STAGE_STATUS_SETS = {
  mql: { converted: ['CONVERTED'], lost: ['REVERTED', 'STALLED'] },
  sql: { converted: ['CONVERTED_SAL', 'CONVERTED_SQO', 'WON'], lost: ['LOST', 'STALLED'] },
  sal: { converted: ['CONVERTED_SQO', 'WON'], lost: ['LOST', 'STALLED'] },
  sqo: { converted: ['WON'], lost: ['LOST', 'STALLED'] },
} as const;

// One-shot: build aggregations for both products' funnels.
export function buildAllFunnelAggregations(details: {
  mql: { POR: any[]; R360: any[] };
  sql: { POR: any[]; R360: any[] };
  sal: { POR: any[]; R360: any[] };
  sqo: { POR: any[]; R360: any[] };
}): { POR: FunnelDropoffAggregations; R360: FunnelDropoffAggregations } {
  const forProduct = (p: 'POR' | 'R360'): FunnelDropoffAggregations => ({
    mql: buildStageAggregation(details.mql?.[p] || [], 'mql_status', STAGE_STATUS_SETS.mql),
    sql: buildStageAggregation(details.sql?.[p] || [], 'sql_status', STAGE_STATUS_SETS.sql),
    sal: buildStageAggregation(details.sal?.[p] || [], 'sal_status', STAGE_STATUS_SETS.sal),
    sqo: buildStageAggregation(details.sqo?.[p] || [], 'sqo_status', STAGE_STATUS_SETS.sqo),
  });
  return { POR: forProduct('POR'), R360: forProduct('R360') };
}
