import { NextResponse } from 'next/server';

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

import { formatAnalysisMultiple, type OutputFormat } from '@/lib/ai/formatter';

// Normalize attainment_detail to flat array (handles both API and frontend formats)
function normalizeAttainmentDetail(attainment_detail: any): any[] {
  if (!attainment_detail) return [];
  if (Array.isArray(attainment_detail)) return attainment_detail;
  // Handle {POR: [], R360: []} format from frontend
  const porData = attainment_detail.POR || [];
  const r360Data = attainment_detail.R360 || [];
  return [...porData, ...r360Data];
}

// Build the analysis prompt based on report data
function buildAnalysisPrompt(reportData: any, analysisType: string, filterContext?: FilterContext): string {
  const {
    period, grand_total, product_totals, attainment_detail,
    funnel_by_category, funnel_by_source, pipeline_rca, loss_reason_rca,
    source_attainment, google_ads, google_ads_rca,
    mql_details, sql_details, mql_disqualification_summary
  } = reportData;

  // Build filter context string for the prompt
  const filterDescription = filterContext?.isFiltered
    ? `**IMPORTANT: This analysis is FILTERED to show only ${filterContext.products.join(' and ')} data for ${filterContext.regions.join(', ')} region(s). Focus your analysis on these specific segments only.**`
    : 'This analysis covers ALL products (POR and R360) and ALL regions (AMER, EMEA, APAC).';

  // Calculate key metrics for context
  const porTotal = product_totals?.POR || {};
  const r360Total = product_totals?.R360 || {};

  // Normalize attainment data to flat array
  const allAttainment = normalizeAttainmentDetail(attainment_detail);

  // Identify misses (segments below 90% attainment)
  const misses = allAttainment.filter((row: any) => row.qtd_attainment_pct < 90);
  const criticalMisses = misses.filter((row: any) => row.qtd_attainment_pct < 70);

  // Get funnel bottlenecks
  const funnelData = {
    POR: funnel_by_category?.POR || [],
    R360: funnel_by_category?.R360 || [],
  };

  // Get funnel by source
  const funnelBySourceData = {
    POR: funnel_by_source?.POR || [],
    R360: funnel_by_source?.R360 || [],
  };

  // Get source attainment
  const sourceAttainmentData = {
    POR: source_attainment?.POR || [],
    R360: source_attainment?.R360 || [],
  };

  // Get Google Ads data
  const googleAdsData = {
    POR: google_ads?.POR || [],
    R360: google_ads?.R360 || [],
  };

  // Get MQL disqualification summary
  const dqSummary = mql_disqualification_summary || { POR: {}, R360: {} };

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
        `- ${row.product} ${row.category}: ${row.qtd_attainment_pct}% attainment, $${(row.qtd_gap || 0).toLocaleString()} gap, ${row.pipeline_coverage_x}x coverage, RAG: ${row.rag_status}`
      ).join('\n') || 'No AMER data';
      sections.push(`## AMER Segment Detail\n${amerDetail}`);
    }

    if (activeRegions.includes('EMEA')) {
      const emeaDetail = emeaAttainment.map((row: any) =>
        `- ${row.product} ${row.category}: ${row.qtd_attainment_pct}% attainment, $${(row.qtd_gap || 0).toLocaleString()} gap, ${row.pipeline_coverage_x}x coverage, RAG: ${row.rag_status}`
      ).join('\n') || 'No EMEA data';
      sections.push(`## EMEA Segment Detail\n${emeaDetail}`);
    }

    if (activeRegions.includes('APAC')) {
      const apacDetail = apacAttainment.map((row: any) =>
        `- ${row.product} ${row.category}: ${row.qtd_attainment_pct}% attainment, $${(row.qtd_gap || 0).toLocaleString()} gap, ${row.pipeline_coverage_x}x coverage, RAG: ${row.rag_status}`
      ).join('\n') || 'No APAC data';
      sections.push(`## APAC Segment Detail\n${apacDetail}`);
    }

    return sections.join('\n\n');
  };

  // Build comprehensive context
  const prompt = `You are a Revenue Operations analyst reviewing Q1 2026 Bookings performance data.

Provide a structured analysis with the following sections. Use plain text with clear section headers.

EXECUTIVE SUMMARY:
Write 2-3 sentences on overall global Q1 performance status.

REGIONAL ANALYSIS:
For each region included in this analysis (${activeRegions.join(', ')}), provide:
- Status: GREEN/YELLOW/RED and attainment percentage
- Gap: Dollar amount to target
- Key Risks: 1-2 specific risks with dollar impact
- Root Cause: Why the region is missing or exceeding
- Actions: 1-2 specific action items with owner roles

GLOBAL RISK ASSESSMENT:
- Q1 Outlook: HIGH/MEDIUM/LOW risk level
- Dollar amount at risk if issues not addressed
- Top 3 priorities

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

## POR Performance
- Q1 Target: $${(porTotal.total_q1_target || 0).toLocaleString()}
- QTD Actual: $${(porTotal.total_qtd_acv || 0).toLocaleString()}
- Attainment: ${porTotal.total_qtd_attainment_pct || 0}%
- Pipeline Coverage: ${porTotal.total_pipeline_coverage_x || 0}x
- Lost Deals: ${porTotal.total_lost_deals || 0} worth $${(porTotal.total_lost_acv || 0).toLocaleString()}

## R360 Performance
- Q1 Target: $${(r360Total.total_q1_target || 0).toLocaleString()}
- QTD Actual: $${(r360Total.total_qtd_acv || 0).toLocaleString()}
- Attainment: ${r360Total.total_qtd_attainment_pct || 0}%
- Pipeline Coverage: ${r360Total.total_pipeline_coverage_x || 0}x
- Lost Deals: ${r360Total.total_lost_deals || 0} worth $${(r360Total.total_lost_acv || 0).toLocaleString()}

${buildRegionalDetail()}

## Critical Misses (Below 70% Attainment)
${criticalMisses.length > 0 ? criticalMisses.map((row: any) =>
  `- ${row.product} ${row.region} ${row.category}: Only ${row.qtd_attainment_pct}% attainment, missing $${Math.abs(row.qtd_gap || 0).toLocaleString()}`
).join('\n') : 'No critical misses below 70%'}

## Funnel Performance (POR by Category)
${funnelData.POR.map((row: any) =>
  `- ${row.category} ${row.region}: MQL ${row.actual_mql}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct}%), SQL ${row.actual_sql}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct}%), SQO ${row.actual_sqo}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct}%)`
).join('\n')}

## Funnel Performance (R360 by Category)
${funnelData.R360.map((row: any) =>
  `- ${row.category} ${row.region}: MQL ${row.actual_mql}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct}%), SQL ${row.actual_sql}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct}%), SQO ${row.actual_sqo}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct}%)`
).join('\n')}

## Pipeline Health by Segment
${(pipeline_rca?.POR || []).concat(pipeline_rca?.R360 || []).map((row: any) =>
  `- ${row.region} ${row.category}: $${(row.pipeline_acv || 0).toLocaleString()} pipeline, ${row.pipeline_coverage_x}x coverage, ${row.pipeline_avg_age_days} days avg age, Health: ${row.pipeline_health}`
).join('\n')}

## Loss Reasons by Product (Top Issues)
### POR Loss Reasons
${(loss_reason_rca?.POR || []).slice(0, 8).map((row: any) =>
  `- ${row.loss_reason} (${row.region}): ${row.deal_count} deals, $${(row.lost_acv || 0).toLocaleString()} lost`
).join('\n') || 'No POR loss data'}

### R360 Loss Reasons
${(loss_reason_rca?.R360 || []).slice(0, 8).map((row: any) =>
  `- ${row.loss_reason} (${row.region}): ${row.deal_count} deals, $${(row.lost_acv || 0).toLocaleString()} lost`
).join('\n') || 'No R360 loss data'}

## Funnel Performance by Source (POR)
${funnelBySourceData.POR.map((row: any) =>
  `- ${row.source} (${row.region}): MQL ${row.actual_mql}/${row.target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql}/${row.target_sql || 0} (${row.sql_pacing_pct || 0}%), Conversion MQL→SQL: ${row.mql_to_sql_rate || 0}%`
).join('\n') || 'No POR source data'}

## Funnel Performance by Source (R360)
${funnelBySourceData.R360.map((row: any) =>
  `- ${row.source} (${row.region}): MQL ${row.actual_mql}/${row.target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql}/${row.target_sql || 0} (${row.sql_pacing_pct || 0}%), Conversion MQL→SQL: ${row.mql_to_sql_rate || 0}%`
).join('\n') || 'No R360 source data'}

## MQL Disqualification/Reversion Summary
### POR MQL Status
- Total MQLs: ${dqSummary.POR?.total_mqls || 0}
- Reverted/Disqualified: ${dqSummary.POR?.reverted_count || 0} (${dqSummary.POR?.reverted_pct || 0}%)
- Converted to SQL: ${dqSummary.POR?.converted_count || 0} (${dqSummary.POR?.converted_pct || 0}%)
- Stalled (>30 days): ${dqSummary.POR?.stalled_count || 0} (${dqSummary.POR?.stalled_pct || 0}%)
- Active: ${dqSummary.POR?.active_count || 0}

### R360 MQL Status
- Total MQLs: ${dqSummary.R360?.total_mqls || 0}
- Reverted/Disqualified: ${dqSummary.R360?.reverted_count || 0} (${dqSummary.R360?.reverted_pct || 0}%)
- Converted to SQL: ${dqSummary.R360?.converted_count || 0} (${dqSummary.R360?.converted_pct || 0}%)
- Stalled (>30 days): ${dqSummary.R360?.stalled_count || 0} (${dqSummary.R360?.stalled_pct || 0}%)
- Active: ${dqSummary.R360?.active_count || 0}

## Google Ads Performance
### POR Ads
${googleAdsData.POR.map((row: any) =>
  `- ${row.region}: $${(row.ad_spend_usd || 0).toLocaleString()} spend, ${row.clicks || 0} clicks, ${row.conversions || 0} conversions, CPA: $${row.cpa_usd || 'N/A'}`
).join('\n') || 'No POR ads data'}

### R360 Ads
${googleAdsData.R360.map((row: any) =>
  `- ${row.region}: $${(row.ad_spend_usd || 0).toLocaleString()} spend, ${row.clicks || 0} clicks, ${row.conversions || 0} conversions, CPA: $${row.cpa_usd || 'N/A'}`
).join('\n') || 'No R360 ads data'}

## Source Channel Attainment (Revenue by Source)
### POR by Source
${sourceAttainmentData.POR.map((row: any) =>
  `- ${row.source} (${row.region}): ${row.attainment_pct || 0}% attainment, $${(row.gap || 0).toLocaleString()} gap, RAG: ${row.rag_status || 'N/A'}`
).join('\n') || 'No POR source attainment data'}

### R360 by Source
${sourceAttainmentData.R360.map((row: any) =>
  `- ${row.source} (${row.region}): ${row.attainment_pct || 0}% attainment, $${(row.gap || 0).toLocaleString()} gap, RAG: ${row.rag_status || 'N/A'}`
).join('\n') || 'No R360 source attainment data'}

## CRITICAL RULES
- Be specific about which segments need attention
- Include realistic assessments - don't sugarcoat underperformance
- Focus on loss patterns by product
- Analyze MQL disqualification rates for lead quality
- Evaluate source channel performance
- Identify funnel conversion bottlenecks`;

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
    const { reportData, analysisType = 'bookings_miss', filterContext, formats = ['display'] } = body;

    if (!reportData) {
      return NextResponse.json(
        { error: 'Report data is required' },
        { status: 400 }
      );
    }

    const prompt = buildAnalysisPrompt(reportData, analysisType, filterContext);

    // STAGE 1: Generate raw insights with GPT-4o
    const insightResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Revenue Operations analyst specializing in B2B SaaS bookings analysis. Provide data-driven insights with specific, actionable recommendations. Be direct and honest about performance issues. Output plain text analysis without markdown formatting - formatting will be applied separately.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!insightResponse.ok) {
      const errorData = await insightResponse.json().catch(() => ({}));
      console.error('OpenAI API error (insights):', errorData);
      return NextResponse.json(
        { error: 'Failed to generate insights', details: errorData },
        { status: insightResponse.status }
      );
    }

    const insightData = await insightResponse.json();
    const rawAnalysis = insightData.choices?.[0]?.message?.content || 'No analysis generated';

    // STAGE 2: Format with cheap model (GPT-4o-mini)
    const validFormats = formats.filter((f): f is OutputFormat =>
      ['display', 'html', 'slack'].includes(f)
    );

    let formattedOutputs: Record<string, string> = {};
    let formattingTokens = 0;

    if (validFormats.length > 0) {
      try {
        formattedOutputs = await formatAnalysisMultiple(rawAnalysis, validFormats, apiKey);
        // Note: Token tracking would need to be added to formatAnalysisMultiple if needed
      } catch (formatError: any) {
        console.error('Formatting error:', formatError);
        // Fallback to raw analysis if formatting fails
        formattedOutputs = { display: rawAnalysis };
      }
    } else {
      formattedOutputs = { display: rawAnalysis };
    }

    // Return the primary format as 'analysis' for backward compatibility
    const primaryFormat = validFormats[0] || 'display';

    return NextResponse.json({
      success: true,
      analysis: formattedOutputs[primaryFormat] || rawAnalysis,
      raw_analysis: rawAnalysis,
      formatted: formattedOutputs,
      model: insightData.model,
      usage: {
        insight_tokens: insightData.usage?.total_tokens || 0,
        formatting_tokens: formattingTokens,
        total_tokens: (insightData.usage?.total_tokens || 0) + formattingTokens,
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
