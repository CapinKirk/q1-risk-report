import { NextResponse } from 'next/server';

export const maxDuration = 180; // Allow up to 180s for retries with longer outputs

// OpenAI API endpoint
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface FilterContext {
  products: string[];
  regions: string[];
  isFiltered: boolean;
}

interface AnalysisRequest {
  reportData: any;
  analysisType: 'bookings_miss' | 'pipeline_risk' | 'full_report';
  filterContext?: FilterContext;
  formats?: ('display' | 'html' | 'slack')[];
}


// Normalize attainment_detail to flat array (handles both API and frontend formats)
function normalizeAttainmentDetail(attainment_detail: any): any[] {
  if (!attainment_detail) return [];
  if (Array.isArray(attainment_detail)) return attainment_detail;
  // Handle {POR: [], R360: []} format from frontend
  const porData = attainment_detail.POR || [];
  const r360Data = attainment_detail.R360 || [];
  return [...porData, ...r360Data];
}

// Classify source as Paid or Organic
function classifySource(source: string): 'PAID' | 'ORGANIC' | 'OTHER' {
  const s = (source || '').toUpperCase();
  // Paid sources
  if (s.includes('PAID') || s.includes('PPC') || s.includes('CPC') || s.includes('GOOGLE ADS') ||
      s.includes('BING ADS') || s.includes('FACEBOOK ADS') || s.includes('LINKEDIN ADS') ||
      s.includes('DISPLAY') || s.includes('RETARGETING') || s === 'INBOUND') {
    return 'PAID';
  }
  // Organic sources
  if (s.includes('ORGANIC') || s.includes('SEO') || s.includes('DIRECT') || s.includes('REFERRAL') ||
      s.includes('SOCIAL') || s.includes('EMAIL') || s.includes('CONTENT') || s.includes('WEBINAR')) {
    return 'ORGANIC';
  }
  // Other sources (Outbound, AE Sourced, etc.)
  return 'OTHER';
}

// Enhanced dropoff aggregation with source breakdown
interface DropoffData {
  count: number;
  acv: number;
  byRegion: Record<string, number>;
  bySource: Record<string, { count: number; acv: number }>;
  bySourceType: { PAID: { count: number; acv: number }; ORGANIC: { count: number; acv: number }; OTHER: { count: number; acv: number } };
}

function aggregateDropoffReasons(details: any[], statusField: string, lostStatuses: string[]): Record<string, DropoffData> {
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
        count: 0,
        acv: 0,
        byRegion: {},
        bySource: {},
        bySourceType: { PAID: { count: 0, acv: 0 }, ORGANIC: { count: 0, acv: 0 }, OTHER: { count: 0, acv: 0 } }
      };
    }
    reasons[reason].count += 1;
    reasons[reason].acv += acv;
    reasons[reason].byRegion[row.region] = (reasons[reason].byRegion[row.region] || 0) + 1;

    // Track by source
    if (!reasons[reason].bySource[source]) {
      reasons[reason].bySource[source] = { count: 0, acv: 0 };
    }
    reasons[reason].bySource[source].count += 1;
    reasons[reason].bySource[source].acv += acv;

    // Track by source type (Paid vs Organic)
    reasons[reason].bySourceType[sourceType].count += 1;
    reasons[reason].bySourceType[sourceType].acv += acv;
  }

  return reasons;
}

// Aggregate dropoffs by source channel
function aggregateDropoffsBySource(details: any[], statusField: string, lostStatuses: string[], convertedStatuses: string[]): Record<string, { total: number; converted: number; lost: number; lostAcv: number; convRate: number; lossRate: number }> {
  const sources: Record<string, { total: number; converted: number; lost: number; lostAcv: number }> = {};

  for (const row of details) {
    const source = row.source || 'Unknown';
    const status = row[statusField];

    if (!sources[source]) {
      sources[source] = { total: 0, converted: 0, lost: 0, lostAcv: 0 };
    }
    sources[source].total += 1;

    if (convertedStatuses.includes(status)) {
      sources[source].converted += 1;
    }
    if (lostStatuses.includes(status)) {
      sources[source].lost += 1;
      sources[source].lostAcv += row.opportunity_acv || 0;
    }
  }

  // Calculate rates
  const result: Record<string, { total: number; converted: number; lost: number; lostAcv: number; convRate: number; lossRate: number }> = {};
  for (const [source, data] of Object.entries(sources)) {
    result[source] = {
      ...data,
      convRate: data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0,
      lossRate: data.total > 0 ? Math.round((data.lost / data.total) * 100) : 0,
    };
  }
  return result;
}

// Aggregate by Paid vs Organic
function aggregateBySourceType(details: any[], statusField: string, lostStatuses: string[], convertedStatuses: string[]): Record<string, { total: number; converted: number; lost: number; lostAcv: number; convRate: number; lossRate: number }> {
  const types: Record<string, { total: number; converted: number; lost: number; lostAcv: number }> = {
    PAID: { total: 0, converted: 0, lost: 0, lostAcv: 0 },
    ORGANIC: { total: 0, converted: 0, lost: 0, lostAcv: 0 },
    OTHER: { total: 0, converted: 0, lost: 0, lostAcv: 0 },
  };

  for (const row of details) {
    const sourceType = classifySource(row.source || '');
    const status = row[statusField];

    types[sourceType].total += 1;

    if (convertedStatuses.includes(status)) {
      types[sourceType].converted += 1;
    }
    if (lostStatuses.includes(status)) {
      types[sourceType].lost += 1;
      types[sourceType].lostAcv += row.opportunity_acv || 0;
    }
  }

  // Calculate rates
  const result: Record<string, { total: number; converted: number; lost: number; lostAcv: number; convRate: number; lossRate: number }> = {};
  for (const [type, data] of Object.entries(types)) {
    result[type] = {
      ...data,
      convRate: data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0,
      lossRate: data.total > 0 ? Math.round((data.lost / data.total) * 100) : 0,
    };
  }
  return result;
}

// Format dropoff summary for prompt (enhanced with source info)
function formatDropoffSummary(reasons: Record<string, DropoffData>): string {
  const sorted = Object.entries(reasons)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  if (sorted.length === 0) return 'No dropoffs recorded';

  return sorted.map(([reason, data]) => {
    const regionBreakdown = Object.entries(data.byRegion)
      .map(([r, c]) => `${r}:${c}`)
      .join(', ');
    const paidVsOrganic = `Paid:${data.bySourceType.PAID.count}, Organic:${data.bySourceType.ORGANIC.count}, Other:${data.bySourceType.OTHER.count}`;
    return `- ${reason}: ${data.count} leads${data.acv > 0 ? `, $${data.acv.toLocaleString()} ACV lost` : ''} (${regionBreakdown}) [${paidVsOrganic}]`;
  }).join('\n');
}

// Format source-level dropoff summary
function formatSourceDropoffSummary(sourceData: Record<string, { total: number; converted: number; lost: number; lostAcv: number; convRate: number; lossRate: number }>): string {
  const sorted = Object.entries(sourceData)
    .filter(([_, d]) => d.total >= 3) // Only sources with meaningful volume
    .sort((a, b) => b[1].lossRate - a[1].lossRate) // Sort by loss rate (worst first)
    .slice(0, 10);

  if (sorted.length === 0) return 'Insufficient data';

  return sorted.map(([source, data]) =>
    `- ${source}: ${data.total} leads, ${data.convRate}% conv, ${data.lossRate}% loss${data.lostAcv > 0 ? `, $${data.lostAcv.toLocaleString()} ACV lost` : ''}`
  ).join('\n');
}

// Build the analysis prompt based on report data
function buildAnalysisPrompt(reportData: any, analysisType: string, filterContext?: FilterContext): string {
  const {
    period, grand_total, product_totals, attainment_detail,
    funnel_by_category, funnel_by_source, pipeline_rca, loss_reason_rca,
    source_attainment, google_ads, google_ads_rca,
    mql_details, sql_details, sal_details, sqo_details,
    mql_disqualification_summary, utm_breakdown
  } = reportData;

  // Determine which products are active based on filter context
  const activeProducts = filterContext?.isFiltered && filterContext.products.length > 0
    ? filterContext.products
    : ['POR', 'R360'];
  const includePOR = activeProducts.includes('POR');
  const includeR360 = activeProducts.includes('R360');

  // Build filter context string for the prompt
  const filterDescription = filterContext?.isFiltered
    ? `**CRITICAL FILTER INSTRUCTION: This analysis is FILTERED to show ONLY ${filterContext.products.join(' and ')} data for ${filterContext.regions.join(', ')} region(s). You MUST ONLY analyze and discuss ${filterContext.products.join(' and ')}. Do NOT mention, reference, or compare to ${filterContext.products.includes('POR') ? 'R360' : 'POR'} at all - it is excluded from this analysis. Any sections that would normally cover the excluded product should instead provide deeper analysis of the included product(s).**`
    : 'This analysis covers ALL products (POR and R360) and ALL regions (AMER, EMEA, APAC).';

  // Calculate key metrics for context (only for active products)
  const porTotal = includePOR ? (product_totals?.POR || {}) : {};
  const r360Total = includeR360 ? (product_totals?.R360 || {}) : {};

  // Normalize attainment data to flat array
  const allAttainment = normalizeAttainmentDetail(attainment_detail);

  // Identify misses (segments below 90% attainment)
  const misses = allAttainment.filter((row: any) => row.qtd_attainment_pct < 90);
  const criticalMisses = misses.filter((row: any) => row.qtd_attainment_pct < 70);

  // Get funnel bottlenecks (only for active products)
  const funnelData = {
    POR: includePOR ? (funnel_by_category?.POR || []) : [],
    R360: includeR360 ? (funnel_by_category?.R360 || []) : [],
  };

  // Get funnel by source
  const funnelBySourceData = {
    POR: includePOR ? (funnel_by_source?.POR || []) : [],
    R360: includeR360 ? (funnel_by_source?.R360 || []) : [],
  };

  // Get source attainment
  const sourceAttainmentData = {
    POR: includePOR ? (source_attainment?.POR || []) : [],
    R360: includeR360 ? (source_attainment?.R360 || []) : [],
  };

  // Get Google Ads data
  const googleAdsData = {
    POR: includePOR ? (google_ads?.POR || []) : [],
    R360: includeR360 ? (google_ads?.R360 || []) : [],
  };

  // Get MQL disqualification summary
  const dqSummary = mql_disqualification_summary || { POR: {}, R360: {} };

  // Aggregate dropoff reasons for each funnel stage
  const mqlDropoffs = {
    POR: aggregateDropoffReasons(includePOR ? (mql_details?.POR || []) : [], 'mql_status', ['REVERTED', 'STALLED']),
    R360: aggregateDropoffReasons(includeR360 ? (mql_details?.R360 || []) : [], 'mql_status', ['REVERTED', 'STALLED']),
  };
  const sqlDropoffs = {
    POR: aggregateDropoffReasons(includePOR ? (sql_details?.POR || []) : [], 'sql_status', ['LOST', 'STALLED']),
    R360: aggregateDropoffReasons(includeR360 ? (sql_details?.R360 || []) : [], 'sql_status', ['LOST', 'STALLED']),
  };
  const salDropoffs = {
    POR: aggregateDropoffReasons(includePOR ? (sal_details?.POR || []) : [], 'sal_status', ['LOST', 'STALLED']),
    R360: aggregateDropoffReasons(includeR360 ? (sal_details?.R360 || []) : [], 'sal_status', ['LOST', 'STALLED']),
  };
  const sqoDropoffs = {
    POR: aggregateDropoffReasons(includePOR ? (sqo_details?.POR || []) : [], 'sqo_status', ['LOST', 'STALLED']),
    R360: aggregateDropoffReasons(includeR360 ? (sqo_details?.R360 || []) : [], 'sqo_status', ['LOST', 'STALLED']),
  };

  // Calculate stage-level dropoff stats
  const calcStageStats = (details: any[], statusField: string, convertedStatuses: string[], lostStatuses: string[]) => {
    const total = details.length;
    const converted = details.filter(d => convertedStatuses.includes(d[statusField])).length;
    const lost = details.filter(d => lostStatuses.includes(d[statusField])).length;
    const active = details.filter(d => d[statusField] === 'ACTIVE').length;
    const lostAcv = details.filter(d => lostStatuses.includes(d[statusField])).reduce((sum, d) => sum + (d.opportunity_acv || 0), 0);
    return { total, converted, lost, active, lostAcv, conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0, lossRate: total > 0 ? Math.round((lost / total) * 100) : 0 };
  };

  const stageStats = {
    mql: {
      POR: calcStageStats(includePOR ? (mql_details?.POR || []) : [], 'mql_status', ['CONVERTED'], ['REVERTED', 'STALLED']),
      R360: calcStageStats(includeR360 ? (mql_details?.R360 || []) : [], 'mql_status', ['CONVERTED'], ['REVERTED', 'STALLED']),
    },
    sql: {
      POR: calcStageStats(includePOR ? (sql_details?.POR || []) : [], 'sql_status', ['CONVERTED_SAL', 'CONVERTED_SQO', 'WON'], ['LOST', 'STALLED']),
      R360: calcStageStats(includeR360 ? (sql_details?.R360 || []) : [], 'sql_status', ['CONVERTED_SAL', 'CONVERTED_SQO', 'WON'], ['LOST', 'STALLED']),
    },
    sal: {
      POR: calcStageStats(includePOR ? (sal_details?.POR || []) : [], 'sal_status', ['CONVERTED_SQO', 'WON'], ['LOST', 'STALLED']),
      R360: calcStageStats(includeR360 ? (sal_details?.R360 || []) : [], 'sal_status', ['CONVERTED_SQO', 'WON'], ['LOST', 'STALLED']),
    },
    sqo: {
      POR: calcStageStats(includePOR ? (sqo_details?.POR || []) : [], 'sqo_status', ['WON'], ['LOST', 'STALLED']),
      R360: calcStageStats(includeR360 ? (sqo_details?.R360 || []) : [], 'sqo_status', ['WON'], ['LOST', 'STALLED']),
    },
  };

  // Aggregate dropoffs by source channel for each stage
  const sourceDropoffs = {
    mql: {
      POR: {
        bySource: aggregateDropoffsBySource(includePOR ? (mql_details?.POR || []) : [], 'mql_status', ['REVERTED', 'STALLED'], ['CONVERTED']),
        byType: aggregateBySourceType(includePOR ? (mql_details?.POR || []) : [], 'mql_status', ['REVERTED', 'STALLED'], ['CONVERTED']),
      },
      R360: {
        bySource: aggregateDropoffsBySource(includeR360 ? (mql_details?.R360 || []) : [], 'mql_status', ['REVERTED', 'STALLED'], ['CONVERTED']),
        byType: aggregateBySourceType(includeR360 ? (mql_details?.R360 || []) : [], 'mql_status', ['REVERTED', 'STALLED'], ['CONVERTED']),
      },
    },
    sql: {
      POR: {
        bySource: aggregateDropoffsBySource(includePOR ? (sql_details?.POR || []) : [], 'sql_status', ['LOST', 'STALLED'], ['CONVERTED_SAL', 'CONVERTED_SQO', 'WON']),
        byType: aggregateBySourceType(includePOR ? (sql_details?.POR || []) : [], 'sql_status', ['LOST', 'STALLED'], ['CONVERTED_SAL', 'CONVERTED_SQO', 'WON']),
      },
      R360: {
        bySource: aggregateDropoffsBySource(includeR360 ? (sql_details?.R360 || []) : [], 'sql_status', ['LOST', 'STALLED'], ['CONVERTED_SAL', 'CONVERTED_SQO', 'WON']),
        byType: aggregateBySourceType(includeR360 ? (sql_details?.R360 || []) : [], 'sql_status', ['LOST', 'STALLED'], ['CONVERTED_SAL', 'CONVERTED_SQO', 'WON']),
      },
    },
    sal: {
      POR: {
        bySource: aggregateDropoffsBySource(includePOR ? (sal_details?.POR || []) : [], 'sal_status', ['LOST', 'STALLED'], ['CONVERTED_SQO', 'WON']),
        byType: aggregateBySourceType(includePOR ? (sal_details?.POR || []) : [], 'sal_status', ['LOST', 'STALLED'], ['CONVERTED_SQO', 'WON']),
      },
      R360: {
        bySource: aggregateDropoffsBySource(includeR360 ? (sal_details?.R360 || []) : [], 'sal_status', ['LOST', 'STALLED'], ['CONVERTED_SQO', 'WON']),
        byType: aggregateBySourceType(includeR360 ? (sal_details?.R360 || []) : [], 'sal_status', ['LOST', 'STALLED'], ['CONVERTED_SQO', 'WON']),
      },
    },
    sqo: {
      POR: {
        bySource: aggregateDropoffsBySource(includePOR ? (sqo_details?.POR || []) : [], 'sqo_status', ['LOST', 'STALLED'], ['WON']),
        byType: aggregateBySourceType(includePOR ? (sqo_details?.POR || []) : [], 'sqo_status', ['LOST', 'STALLED'], ['WON']),
      },
      R360: {
        bySource: aggregateDropoffsBySource(includeR360 ? (sqo_details?.R360 || []) : [], 'sqo_status', ['LOST', 'STALLED'], ['WON']),
        byType: aggregateBySourceType(includeR360 ? (sqo_details?.R360 || []) : [], 'sqo_status', ['LOST', 'STALLED'], ['WON']),
      },
    },
  };

  // UTM Analysis - use pre-aggregated BigQuery data from utm_breakdown
  const emptyUtm = { by_source: [], by_medium: [], by_campaign: [], by_keyword: [], by_branded: [] };
  const utmData = utm_breakdown || { POR: emptyUtm, R360: emptyUtm };

  const mapUtmDimension = (items: any[]) => items
    .filter((item: any) => item.name && item.name !== 'unknown' && item.name !== 'none')
    .map((item: any) => ({
      name: item.name,
      total: item.mql_count || 0,
      converted: item.sql_count || 0,
      sqoCount: item.sqo_count || 0,
      convRate: item.mql_to_sql_pct || 0,
      sqoRate: item.mql_to_sqo_pct || 0,
    }))
    .slice(0, 10);

  const utmSourcePOR = mapUtmDimension(includePOR ? (utmData.POR?.by_source || []) : []);
  const utmSourceR360 = mapUtmDimension(includeR360 ? (utmData.R360?.by_source || []) : []);
  const utmKeywordPOR = mapUtmDimension(includePOR ? (utmData.POR?.by_keyword || []) : []);
  const utmKeywordR360 = mapUtmDimension(includeR360 ? (utmData.R360?.by_keyword || []) : []);
  const brandedPOR = mapUtmDimension(includePOR ? (utmData.POR?.by_branded || []) : []);
  const brandedR360 = mapUtmDimension(includeR360 ? (utmData.R360?.by_branded || []) : []);

  // Determine which regions to include based on filter context
  const activeRegions = filterContext?.isFiltered && filterContext.regions.length > 0
    ? filterContext.regions
    : ['AMER', 'EMEA', 'APAC'];

  // Group attainment data by region for regional breakdowns
  const amerAttainment = allAttainment.filter((r: any) => r.region === 'AMER');
  const emeaAttainment = allAttainment.filter((r: any) => r.region === 'EMEA');
  const apacAttainment = allAttainment.filter((r: any) => r.region === 'APAC');

  // Calculate regional totals
  const calcRegionTotal = (rows: any[]) => {
    const qtdAcv = rows.reduce((sum, r) => sum + (r.qtd_acv || 0), 0);
    const qtdTarget = rows.reduce((sum, r) => sum + (r.qtd_target || 0), 0);
    const gap = rows.reduce((sum, r) => sum + (r.qtd_gap || 0), 0);
    const attainment = qtdTarget > 0 ? Math.round((qtdAcv / qtdTarget) * 100) : 0;
    return { qtdAcv, qtdTarget, gap, attainment };
  };

  const amerTotal = calcRegionTotal(amerAttainment);
  const emeaTotal = calcRegionTotal(emeaAttainment);
  const apacTotal = calcRegionTotal(apacAttainment);

  // Calculate product-region specific totals (for filtered views)
  const calcProductRegionTotal = (rows: any[], product: string, region: string) => {
    const filtered = rows.filter((r: any) => r.product === product && r.region === region);
    const qtdAcv = filtered.reduce((sum, r) => sum + (r.qtd_acv || 0), 0);
    const qtdTarget = filtered.reduce((sum, r) => sum + (r.qtd_target || 0), 0);
    const q1Target = filtered.reduce((sum, r) => sum + (r.q1_target || 0), 0);
    const gap = filtered.reduce((sum, r) => sum + (r.qtd_gap || 0), 0);
    const pipelineAcv = filtered.reduce((sum, r) => sum + (r.pipeline_acv || 0), 0);
    const remaining = q1Target - qtdAcv;
    const attainment = qtdTarget > 0 ? Math.round((qtdAcv / qtdTarget) * 100) : 0;
    const coverage = remaining > 0 ? Math.round((pipelineAcv / remaining) * 10) / 10 : 0;
    return { qtdAcv, qtdTarget, q1Target, gap, attainment, pipelineAcv, coverage };
  };

  // Pre-compute all product-region totals
  const porAmerTotal = calcProductRegionTotal(allAttainment, 'POR', 'AMER');
  const porEmeaTotal = calcProductRegionTotal(allAttainment, 'POR', 'EMEA');
  const porApacTotal = calcProductRegionTotal(allAttainment, 'POR', 'APAC');
  const r360AmerTotal = calcProductRegionTotal(allAttainment, 'R360', 'AMER');
  const r360EmeaTotal = calcProductRegionTotal(allAttainment, 'R360', 'EMEA');
  const r360ApacTotal = calcProductRegionTotal(allAttainment, 'R360', 'APAC');

  // Build regional summary sections (only for active regions)
  const buildRegionalSummary = () => {
    const sections: string[] = [];

    if (activeRegions.includes('AMER')) {
      sections.push(`### AMER Region Total
- QTD Actual: $${amerTotal.qtdAcv.toLocaleString()}
- QTD Target: $${amerTotal.qtdTarget.toLocaleString()}
- Attainment: ${amerTotal.attainment}%
- Gap: $${amerTotal.gap.toLocaleString()}`);
    }

    if (activeRegions.includes('EMEA')) {
      sections.push(`### EMEA Region Total
- QTD Actual: $${emeaTotal.qtdAcv.toLocaleString()}
- QTD Target: $${emeaTotal.qtdTarget.toLocaleString()}
- Attainment: ${emeaTotal.attainment}%
- Gap: $${emeaTotal.gap.toLocaleString()}`);
    }

    if (activeRegions.includes('APAC')) {
      sections.push(`### APAC Region Total
- QTD Actual: $${apacTotal.qtdAcv.toLocaleString()}
- QTD Target: $${apacTotal.qtdTarget.toLocaleString()}
- Attainment: ${apacTotal.attainment}%
- Gap: $${apacTotal.gap.toLocaleString()}`);
    }

    return sections.join('\n\n');
  };

  // Build regional segment detail sections (only for active regions)
  const buildRegionalDetail = () => {
    const sections: string[] = [];

    if (activeRegions.includes('AMER')) {
      const amerDetail = amerAttainment.map((row: any) =>
        `- ${row.product} ${row.category}: QTD Actual $${(row.qtd_acv || 0).toLocaleString()}, QTD Target $${(row.qtd_target || 0).toLocaleString()}, ${row.qtd_attainment_pct}% attainment, Gap $${(row.qtd_gap || 0).toLocaleString()}, ${row.pipeline_coverage_x}x coverage, RAG: ${row.rag_status}`
      ).join('\n') || 'No AMER data';
      sections.push(`## AMER Segment Detail (USE THESE QTD VALUES)\n${amerDetail}`);
    }

    if (activeRegions.includes('EMEA')) {
      const emeaDetail = emeaAttainment.map((row: any) =>
        `- ${row.product} ${row.category}: QTD Actual $${(row.qtd_acv || 0).toLocaleString()}, QTD Target $${(row.qtd_target || 0).toLocaleString()}, ${row.qtd_attainment_pct}% attainment, Gap $${(row.qtd_gap || 0).toLocaleString()}, ${row.pipeline_coverage_x}x coverage, RAG: ${row.rag_status}`
      ).join('\n') || 'No EMEA data';
      sections.push(`## EMEA Segment Detail (USE THESE QTD VALUES)\n${emeaDetail}`);
    }

    if (activeRegions.includes('APAC')) {
      const apacDetail = apacAttainment.map((row: any) =>
        `- ${row.product} ${row.category}: QTD Actual $${(row.qtd_acv || 0).toLocaleString()}, QTD Target $${(row.qtd_target || 0).toLocaleString()}, ${row.qtd_attainment_pct}% attainment, Gap $${(row.qtd_gap || 0).toLocaleString()}, ${row.pipeline_coverage_x}x coverage, RAG: ${row.rag_status}`
      ).join('\n') || 'No APAC data';
      sections.push(`## APAC Segment Detail (USE THESE QTD VALUES)\n${apacDetail}`);
    }

    return sections.join('\n\n');
  };

  // Compute derived metrics for richer analysis
  const totalQtdAcv = grand_total?.total_qtd_acv || 0;
  const totalQ1Target = grand_total?.total_q1_target || 0;
  const daysElapsed = period?.days_elapsed || 1;
  const daysRemaining = period?.days_remaining || 68;
  const dailyRunRate = totalQtdAcv / daysElapsed;
  const requiredDailyRate = (totalQ1Target - totalQtdAcv) / daysRemaining;
  const projectedQ1 = totalQtdAcv + (dailyRunRate * daysRemaining);
  const projectedAttainment = totalQ1Target > 0 ? Math.round((projectedQ1 / totalQ1Target) * 100) : 0;

  const porQtdAcv = porTotal.total_qtd_acv || 0;
  const r360QtdAcv = r360Total.total_qtd_acv || 0;
  const porQ1Target = porTotal.total_q1_target || 0;
  const r360Q1Target = r360Total.total_q1_target || 0;
  const porDailyRate = porQtdAcv / daysElapsed;
  const r360DailyRate = r360QtdAcv / daysElapsed;
  const porProjected = porQtdAcv + (porDailyRate * daysRemaining);
  const r360Projected = r360QtdAcv + (r360DailyRate * daysRemaining);

  // Identify top source gaps
  const allSourceGaps = [...sourceAttainmentData.POR.map((r: any) => ({...r, product: 'POR'})), ...sourceAttainmentData.R360.map((r: any) => ({...r, product: 'R360'}))];
  const topGaps = allSourceGaps.filter((r: any) => r.gap < 0).sort((a: any, b: any) => a.gap - b.gap).slice(0, 10);
  const topOverperformers = allSourceGaps.filter((r: any) => r.attainment_pct > 120 && r.q1_target > 10000).sort((a: any, b: any) => b.gap - a.gap).slice(0, 5);

  // Identify worst funnel bottlenecks
  const allFunnelRows = [...funnelBySourceData.POR.map((r: any) => ({...r, product: 'POR'})), ...funnelBySourceData.R360.map((r: any) => ({...r, product: 'R360'}))];
  const worstSqoPacing = allFunnelRows.filter((r: any) => (r.q1_target_sqo || 0) > 5).sort((a: any, b: any) => (a.sqo_pacing_pct || 0) - (b.sqo_pacing_pct || 0)).slice(0, 5);

  // Build comprehensive context
  const productDescription = includePOR && includeR360
    ? 'two products: POR (rental management) and R360 (asset inspection)'
    : includePOR
      ? 'POR (rental management software)'
      : 'R360 (asset inspection software)';

  const prompt = `You are a senior Revenue Operations analyst at a B2B SaaS company (Point of Rental Software). You are reviewing Q1 2026 Bookings performance data for ${productDescription}.

Provide a comprehensive, data-driven analysis. Frame ALL suggested actions as RECOMMENDATIONS (never "actions" or "next steps"). Be specific with dollar amounts, percentages, and segment names. Every insight must reference the data provided.

---

## REQUIRED OUTPUT SECTIONS

### 1. EXECUTIVE SUMMARY (3-4 sentences)
- Overall Q1 trajectory: on-track, at-risk, or behind
- Current daily run rate vs required daily rate to hit target
- Biggest single risk factor with dollar impact
${includePOR && includeR360 ? '- Product divergence summary (POR vs R360)' : `- Regional performance summary for ${includePOR ? 'POR' : 'R360'}`}

### 2. REVENUE ATTAINMENT DEEP DIVE
For ${includePOR && includeR360 ? 'each product (POR, R360)' : includePOR ? 'POR' : 'R360'} by region:
- Current attainment % vs QTD target
- Segment-level performance ranking (best to worst)
- Concentration risk: which segments are carrying the load vs dragging
- Win rate analysis and deal velocity indicators

### 3. CHANNEL PERFORMANCE ANALYSIS
Using the Source Channel Attainment AND UTM Source/Keyword/Branded data:
- Rank ALL channels by dollar gap (largest miss first)
- Identify RED channels (below 50% attainment) with dollar impact
- Identify YELLOW channels (50-80% attainment) with recovery potential
- Identify overperforming channels (above 120%) as acceleration opportunities
- UTM source breakdown: which sources drive the most MQLs AND SQOs
- Branded vs Non-Branded keyword performance: conversion rate differences, volume split
- Channel diversification risk: over-reliance on any single source
- Channel mix recommendations by product

### 4. FUNNEL HEALTH & VELOCITY
- Stage-by-stage conversion analysis (MQL→SQL→SAL→SQO)
- Identify the worst funnel bottleneck by source and region
- Compare conversion rates across sources (which sources produce highest quality leads)
- Funnel pacing vs plan: where is top-of-funnel vs bottom-of-funnel relative to targets
- Lead quality indicators: MQL reversion rates, stall rates

### 5. FUNNEL DROPOFF ANALYSIS BY SOURCE (CRITICAL FOR MARKETING INSIGHTS)
For EACH funnel stage (MQL, SQL, SAL, SQO), analyze dropoffs by SOURCE CHANNEL:
- **Paid vs Organic Performance**: Compare conversion and dropoff rates between paid (Inbound/PPC) vs organic sources
  - Which channel type has higher quality leads (lower dropoff rate)?
  - Where is paid spend being wasted (high dropoff after MQL)?
- **Source-Level Dropoff Rates**: For each source (Inbound, Outbound, AE Sourced, etc.):
  - Total leads, conversion rate, loss rate, ACV at risk
  - Identify worst-performing sources by loss rate
  - Identify best-performing sources for replication
- **UTM Campaign/Keyword Dropoff Patterns**: Cross-reference with UTM data to identify:
  - Which campaigns/keywords generate leads that DROP OFF vs CONVERT
  - High-volume keywords with low conversion (wasted spend indicators)
  - High-converting keywords that deserve more budget
- **Top Dropoff Reasons by Source**: For each major source, what are the primary loss reasons?
  - Are paid leads dropping due to "Not Qualified" (targeting issue)?
  - Are organic leads dropping due to "Unresponsive" (nurture issue)?
- **Stage-specific source insights**:
  - MQL: Which sources have highest reversion rates? (lead quality signal)
  - SQL: Which sources stall most at SQL? (qualification accuracy)
  - SQO: Which sources lose most deals? (deal quality signal)
- **Budget Reallocation Signal**: Based on source performance, recommend:
  - Sources to invest MORE in (high conversion, low dropoff)
  - Sources to REDUCE spend on (high dropoff, low conversion)
  - Sources needing process improvement (decent volume but high dropoff)

### 6. PIPELINE RISK ASSESSMENT
- Coverage adequacy by segment (need 3x for healthy, below 2x is critical)
- Pipeline aging: segments with avg age >60 days (stale pipeline risk)
- Pipeline quality: segments marked "AT RISK" or "CRITICAL"
- Close probability: given current win rates, how much pipeline will actually close

### 7. WIN/LOSS PATTERN ANALYSIS
- Top loss reasons ranked by dollar impact
- Winnable losses: losses due to process failures (unresponsive, timing) vs market (competition, pricing)
- Loss rate trends by region and product
- Loss concentration: are losses concentrated in specific segments or distributed

### 8. MARKETING & CHANNEL EFFICIENCY
- Google Ads ROI by region: CPA relative to average deal size
- Spend efficiency: regions with highest/lowest conversion rates
- UTM keyword effectiveness: top converting keywords by MQL→SQO rate
- Branded vs Non-Branded: compare conversion quality and volume contribution
- Channel cost-effectiveness ranking
- Recommendations for budget reallocation based on UTM and Ads data

### 9. PREDICTIVE INDICATORS & FORECAST
- Current daily run rate: $${Math.round(dailyRunRate).toLocaleString()}/day
- Required daily rate to hit Q1 target: $${Math.round(requiredDailyRate).toLocaleString()}/day
- Projected Q1 close (at current pace): $${Math.round(projectedQ1).toLocaleString()} (${projectedAttainment}% of target)
${includePOR ? `- POR projected: $${Math.round(porProjected).toLocaleString()} vs $${Math.round(porQ1Target).toLocaleString()} target` : ''}
${includeR360 ? `- R360 projected: $${Math.round(r360Projected).toLocaleString()} vs $${Math.round(r360Q1Target).toLocaleString()} target` : ''}
- Pipeline sufficiency: is there enough pipeline to close the remaining gap?
- Risk-adjusted forecast considering win rates and pipeline age

### 10. PRIORITIZED RECOMMENDATIONS
Provide 5-7 specific recommendations. Each recommendation MUST be a single dense sentence that includes ALL of the following inline:
- Priority prefix (P1/P2/P3)
- The word "Recommend" followed by the specific action
- The metric/data that justifies it (e.g., "to close the $128K EMEA gap", "given 42% attainment vs 75% target")
- Expected quantified impact (e.g., "recovering ~$50K in bookings", "improving pacing by 15 points")
- Owner and Timeframe at the end separated by semicolons

FORMAT EACH RECOMMENDATION - CRITICAL BOLD FORMATTING:

Each recommendation MUST be formatted EXACTLY like this (copy this pattern):
- **P1 – Recommend [action]; expected impact: [impact]; Owner: [owner]; Timeframe: [time].**

Character-by-character: dash SPACE asterisk asterisk P 1 SPACE ... period asterisk asterisk

EXAMPLES OF CORRECT OUTPUT:
- **P1 – Recommend reallocating AE focus to close $58K gap; expected impact: ~$30K bookings; Owner: Sales Leadership; Timeframe: Q1.**
- **P2 – Recommend scaling branded keywords; expected impact: +$25K pipeline; Owner: Marketing; Timeframe: Immediate.**

DO NOT OUTPUT ANY OF THESE WRONG FORMATS:
- *P1 – ...* (WRONG - single asterisks = italic)
- *P1 – ...** (WRONG - mismatched asterisks)
- P1 – ... (WRONG - no formatting)

VALIDATION: Count the asterisks. There must be exactly 2 at the start (after "- ") and exactly 2 at the end (before newline).

---

## FORMATTING RULES (CRITICAL - APPLY TO ALL 10 SECTIONS)
- NEVER write paragraph blobs or flat bullet lists. EVERY section MUST use multi-level bullets with sub-bullets.
- **MANDATORY STRUCTURE FOR SECTIONS 2-9:**
  - Top-level bullet: "- **Bold Label:** key insight or finding"
  - Sub-bullets (REQUIRED): "  - supporting metric, data point, or implication" (indent with 2 spaces)
  - Each top-level bullet MUST have 1-3 sub-bullets with specific data
- Section 1 (Executive Summary): Use 4 SHORT bullet points, one per line:
  - **Overall Status**: [Product Region] is [on-track/at-risk/behind] with [X]% QTD attainment ([GREEN/YELLOW/RED])
  - **Key Numbers**: $X QTD actual vs $Y QTD target, QTD gap: $Z
  - **Biggest Risk**: [Segment] at [X]% QTD attainment ([COLOR])
  - **Action Needed**: [One sentence on priority action]
- Section 10 (Recommendations): BOLD flat bullets starting with "- **P[1-3] – Recommend..." and ending with "**"
- **STRUCTURE FOR SECTIONS 2-9 (multi-level bullets with sub-bullets):**
  - Top-level bullet: "- **[Label from data]:** [key insight with specific metric]"
  - Sub-bullets (REQUIRED): "  - [supporting metric or implication]" (indent with 2 spaces)
  - EVERY top-level bullet MUST have 1-3 sub-bullets with specific data from the context above

- Always include specific dollar amounts and percentages in sub-bullets.
- Rank items by dollar impact (largest first).
- Be direct and honest - do not sugarcoat underperformance.
- Frame suggestions as "Recommend..." not "Action:" or "Next step:".

## METRIC FORMATTING RULES (CRITICAL)
- **EVERY metric MUST include both actual and target values** for context. Format as: "$X QTD actual vs $Y QTD target" or "X% QTD attainment"
- **Always include QTD attainment percentage** after dollar amounts: "$97K QTD actual vs $215K QTD target (45% QTD attainment)"
- **Always include QTD gap** when showing variance: "QTD gap: -$110K" or "QTD gap: +$15K"
- **For pipeline metrics**: Include coverage ratio: "2.5x QTD coverage" with health indicator
- **For funnel metrics**: Show actual/target with pacing: "45 QTD MQLs vs 83 QTD target (54% QTD pacing)"
- **RAG status format**: Use simple "RED", "YELLOW", or "GREEN" labels only. Do NOT use complex formats like "RAG HIGH>RED".
- **Attainment COLOR CODING**: >=100% = GREEN, 70-99% = YELLOW, <70% = RED. Color code every attainment percentage.
- **NEVER compare attainment to quarter progress %** - ONLY show QTD attainment (actual vs QTD target). Do NOT say "at 28% quarter progress" or "vs 27.8% benchmark". Just show the attainment %.
- **NEVER show a metric without its QTD target or attainment context** - readers must know if the number is good or bad

**REMINDER: Every bullet in sections 2-9 needs sub-bullets. If you write a flat bullet list without indented sub-bullets, the output is INVALID.**

## Filter Context
${filterDescription}

## Current Period
- As of Date: ${period?.as_of_date || 'N/A'}
- Quarter Progress: ${period?.quarter_pct_complete || 0}% complete
- Days Elapsed: ${period?.days_elapsed || 0} of ${period?.total_days || 90}

## Grand Total Performance
- Q1 Target: $${(grand_total?.total_q1_target || 0).toLocaleString()}
- QTD Target: $${(grand_total?.total_qtd_target || 0).toLocaleString()}
- QTD Actual: $${(grand_total?.total_qtd_acv || 0).toLocaleString()}

## REGIONAL SUMMARY (USE THESE NUMBERS)
${buildRegionalSummary()}

## PRE-COMPUTED PRODUCT-REGION TOTALS (USE THESE EXACT NUMBERS - DO NOT CALCULATE)
${includePOR && activeRegions.includes('AMER') ? `### POR AMER Total
- QTD Actual: $${porAmerTotal.qtdAcv.toLocaleString()}
- QTD Target: $${porAmerTotal.qtdTarget.toLocaleString()}
- Q1 Target: $${porAmerTotal.q1Target.toLocaleString()}
- QTD Attainment: ${porAmerTotal.attainment}%
- QTD Gap: $${porAmerTotal.gap.toLocaleString()}
- Pipeline Coverage: ${porAmerTotal.coverage}x` : ''}

${includePOR && activeRegions.includes('EMEA') ? `### POR EMEA Total
- QTD Actual: $${porEmeaTotal.qtdAcv.toLocaleString()}
- QTD Target: $${porEmeaTotal.qtdTarget.toLocaleString()}
- Q1 Target: $${porEmeaTotal.q1Target.toLocaleString()}
- QTD Attainment: ${porEmeaTotal.attainment}%
- QTD Gap: $${porEmeaTotal.gap.toLocaleString()}
- Pipeline Coverage: ${porEmeaTotal.coverage}x` : ''}

${includePOR && activeRegions.includes('APAC') ? `### POR APAC Total
- QTD Actual: $${porApacTotal.qtdAcv.toLocaleString()}
- QTD Target: $${porApacTotal.qtdTarget.toLocaleString()}
- Q1 Target: $${porApacTotal.q1Target.toLocaleString()}
- QTD Attainment: ${porApacTotal.attainment}%
- QTD Gap: $${porApacTotal.gap.toLocaleString()}
- Pipeline Coverage: ${porApacTotal.coverage}x` : ''}

${includeR360 && activeRegions.includes('AMER') ? `### R360 AMER Total
- QTD Actual: $${r360AmerTotal.qtdAcv.toLocaleString()}
- QTD Target: $${r360AmerTotal.qtdTarget.toLocaleString()}
- Q1 Target: $${r360AmerTotal.q1Target.toLocaleString()}
- QTD Attainment: ${r360AmerTotal.attainment}%
- QTD Gap: $${r360AmerTotal.gap.toLocaleString()}
- Pipeline Coverage: ${r360AmerTotal.coverage}x` : ''}

${includeR360 && activeRegions.includes('EMEA') ? `### R360 EMEA Total
- QTD Actual: $${r360EmeaTotal.qtdAcv.toLocaleString()}
- QTD Target: $${r360EmeaTotal.qtdTarget.toLocaleString()}
- Q1 Target: $${r360EmeaTotal.q1Target.toLocaleString()}
- QTD Attainment: ${r360EmeaTotal.attainment}%
- QTD Gap: $${r360EmeaTotal.gap.toLocaleString()}
- Pipeline Coverage: ${r360EmeaTotal.coverage}x` : ''}

${includeR360 && activeRegions.includes('APAC') ? `### R360 APAC Total
- QTD Actual: $${r360ApacTotal.qtdAcv.toLocaleString()}
- QTD Target: $${r360ApacTotal.qtdTarget.toLocaleString()}
- Q1 Target: $${r360ApacTotal.q1Target.toLocaleString()}
- QTD Attainment: ${r360ApacTotal.attainment}%
- QTD Gap: $${r360ApacTotal.gap.toLocaleString()}
- Pipeline Coverage: ${r360ApacTotal.coverage}x` : ''}

${includePOR && activeRegions.length === 3 ? `## POR Performance (All Regions)
- Q1 Target: $${(porTotal.total_q1_target || 0).toLocaleString()}
- QTD Actual: $${(porTotal.total_qtd_acv || 0).toLocaleString()}
- Attainment: ${porTotal.total_qtd_attainment_pct || 0}%
- Pipeline Coverage: ${porTotal.total_pipeline_coverage_x || 0}x
- Lost Deals: ${porTotal.total_lost_deals || 0} worth $${(porTotal.total_lost_acv || 0).toLocaleString()}` : ''}

${includeR360 && activeRegions.length === 3 ? `## R360 Performance (All Regions)
- Q1 Target: $${(r360Total.total_q1_target || 0).toLocaleString()}
- QTD Actual: $${(r360Total.total_qtd_acv || 0).toLocaleString()}
- Attainment: ${r360Total.total_qtd_attainment_pct || 0}%
- Pipeline Coverage: ${r360Total.total_pipeline_coverage_x || 0}x
- Lost Deals: ${r360Total.total_lost_deals || 0} worth $${(r360Total.total_lost_acv || 0).toLocaleString()}` : ''}

${buildRegionalDetail()}

## Critical Misses (Below 70% Attainment)
${criticalMisses.length > 0 ? criticalMisses.map((row: any) =>
  `- ${row.product} ${row.region} ${row.category}: Only ${row.qtd_attainment_pct}% attainment, missing $${Math.abs(row.qtd_gap || 0).toLocaleString()}`
).join('\n') : 'No critical misses below 70%'}

${includePOR ? `## Funnel Performance (POR by Category)
${funnelData.POR.map((row: any) =>
  `- ${row.category} ${row.region}: MQL ${row.actual_mql}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct}%), SQL ${row.actual_sql}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct}%), SQO ${row.actual_sqo}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct}%)`
).join('\n')}` : ''}

${includeR360 ? `## Funnel Performance (R360 by Category - USE THESE EXACT NUMBERS)
${funnelData.R360.map((row: any) =>
  `- ${row.category} ${row.region}: MQL ${row.actual_mql}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct}% pacing), SQL ${row.actual_sql}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct}% pacing), SQO ${row.actual_sqo}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct}% pacing)`
).join('\n')}` : ''}

## Pipeline Health by Segment
${(includePOR ? (pipeline_rca?.POR || []) : []).concat(includeR360 ? (pipeline_rca?.R360 || []) : []).map((row: any) =>
  `- ${row.region} ${row.category}: $${(row.pipeline_acv || 0).toLocaleString()} pipeline, ${row.pipeline_coverage_x}x coverage, ${row.pipeline_avg_age_days} days avg age, Health: ${row.pipeline_health}`
).join('\n')}

## Loss Reasons by Product (Top Issues)
${includePOR ? `### POR Loss Reasons
${(loss_reason_rca?.POR || []).slice(0, 8).map((row: any) =>
  `- ${row.loss_reason} (${row.region}): ${row.deal_count} deals, $${(row.lost_acv || 0).toLocaleString()} lost`
).join('\n') || 'No POR loss data'}` : ''}

${includeR360 ? `### R360 Loss Reasons
${(loss_reason_rca?.R360 || []).slice(0, 8).map((row: any) =>
  `- ${row.loss_reason} (${row.region}): ${row.deal_count} deals, $${(row.lost_acv || 0).toLocaleString()} lost`
).join('\n') || 'No R360 loss data'}` : ''}

${includePOR ? `## Funnel Performance by Source (POR)
${funnelBySourceData.POR.map((row: any) =>
  `- ${row.source} (${row.region}): Target ACV $${(row.target_acv || 0).toLocaleString()}, MQL ${row.actual_mql}/${row.target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql}/${row.target_sql || 0} (${row.sql_pacing_pct || 0}%), SQO ${row.actual_sqo || 0}/${row.target_sqo || 0}, Conversion MQL→SQL: ${row.mql_to_sql_rate || 0}%`
).join('\n') || 'No POR source data'}` : ''}

${includeR360 ? `## Funnel Performance by Source (R360)
${funnelBySourceData.R360.map((row: any) =>
  `- ${row.source} (${row.region}): Target ACV $${(row.target_acv || 0).toLocaleString()}, MQL ${row.actual_mql}/${row.target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql}/${row.target_sql || 0} (${row.sql_pacing_pct || 0}%), SQO ${row.actual_sqo || 0}/${row.target_sqo || 0}, Conversion MQL→SQL: ${row.mql_to_sql_rate || 0}%`
).join('\n') || 'No R360 source data'}` : ''}

## MQL Disqualification/Reversion Summary
${includePOR ? `### POR MQL Status (MUTUALLY EXCLUSIVE - sums to 100%)
- Total MQLs: ${dqSummary.POR?.total_mqls || 0}
- Converted to SQL (success): ${dqSummary.POR?.converted_count || 0} (${dqSummary.POR?.converted_pct || 0}%)
- Reverted/Disqualified (lost): ${dqSummary.POR?.reverted_count || 0} (${dqSummary.POR?.reverted_pct || 0}%)
- Stalled >30 days (at risk): ${dqSummary.POR?.stalled_count || 0} (${dqSummary.POR?.stalled_pct || 0}%)
- In Progress (healthy pipeline): ${dqSummary.POR?.in_progress_count || dqSummary.POR?.active_count || 0} (${dqSummary.POR?.in_progress_pct || dqSummary.POR?.active_pct || 0}%)` : ''}

${includeR360 ? `### R360 MQL Status (MUTUALLY EXCLUSIVE - sums to 100%)
- Total MQLs: ${dqSummary.R360?.total_mqls || 0}
- Converted to SQL (success): ${dqSummary.R360?.converted_count || 0} (${dqSummary.R360?.converted_pct || 0}%)
- Reverted/Disqualified (lost): ${dqSummary.R360?.reverted_count || 0} (${dqSummary.R360?.reverted_pct || 0}%)
- Stalled >30 days (at risk): ${dqSummary.R360?.stalled_count || 0} (${dqSummary.R360?.stalled_pct || 0}%)
- In Progress (healthy pipeline): ${dqSummary.R360?.in_progress_count || dqSummary.R360?.active_count || 0} (${dqSummary.R360?.in_progress_pct || dqSummary.R360?.active_pct || 0}%)` : ''}

## Funnel Stage Dropoff Summary (USE THIS FOR DROPOFF ANALYSIS)
${includePOR ? `### POR Funnel Stage Stats & Dropoff Reasons
#### MQL Stage (Marketing Qualified Leads)
- Total: ${stageStats.mql.POR.total}, Converted: ${stageStats.mql.POR.converted} (${stageStats.mql.POR.conversionRate}%), Lost/Reverted: ${stageStats.mql.POR.lost} (${stageStats.mql.POR.lossRate}%)
**MQL Dropoff Reasons:**
${formatDropoffSummary(mqlDropoffs.POR)}
**MQL Paid vs Organic:**
- PAID: ${sourceDropoffs.mql.POR.byType.PAID?.total || 0} leads, ${sourceDropoffs.mql.POR.byType.PAID?.convRate || 0}% conv, ${sourceDropoffs.mql.POR.byType.PAID?.lossRate || 0}% loss
- ORGANIC: ${sourceDropoffs.mql.POR.byType.ORGANIC?.total || 0} leads, ${sourceDropoffs.mql.POR.byType.ORGANIC?.convRate || 0}% conv, ${sourceDropoffs.mql.POR.byType.ORGANIC?.lossRate || 0}% loss
- OTHER: ${sourceDropoffs.mql.POR.byType.OTHER?.total || 0} leads, ${sourceDropoffs.mql.POR.byType.OTHER?.convRate || 0}% conv, ${sourceDropoffs.mql.POR.byType.OTHER?.lossRate || 0}% loss
**MQL by Source Channel (sorted by loss rate):**
${formatSourceDropoffSummary(sourceDropoffs.mql.POR.bySource)}

#### SQL Stage (Sales Qualified Leads)
- Total: ${stageStats.sql.POR.total}, Converted: ${stageStats.sql.POR.converted} (${stageStats.sql.POR.conversionRate}%), Lost: ${stageStats.sql.POR.lost} (${stageStats.sql.POR.lossRate}%), ACV Lost: $${stageStats.sql.POR.lostAcv.toLocaleString()}
**SQL Dropoff Reasons:**
${formatDropoffSummary(sqlDropoffs.POR)}
**SQL Paid vs Organic:**
- PAID: ${sourceDropoffs.sql.POR.byType.PAID?.total || 0} leads, ${sourceDropoffs.sql.POR.byType.PAID?.convRate || 0}% conv, ${sourceDropoffs.sql.POR.byType.PAID?.lossRate || 0}% loss, $${(sourceDropoffs.sql.POR.byType.PAID?.lostAcv || 0).toLocaleString()} lost
- ORGANIC: ${sourceDropoffs.sql.POR.byType.ORGANIC?.total || 0} leads, ${sourceDropoffs.sql.POR.byType.ORGANIC?.convRate || 0}% conv, ${sourceDropoffs.sql.POR.byType.ORGANIC?.lossRate || 0}% loss, $${(sourceDropoffs.sql.POR.byType.ORGANIC?.lostAcv || 0).toLocaleString()} lost
- OTHER: ${sourceDropoffs.sql.POR.byType.OTHER?.total || 0} leads, ${sourceDropoffs.sql.POR.byType.OTHER?.convRate || 0}% conv, ${sourceDropoffs.sql.POR.byType.OTHER?.lossRate || 0}% loss, $${(sourceDropoffs.sql.POR.byType.OTHER?.lostAcv || 0).toLocaleString()} lost
**SQL by Source Channel (sorted by loss rate):**
${formatSourceDropoffSummary(sourceDropoffs.sql.POR.bySource)}

#### SAL Stage (Sales Accepted Leads - POR Only)
- Total: ${stageStats.sal.POR.total}, Converted: ${stageStats.sal.POR.converted} (${stageStats.sal.POR.conversionRate}%), Lost: ${stageStats.sal.POR.lost} (${stageStats.sal.POR.lossRate}%), ACV Lost: $${stageStats.sal.POR.lostAcv.toLocaleString()}
**SAL Dropoff Reasons:**
${formatDropoffSummary(salDropoffs.POR)}
**SAL Paid vs Organic:**
- PAID: ${sourceDropoffs.sal.POR.byType.PAID?.total || 0} leads, ${sourceDropoffs.sal.POR.byType.PAID?.convRate || 0}% conv, ${sourceDropoffs.sal.POR.byType.PAID?.lossRate || 0}% loss, $${(sourceDropoffs.sal.POR.byType.PAID?.lostAcv || 0).toLocaleString()} lost
- ORGANIC: ${sourceDropoffs.sal.POR.byType.ORGANIC?.total || 0} leads, ${sourceDropoffs.sal.POR.byType.ORGANIC?.convRate || 0}% conv, ${sourceDropoffs.sal.POR.byType.ORGANIC?.lossRate || 0}% loss, $${(sourceDropoffs.sal.POR.byType.ORGANIC?.lostAcv || 0).toLocaleString()} lost
- OTHER: ${sourceDropoffs.sal.POR.byType.OTHER?.total || 0} leads, ${sourceDropoffs.sal.POR.byType.OTHER?.convRate || 0}% conv, ${sourceDropoffs.sal.POR.byType.OTHER?.lossRate || 0}% loss, $${(sourceDropoffs.sal.POR.byType.OTHER?.lostAcv || 0).toLocaleString()} lost
**SAL by Source Channel (sorted by loss rate):**
${formatSourceDropoffSummary(sourceDropoffs.sal.POR.bySource)}

#### SQO Stage (Sales Qualified Opportunities)
- Total: ${stageStats.sqo.POR.total}, Won: ${stageStats.sqo.POR.converted} (${stageStats.sqo.POR.conversionRate}%), Lost: ${stageStats.sqo.POR.lost} (${stageStats.sqo.POR.lossRate}%), ACV Lost: $${stageStats.sqo.POR.lostAcv.toLocaleString()}
**SQO Dropoff/Loss Reasons:**
${formatDropoffSummary(sqoDropoffs.POR)}
**SQO Paid vs Organic:**
- PAID: ${sourceDropoffs.sqo.POR.byType.PAID?.total || 0} opps, ${sourceDropoffs.sqo.POR.byType.PAID?.convRate || 0}% won, ${sourceDropoffs.sqo.POR.byType.PAID?.lossRate || 0}% lost, $${(sourceDropoffs.sqo.POR.byType.PAID?.lostAcv || 0).toLocaleString()} ACV lost
- ORGANIC: ${sourceDropoffs.sqo.POR.byType.ORGANIC?.total || 0} opps, ${sourceDropoffs.sqo.POR.byType.ORGANIC?.convRate || 0}% won, ${sourceDropoffs.sqo.POR.byType.ORGANIC?.lossRate || 0}% lost, $${(sourceDropoffs.sqo.POR.byType.ORGANIC?.lostAcv || 0).toLocaleString()} ACV lost
- OTHER: ${sourceDropoffs.sqo.POR.byType.OTHER?.total || 0} opps, ${sourceDropoffs.sqo.POR.byType.OTHER?.convRate || 0}% won, ${sourceDropoffs.sqo.POR.byType.OTHER?.lossRate || 0}% lost, $${(sourceDropoffs.sqo.POR.byType.OTHER?.lostAcv || 0).toLocaleString()} ACV lost
**SQO by Source Channel (sorted by loss rate):**
${formatSourceDropoffSummary(sourceDropoffs.sqo.POR.bySource)}
` : ''}

${includeR360 ? `### R360 Funnel Stage Stats & Dropoff Reasons
#### MQL Stage
- Total: ${stageStats.mql.R360.total}, Converted: ${stageStats.mql.R360.converted} (${stageStats.mql.R360.conversionRate}%), Lost/Reverted: ${stageStats.mql.R360.lost} (${stageStats.mql.R360.lossRate}%)
**MQL Dropoff Reasons:**
${formatDropoffSummary(mqlDropoffs.R360)}
**MQL Paid vs Organic:**
- PAID: ${sourceDropoffs.mql.R360.byType.PAID?.total || 0} leads, ${sourceDropoffs.mql.R360.byType.PAID?.convRate || 0}% conv, ${sourceDropoffs.mql.R360.byType.PAID?.lossRate || 0}% loss
- ORGANIC: ${sourceDropoffs.mql.R360.byType.ORGANIC?.total || 0} leads, ${sourceDropoffs.mql.R360.byType.ORGANIC?.convRate || 0}% conv, ${sourceDropoffs.mql.R360.byType.ORGANIC?.lossRate || 0}% loss
- OTHER: ${sourceDropoffs.mql.R360.byType.OTHER?.total || 0} leads, ${sourceDropoffs.mql.R360.byType.OTHER?.convRate || 0}% conv, ${sourceDropoffs.mql.R360.byType.OTHER?.lossRate || 0}% loss
**MQL by Source Channel (sorted by loss rate):**
${formatSourceDropoffSummary(sourceDropoffs.mql.R360.bySource)}

#### SQL Stage
- Total: ${stageStats.sql.R360.total}, Converted: ${stageStats.sql.R360.converted} (${stageStats.sql.R360.conversionRate}%), Lost: ${stageStats.sql.R360.lost} (${stageStats.sql.R360.lossRate}%), ACV Lost: $${stageStats.sql.R360.lostAcv.toLocaleString()}
**SQL Dropoff Reasons:**
${formatDropoffSummary(sqlDropoffs.R360)}
**SQL Paid vs Organic:**
- PAID: ${sourceDropoffs.sql.R360.byType.PAID?.total || 0} leads, ${sourceDropoffs.sql.R360.byType.PAID?.convRate || 0}% conv, ${sourceDropoffs.sql.R360.byType.PAID?.lossRate || 0}% loss, $${(sourceDropoffs.sql.R360.byType.PAID?.lostAcv || 0).toLocaleString()} lost
- ORGANIC: ${sourceDropoffs.sql.R360.byType.ORGANIC?.total || 0} leads, ${sourceDropoffs.sql.R360.byType.ORGANIC?.convRate || 0}% conv, ${sourceDropoffs.sql.R360.byType.ORGANIC?.lossRate || 0}% loss, $${(sourceDropoffs.sql.R360.byType.ORGANIC?.lostAcv || 0).toLocaleString()} lost
- OTHER: ${sourceDropoffs.sql.R360.byType.OTHER?.total || 0} leads, ${sourceDropoffs.sql.R360.byType.OTHER?.convRate || 0}% conv, ${sourceDropoffs.sql.R360.byType.OTHER?.lossRate || 0}% loss, $${(sourceDropoffs.sql.R360.byType.OTHER?.lostAcv || 0).toLocaleString()} lost
**SQL by Source Channel (sorted by loss rate):**
${formatSourceDropoffSummary(sourceDropoffs.sql.R360.bySource)}

#### SQO Stage
- Total: ${stageStats.sqo.R360.total}, Won: ${stageStats.sqo.R360.converted} (${stageStats.sqo.R360.conversionRate}%), Lost: ${stageStats.sqo.R360.lost} (${stageStats.sqo.R360.lossRate}%), ACV Lost: $${stageStats.sqo.R360.lostAcv.toLocaleString()}
**SQO Dropoff/Loss Reasons:**
${formatDropoffSummary(sqoDropoffs.R360)}
**SQO Paid vs Organic:**
- PAID: ${sourceDropoffs.sqo.R360.byType.PAID?.total || 0} opps, ${sourceDropoffs.sqo.R360.byType.PAID?.convRate || 0}% won, ${sourceDropoffs.sqo.R360.byType.PAID?.lossRate || 0}% lost, $${(sourceDropoffs.sqo.R360.byType.PAID?.lostAcv || 0).toLocaleString()} ACV lost
- ORGANIC: ${sourceDropoffs.sqo.R360.byType.ORGANIC?.total || 0} opps, ${sourceDropoffs.sqo.R360.byType.ORGANIC?.convRate || 0}% won, ${sourceDropoffs.sqo.R360.byType.ORGANIC?.lossRate || 0}% lost, $${(sourceDropoffs.sqo.R360.byType.ORGANIC?.lostAcv || 0).toLocaleString()} ACV lost
- OTHER: ${sourceDropoffs.sqo.R360.byType.OTHER?.total || 0} opps, ${sourceDropoffs.sqo.R360.byType.OTHER?.convRate || 0}% won, ${sourceDropoffs.sqo.R360.byType.OTHER?.lossRate || 0}% lost, $${(sourceDropoffs.sqo.R360.byType.OTHER?.lostAcv || 0).toLocaleString()} ACV lost
**SQO by Source Channel (sorted by loss rate):**
${formatSourceDropoffSummary(sourceDropoffs.sqo.R360.bySource)}
` : ''}

## Google Ads Performance
${includePOR ? `### POR Ads
${googleAdsData.POR.map((row: any) =>
  `- ${row.region}: $${(row.ad_spend_usd || 0).toLocaleString()} spend, ${row.clicks || 0} clicks, ${row.conversions || 0} conversions, CPA: $${row.cpa_usd || 'N/A'}`
).join('\n') || 'No POR ads data'}` : ''}

${includeR360 ? `### R360 Ads
${googleAdsData.R360.map((row: any) =>
  `- ${row.region}: $${(row.ad_spend_usd || 0).toLocaleString()} spend, ${row.clicks || 0} clicks, ${row.conversions || 0} conversions, CPA: $${row.cpa_usd || 'N/A'}`
).join('\n') || 'No R360 ads data'}` : ''}

## UTM Source Analysis (Lead Origin Tracking)
${includePOR ? `### POR - By UTM Source (Top 10)
${utmSourcePOR.length > 0 ? utmSourcePOR.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM source data'}` : ''}

${includeR360 ? `### R360 - By UTM Source (Top 10)
${utmSourceR360.length > 0 ? utmSourceR360.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM source data'}` : ''}

## UTM Keyword Analysis
${includePOR ? `### POR - By UTM Keyword (Top 10)
${utmKeywordPOR.length > 0 ? utmKeywordPOR.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM keyword data'}` : ''}

${includeR360 ? `### R360 - By UTM Keyword (Top 10)
${utmKeywordR360.length > 0 ? utmKeywordR360.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM keyword data'}` : ''}

## Branded vs Non-Branded Keyword Analysis
${includePOR ? `### POR - Branded vs Non-Branded
${brandedPOR.length > 0 ? brandedPOR.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs (${s.total > 0 ? Math.round((s.total / (brandedPOR.reduce((sum: number, x: any) => sum + x.total, 0) || 1)) * 100) : 0}% of total), ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No branded/non-branded data'}` : ''}

${includeR360 ? `### R360 - Branded vs Non-Branded
${brandedR360.length > 0 ? brandedR360.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs (${s.total > 0 ? Math.round((s.total / (brandedR360.reduce((sum: number, x: any) => sum + x.total, 0) || 1)) * 100) : 0}% of total), ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No branded/non-branded data'}` : ''}

## Source Channel Attainment (Revenue by Source)
${includePOR ? `### POR by Source
${sourceAttainmentData.POR.map((row: any) =>
  `- ${row.source} (${row.region}): Q1 Target $${(row.q1_target || 0).toLocaleString()}, QTD Target $${(row.qtd_target || 0).toLocaleString()}, QTD Actual $${(row.qtd_acv || 0).toLocaleString()}, Attainment ${row.attainment_pct || 0}%, Gap $${(row.gap || 0).toLocaleString()}, RAG: ${row.rag_status || 'N/A'}`
).join('\n') || 'No POR source attainment data'}` : ''}

${includeR360 ? `### R360 by Source (USE THESE EXACT VALUES)
${sourceAttainmentData.R360.map((row: any) =>
  `- ${row.source} (${row.region}): Q1 Target $${(row.q1_target || 0).toLocaleString()}, QTD Target $${(row.qtd_target || 0).toLocaleString()}, QTD Actual $${(row.qtd_acv || 0).toLocaleString()}, Attainment ${row.attainment_pct || 0}%, Gap $${(row.gap || 0).toLocaleString()}, RAG: ${row.rag_status || 'N/A'}`
).join('\n') || 'No R360 source attainment data'}` : ''}

## PRE-COMPUTED KEY INSIGHTS (use these to anchor your analysis)

### Top Revenue Gaps (sorted by dollar impact)
${topGaps.map((r: any) => `- ${r.product} ${r.source} (${r.region}): -$${Math.abs(r.gap || 0).toLocaleString()} gap, ${r.attainment_pct || 0}% attainment, RAG: ${r.rag_status}`).join('\n') || 'No gaps identified'}

### Overperforming Channels (>120% attainment, >$10K target)
${topOverperformers.map((r: any) => `- ${r.product} ${r.source} (${r.region}): +$${(r.gap || 0).toLocaleString()} surplus, ${r.attainment_pct || 0}% attainment`).join('\n') || 'No overperformers identified'}

### Worst Funnel Bottlenecks (lowest SQO pacing)
${worstSqoPacing.map((r: any) => `- ${r.product} ${r.source} (${r.region}): SQO pacing ${r.sqo_pacing_pct || 0}%, SQL pacing ${r.sql_pacing_pct || 0}%, MQL→SQL rate ${r.mql_to_sql_rate || 0}%`).join('\n') || 'No bottlenecks identified'}

### Projection Summary
- Daily run rate: $${Math.round(dailyRunRate).toLocaleString()}/day (${daysElapsed} days elapsed)
- Required rate: $${Math.round(requiredDailyRate).toLocaleString()}/day (${daysRemaining} days remaining)
- Projected Q1: $${Math.round(projectedQ1).toLocaleString()} (${projectedAttainment}% of $${Math.round(totalQ1Target).toLocaleString()} target)
${includePOR ? `- POR projected: $${Math.round(porProjected).toLocaleString()} (${porQ1Target > 0 ? Math.round((porProjected / porQ1Target) * 100) : 0}% of target)` : ''}
${includeR360 ? `- R360 projected: $${Math.round(r360Projected).toLocaleString()} (${r360Q1Target > 0 ? Math.round((r360Projected / r360Q1Target) * 100) : 0}% of target)` : ''}

## CRITICAL RULES
1. PRODUCE ALL 10 SECTIONS - do not skip any section. Each section must be DETAILED and COMPREHENSIVE.
2. **ZERO TOLERANCE FOR FABRICATED NUMBERS**: You MUST use ONLY the exact numbers provided in the data sections above. NEVER calculate, derive, estimate, or round numbers yourself. If you output a number that differs from what's in the data context, the ENTIRE response will be rejected.
3. **NEVER CALCULATE QTD TARGETS**: The QTD Target values are PRE-COMPUTED and provided directly. DO NOT derive QTD targets by multiplying Q1 targets by quarter percentage. Use ONLY the "QTD Target" values shown in each data row. This is CRITICAL - calculating your own QTD targets will produce WRONG numbers.
4. ALL METRICS MUST BE EXPLICITLY QTD: Every attainment %, variance %, dollar amount, and count MUST be labeled as QTD. Examples: "QTD attainment: 56%", "$141K QTD actual", "QTD gap: -$110K", "12 QTD deals". NEVER show a metric without the QTD prefix/suffix.
5. **USE PRE-COMPUTED TOTALS FOR EXECUTIVE SUMMARY**: When a region filter is applied (e.g., AMER only), the Executive Summary MUST use values from "PRE-COMPUTED PRODUCT-REGION TOTALS" section. For example, for "R360 AMER" filter, use "R360 AMER Total" values ONLY - do NOT use general "R360 Performance" values which include all regions. The Executive Summary QTD Actual, QTD Target, and Attainment MUST match the filtered product-region total EXACTLY.
6. **DO NOT MIX FILTERED AND UNFILTERED DATA**: When analyzing a specific region (e.g., AMER), NEVER cite numbers from unfiltered "Product Performance" sections. Only use data from the PRE-COMPUTED PRODUCT-REGION TOTALS and the Regional Segment Detail sections that match the filter.
7. Frame ALL actions as "Recommend:" not "Action:" or "Next step:" or "Consider:"
8. COLOR CODING: Use simple color words only: GREEN (>=100% attainment), YELLOW (70-99%), RED (<70%). Write "(GREEN)" or "(YELLOW)" or "(RED)" after each attainment %. NEVER write "HIGH>RED" or "MEDIUM>YELLOW" - just the color word.
9. For channel analysis: ALWAYS rank by dollar gap, ALWAYS identify RED channels by name, explain WHY each channel is underperforming
10. NEVER say "no UTM data available", "insufficient data", or "underperforming channels not identified" - the UTM Source, UTM Keyword, Branded/Non-Branded, and Source Channel Attainment sections have COMPLETE data. USE THEM.
11. Pipeline coverage: 3x+ = healthy, 2-3x = adequate, <2x = critical risk. Quantify the dollar risk.
12. Be DIRECT about underperformance - if a segment is failing, say so clearly with the dollar impact AND root cause hypothesis
13. Each recommendation MUST be a single dense sentence with: the specific data point driving it, the quantified target, the expected dollar impact, owner, and timeframe. Format: "P1 – Recommend [action] to [metric justification], targeting [goal]; expected impact: [quantified]; Owner: [team]; Timeframe: [when]." NO sub-bullets under recommendations.
14. Prioritize recommendations by ROI potential (largest gap with quickest fix first)
15. ${includePOR && includeR360 ? 'Compare products: explicitly note where R360 is trailing POR and why, with specific dollar and percentage comparisons' : `Focus exclusively on ${includePOR ? 'POR' : 'R360'} performance. Do NOT mention or reference ${includePOR ? 'R360' : 'POR'} in any way.`}
16. YOUR RESPONSE MUST BE AT LEAST 7000 CHARACTERS LONG AND CONTAIN ALL 10 SECTION HEADERS. DO NOT STOP EARLY OR ABBREVIATE. AIM FOR 8000-10000 CHARACTERS.
17. Each section must have at least 5 specific data-backed observations with dollar amounts. Never produce a section with fewer than 4 bullet points.
18. For EVERY underperforming segment, include: current value, target value, gap amount, percentage shortfall, and trend direction
19. Include regional breakdowns (AMER/EMEA/APAC) in EVERY section where data is available - do not aggregate away regional detail
20. In Win/Loss Patterns, analyze EACH loss reason category with dollar amounts and suggest specific countermeasures
21. In Predictive Indicators, provide SPECIFIC projected Q1 close amounts by category and region based on current run rates
22. Do NOT output "---" horizontal rules between sections. Section headers provide separation.
23. **DO NOT MENTION QUARTER PROGRESS**: NEVER compare attainment to quarter progress percentage. NEVER say "at X% quarter progress" or "vs Y% benchmark". Only show QTD attainment (actual/target). The quarter progress is ${period?.quarter_pct_complete || 0}% but do NOT include this in your analysis output.
24. **FUNNEL MATH CONSISTENCY (CRITICAL)**: MQL/SQL status categories are MUTUALLY EXCLUSIVE and must sum to 100%. Categories: Converted (success), Reverted (lost), Stalled (at risk), In Progress (healthy pipeline). If X% converted and Y% are reverted/stalled, the remaining % are "in progress" (still being worked, NOT lost). Do NOT make contradictory statements like "60% conversion and 0% loss" if other leads exist - explain where the remaining % are (in progress).
25. **LEAD STATUS DEFINITIONS**: "Converted" = moved to next stage (success). "Reverted" = disqualified/removed from funnel (loss). "Stalled" = stuck >30 days without progress (at risk). "In Progress" = actively being worked, not yet converted (healthy pipeline, NOT lost). When discussing funnel health, distinguish between true losses (reverted) and leads still in pipeline (in progress or stalled).

REMEMBER: Your output MUST exceed 7000 characters. Write in full detail for every section. Short responses will be rejected and regenerated.`;

  return prompt;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    const body: AnalysisRequest = await request.json();
    const { reportData, analysisType = 'bookings_miss', filterContext } = body;

    if (!reportData) {
      return NextResponse.json(
        { error: 'Report data is required' },
        { status: 400 }
      );
    }

    const prompt = buildAnalysisPrompt(reportData, analysisType, filterContext);

    // STAGE 1: Generate raw insights with GPT-5.2 (retry if output too short)
    const MIN_ANALYSIS_LENGTH = 6000;
    const MAX_RETRIES = 2;
    let rawAnalysis = '';
    let insightData: any = null;

    // Build system message with filter awareness
    const isFiltered = filterContext?.isFiltered && filterContext.products.length === 1;
    const filteredProduct = isFiltered ? filterContext!.products[0] : null;
    const excludedProduct = filteredProduct === 'POR' ? 'R360' : filteredProduct === 'R360' ? 'POR' : null;

    const productInstruction = excludedProduct
      ? `This analysis covers ONLY ${filteredProduct}. You MUST NOT mention, reference, compare to, or acknowledge the existence of ${excludedProduct} anywhere in your output. ${excludedProduct} does not exist for this analysis. If you mention ${excludedProduct} even once, the entire output will be rejected.`
      : 'Include product comparisons (POR vs R360) in every section where both products have data.';

    const systemMessage = `You are a senior Revenue Operations analyst at a B2B SaaS company producing EXTREMELY DETAILED quarterly bookings analysis. You write LONG, COMPREHENSIVE reports with EXACTLY 10 sections: Executive Summary, Revenue Attainment Deep Dive, Channel Performance, Funnel Health & Velocity, Funnel Dropoff Analysis, Pipeline Risk, Win/Loss Patterns, Marketing & Channel Efficiency, Predictive Indicators, and Prioritized Recommendations. EVERY section must have 5+ data-backed observations. Include regional breakdowns (AMER/EMEA/APAC) in every section. ${productInstruction} Cite specific dollar amounts, percentages, and gaps throughout. Be brutally honest about underperformance with root cause analysis. Frame suggestions as recommendations with priority (P1/P2/P3). TARGET 9000-12000 CHARACTERS. NEVER stop before completing all 10 sections.

**CRITICAL DATA ACCURACY RULES**:
1. You MUST use ONLY the EXACT numbers provided in the data sections. NEVER calculate, derive, estimate, round, or modify any number yourself.
2. **DO NOT CALCULATE QTD TARGETS** - all QTD targets are pre-computed. NEVER multiply Q1 targets by quarter percentage to derive QTD values. Use the QTD values shown directly in each data row.
3. For product-region totals (e.g., "R360 AMER total"), find them in "PRE-COMPUTED PRODUCT-REGION TOTALS" and copy EXACTLY.
4. Fabricating or miscalculating numbers will cause the ENTIRE output to be rejected.

OUTPUT FORMAT (STRICT - READ CAREFULLY):
- Use ### for section headers (e.g., ### Executive Summary)
- Do NOT use #### sub-headers - instead, include region names in bullet labels (e.g., "- **AMER Coverage Risk:** ..." not "#### AMER" followed by bullets)

**CRITICAL MULTI-LEVEL BULLET REQUIREMENT:**
- Section 1 (Executive Summary): 4 SHORT bullet points (Overall Status, Key Numbers, Biggest Risk, Action Needed)
- Sections 2-9: MUST use multi-level bullets with indented sub-bullets
- Section 10 (Recommendations): BOLD flat bullets starting with "- **P[1-3] –"

**FOR SECTIONS 2-9, EVERY BULLET MUST HAVE SUB-BULLETS:**
- Top-level: "- **Bold Label:** key insight or finding"
- Sub-bullets: "  - supporting metric" (REQUIRED - 1-3 per top-level bullet)
- If you write a flat bullet without sub-bullets in sections 2-9, the output is REJECTED

STRUCTURE FOR SECTIONS 2-9:
- Top-level bullet: "- **[Label from data]:** [key insight with specific metric from context]"
- Sub-bullets (REQUIRED): "  - [supporting metric]" (indent with 2 spaces, 1-3 per top-level)
- Use ONLY data from the context provided - no invented numbers
- ALL METRICS MUST INCLUDE "QTD" - e.g., "QTD attainment: 56%", "$141K QTD actual", "QTD gap: -$110K"

Do NOT use numbered lists (no "1.", "2." prefix). Do NOT write flat bullet lists in sections 2-9. All metrics must come from the data context provided. Unlabeled metrics without "QTD" are rejected.`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const insightResponse = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.2-chat-latest',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt }
          ],
          max_completion_tokens: 10000,
        }),
      });

      if (!insightResponse.ok) {
        const errorData = await insightResponse.json().catch(() => ({}));
        console.error(`OpenAI API error (insights, attempt ${attempt + 1}):`, errorData);
        if (attempt === MAX_RETRIES) {
          return NextResponse.json(
            { error: 'Failed to generate insights', details: errorData },
            { status: insightResponse.status }
          );
        }
        continue;
      }

      insightData = await insightResponse.json();
      rawAnalysis = insightData.choices?.[0]?.message?.content || '';

      if (rawAnalysis.length >= MIN_ANALYSIS_LENGTH) {
        break; // Good output, stop retrying
      }
      console.log(`Analysis too short (${rawAnalysis.length} chars), retrying (attempt ${attempt + 2})...`);
    }

    if (!rawAnalysis) {
      rawAnalysis = 'No analysis generated';
    }

    // Post-process to fix recommendation bold formatting
    // AI outputs various broken formats - normalize all to **P1 – content.**

    // Step 1: Handle "single bold block" format where AI wraps all recs in one **block**
    // Pattern: **-\nP1...\nP2...**  or  **\n- P1...\n- P2...**
    rawAnalysis = rawAnalysis.replace(
      /\*\*-?\s*\n([\s\S]*?)\*\*/g,
      (match, content) => {
        // Check if this block contains recommendations
        if (!content.includes('P1') && !content.includes('P2') && !content.includes('P3')) {
          return match; // Not a recommendations block, leave as-is
        }
        if (!content.includes('Owner:') && !content.includes('Timeframe:')) {
          return match; // Not a recommendations block
        }

        // Split by P1/P2/P3 markers and format each
        const recs = content.split(/(?=P[123]\s*[–-])/).filter(r => r.trim());
        return recs.map(rec => {
          let cleaned = rec
            .replace(/^-\s*/, '')      // Remove leading dash
            .replace(/\s*-\s*$/, '')   // Remove trailing dash
            .replace(/\*/g, '')        // Remove any asterisks
            .trim();
          if (!cleaned) return '';
          if (!cleaned.endsWith('.')) cleaned += '.';
          return `**${cleaned}**`;
        }).filter(r => r).join('\n');
      }
    );

    // Step 2: Handle individual lines that still need fixing
    const lines = rawAnalysis.split('\n');
    const fixedLines = lines.map(line => {
      const hasP123 = line.includes('P1') || line.includes('P2') || line.includes('P3');
      const hasMarkers = line.includes('Owner:') || line.includes('Timeframe:') ||
                         line.toLowerCase().includes('expected impact');

      // Skip if already properly formatted
      if (line.startsWith('**P') && line.endsWith('**')) {
        return line;
      }

      if (hasP123 && hasMarkers) {
        let content = line.replace(/\*/g, '').trim();
        content = content.replace(/\.+$/, '') + '.';
        return `**${content}**`;
      }
      return line;
    });
    rawAnalysis = fixedLines.join('\n');

    return NextResponse.json({
      success: true,
      analysis: rawAnalysis,
      model: insightData.model,
      usage: {
        total_tokens: insightData.usage?.total_tokens || 0,
      },
      generated_at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('AI Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to generate analysis', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ai-analysis',
    method: 'POST',
    description: 'Generate AI-powered analysis of bookings performance (two-stage: insights + formatting)',
    parameters: {
      reportData: 'Full report data object from /api/report-data',
      analysisType: 'bookings_miss | pipeline_risk | full_report (optional)',
      formats: 'Array of output formats: display | html | slack (default: ["display"])',
    },
    response: {
      analysis: 'Primary formatted output (first format in array)',
      raw_analysis: 'Raw unformatted insights from GPT-4o',
      formatted: 'Object with all requested formats { display, html, slack }',
    },
  });
}
