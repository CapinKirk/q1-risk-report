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

  // Build comprehensive context
  const prompt = `You are a Revenue Operations analyst reviewing Q1 2026 Bookings performance data.

**CRITICAL INSTRUCTION**: Structure your analysis BY REGION (AMER, EMEA, APAC) so that regional directors can see their specific feedback.

## OUTPUT FORMAT (FOLLOW THIS EXACTLY):

### 1. EXECUTIVE SUMMARY
2-3 sentences on overall global performance.

### 2. REGIONAL ANALYSIS (REQUIRED - one section for each region)

#### 🇺🇸 AMER REGION
**Regional Director Accountability**
- **Status**: [GREEN/YELLOW/RED] - [X]% attainment
- **Gap to Target**: $[amount]
- **Key Risks**:
  - [Risk 1 with specific segment and $ impact]
  - [Risk 2 with specific segment and $ impact]
- **Root Cause Analysis**:
  - [Why this region is missing/exceeding - be specific]
- **Action Items for AMER**:
  - [Specific action 1] - Owner: [Name/Role]
  - [Specific action 2] - Owner: [Name/Role]

#### 🇬🇧 EMEA REGION
**Regional Director Accountability**
- **Status**: [GREEN/YELLOW/RED] - [X]% attainment
- **Gap to Target**: $[amount]
- **Key Risks**:
  - [Risk 1 with specific segment and $ impact]
  - [Risk 2 with specific segment and $ impact]
- **Root Cause Analysis**:
  - [Why this region is missing/exceeding - be specific]
- **Action Items for EMEA**:
  - [Specific action 1] - Owner: [Name/Role]
  - [Specific action 2] - Owner: [Name/Role]

#### 🇦🇺 APAC REGION
**Regional Director Accountability**
- **Status**: [GREEN/YELLOW/RED] - [X]% attainment
- **Gap to Target**: $[amount]
- **Key Risks**:
  - [Risk 1 with specific segment and $ impact]
  - [Risk 2 with specific segment and $ impact]
- **Root Cause Analysis**:
  - [Why this region is missing/exceeding - be specific]
- **Action Items for APAC**:
  - [Specific action 1] - Owner: [Name/Role]
  - [Specific action 2] - Owner: [Name/Role]

### 3. GLOBAL RISK ASSESSMENT
- Likelihood of hitting Q1 targets
- Top 3 global priorities

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
### AMER Region Total
- QTD Actual: $${amerTotal.qtdAcv.toLocaleString()}
- QTD Target: $${amerTotal.qtdTarget.toLocaleString()}
- Attainment: ${amerTotal.attainment}%
- Gap: $${amerTotal.gap.toLocaleString()}

### EMEA Region Total
- QTD Actual: $${emeaTotal.qtdAcv.toLocaleString()}
- QTD Target: $${emeaTotal.qtdTarget.toLocaleString()}
- Attainment: ${emeaTotal.attainment}%
- Gap: $${emeaTotal.gap.toLocaleString()}

### APAC Region Total
- QTD Actual: $${apacTotal.qtdAcv.toLocaleString()}
- QTD Target: $${apacTotal.qtdTarget.toLocaleString()}
- Attainment: ${apacTotal.attainment}%
- Gap: $${apacTotal.gap.toLocaleString()}

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

## AMER Segment Detail
${amerAttainment.map((row: any) =>
  `- ${row.product} ${row.category}: ${row.qtd_attainment_pct}% attainment, $${(row.qtd_gap || 0).toLocaleString()} gap, ${row.pipeline_coverage_x}x coverage, RAG: ${row.rag_status}`
).join('\n') || 'No AMER data'}

## EMEA Segment Detail
${emeaAttainment.map((row: any) =>
  `- ${row.product} ${row.category}: ${row.qtd_attainment_pct}% attainment, $${(row.qtd_gap || 0).toLocaleString()} gap, ${row.pipeline_coverage_x}x coverage, RAG: ${row.rag_status}`
).join('\n') || 'No EMEA data'}

## APAC Segment Detail
${apacAttainment.map((row: any) =>
  `- ${row.product} ${row.category}: ${row.qtd_attainment_pct}% attainment, $${(row.qtd_gap || 0).toLocaleString()} gap, ${row.pipeline_coverage_x}x coverage, RAG: ${row.rag_status}`
).join('\n') || 'No APAC data'}

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

Provide your analysis in a structured format with clear headers. Be specific about which segments need attention and what actions should be taken. Include realistic assessments - don't sugarcoat underperformance. Pay special attention to:
1. Loss reasons by product - what patterns emerge?
2. MQL disqualification rates - are we generating quality leads?
3. Source channel performance - which channels are working/failing?
4. Funnel conversion rates - where are we losing deals?`;

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

    // Call OpenAI API
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Using GPT-4o (latest available model)
        messages: [
          {
            role: 'system',
            content: 'You are an expert Revenue Operations analyst specializing in B2B SaaS bookings analysis. Provide data-driven insights with specific, actionable recommendations. Be direct and honest about performance issues.'
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to get AI analysis', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || 'No analysis generated';

    return NextResponse.json({
      success: true,
      analysis,
      model: data.model,
      usage: data.usage,
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
    description: 'Generate AI-powered analysis of bookings performance',
    parameters: {
      reportData: 'Full report data object from /api/report-data',
      analysisType: 'bookings_miss | pipeline_risk | full_report (optional)',
    },
  });
}
