import { NextResponse } from 'next/server';

// OpenAI API endpoint
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface FilterContext {
  products: string[];
  regions: string[];
  isFiltered: boolean;
}

interface InboundAnalysisRequest {
  reportData: any;
  filterContext?: FilterContext;
  formats?: ('display' | 'html' | 'slack')[];
}

import { formatAnalysisMultiple, type OutputFormat } from '@/lib/ai/formatter';

// Build the inbound marketing analysis prompt
function buildInboundAnalysisPrompt(reportData: any, filterContext?: FilterContext): string {
  const {
    period, funnel_by_source, funnel_by_category, source_attainment,
    google_ads, google_ads_rca, mql_details, sql_details, sal_details,
    mql_disqualification_summary
  } = reportData;

  // Build filter context string for the prompt
  const filterDescription = filterContext?.isFiltered
    ? `**IMPORTANT: This analysis is FILTERED to show only ${filterContext.products.join(' and ')} data for ${filterContext.regions.join(', ')} region(s). Focus your analysis on these specific segments only.**`
    : 'This analysis covers ALL products (POR and R360) and ALL regions (AMER, EMEA, APAC).';

  // Extract INBOUND source data only
  const inboundSourcePOR = (funnel_by_source?.POR || []).filter((row: any) =>
    row.source?.toUpperCase() === 'INBOUND'
  );
  const inboundSourceR360 = (funnel_by_source?.R360 || []).filter((row: any) =>
    row.source?.toUpperCase() === 'INBOUND'
  );

  // Get NEW LOGO category funnel data (primary inbound category)
  const newLogoPOR = (funnel_by_category?.POR || []).filter((row: any) =>
    row.category === 'NEW LOGO'
  );
  const newLogoR360 = (funnel_by_category?.R360 || []).filter((row: any) =>
    row.category === 'NEW LOGO'
  );

  // Source attainment for inbound
  const inboundAttainmentPOR = (source_attainment?.POR || []).filter((row: any) =>
    row.source?.toUpperCase() === 'INBOUND'
  );
  const inboundAttainmentR360 = (source_attainment?.R360 || []).filter((row: any) =>
    row.source?.toUpperCase() === 'INBOUND'
  );

  // Google Ads data (paid inbound)
  const googleAdsPOR = google_ads?.POR || [];
  const googleAdsR360 = google_ads?.R360 || [];

  // MQL disqualification summary
  const dqSummary = mql_disqualification_summary || { POR: {}, R360: {} };

  // MQL detail statistics
  const mqlDetailsPOR = mql_details?.POR || [];
  const mqlDetailsR360 = mql_details?.R360 || [];

  // Calculate inbound MQL counts
  const inboundMqlPOR = mqlDetailsPOR.filter((m: any) =>
    m.source?.toUpperCase()?.includes('INBOUND') || m.source?.toUpperCase()?.includes('ORGANIC')
  );
  const inboundMqlR360 = mqlDetailsR360.filter((m: any) =>
    m.source?.toUpperCase()?.includes('INBOUND') || m.source?.toUpperCase()?.includes('ORGANIC')
  );

  // SQL details for conversion analysis
  const sqlDetailsPOR = sql_details?.POR || [];
  const sqlDetailsR360 = sql_details?.R360 || [];
  const inboundSqlPOR = sqlDetailsPOR.filter((s: any) =>
    s.source?.toUpperCase()?.includes('INBOUND') || s.source?.toUpperCase()?.includes('ORGANIC')
  );
  const inboundSqlR360 = sqlDetailsR360.filter((s: any) =>
    s.source?.toUpperCase()?.includes('INBOUND') || s.source?.toUpperCase()?.includes('ORGANIC')
  );

  // Calculate conversion metrics
  const calcConversionRate = (numerator: number, denominator: number) =>
    denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

  // MQL status breakdown
  const getMqlStatusBreakdown = (mqls: any[]) => {
    const converted = mqls.filter(m => m.converted_to_sql === 'Yes').length;
    const reverted = mqls.filter(m => m.was_reverted).length;
    const stalled = mqls.filter(m => m.mql_status === 'STALLED').length;
    const active = mqls.filter(m => m.mql_status === 'ACTIVE').length;
    return { total: mqls.length, converted, reverted, stalled, active };
  };

  const porMqlStatus = getMqlStatusBreakdown(inboundMqlPOR);
  const r360MqlStatus = getMqlStatusBreakdown(inboundMqlR360);

  // Average days in stage
  const avgDaysInStage = (records: any[]) => {
    const valid = records.filter(r => r.days_in_stage != null);
    return valid.length > 0 ? Math.round(valid.reduce((sum, r) => sum + r.days_in_stage, 0) / valid.length) : 0;
  };

  // Calculate total ad spend and ROI metrics
  const totalAdSpendPOR = googleAdsPOR.reduce((sum: number, a: any) => sum + (a.ad_spend_usd || 0), 0);
  const totalAdSpendR360 = googleAdsR360.reduce((sum: number, a: any) => sum + (a.ad_spend_usd || 0), 0);
  const totalConversionsPOR = googleAdsPOR.reduce((sum: number, a: any) => sum + (a.conversions || 0), 0);
  const totalConversionsR360 = googleAdsR360.reduce((sum: number, a: any) => sum + (a.conversions || 0), 0);

  // UTM Analysis - aggregate MQL data by UTM fields
  const getUtmBreakdown = (mqls: any[], field: string) => {
    const grouped: Record<string, { total: number; converted: number; stalled: number }> = {};
    mqls.forEach((m: any) => {
      const value = m[field] || 'Unknown';
      if (!grouped[value]) grouped[value] = { total: 0, converted: 0, stalled: 0 };
      grouped[value].total++;
      if (m.converted_to_sql === 'Yes') grouped[value].converted++;
      if (m.mql_status === 'STALLED') grouped[value].stalled++;
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({
        name,
        total: data.total,
        converted: data.converted,
        stalled: data.stalled,
        convRate: data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0,
        stallRate: data.total > 0 ? Math.round((data.stalled / data.total) * 100) : 0,
      }))
      .filter(item => item.name && item.name !== 'Unknown' && item.name !== '')
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  };

  // Get UTM breakdowns for POR and R360
  const utmSourcePOR = getUtmBreakdown(mqlDetailsPOR, 'utm_source');
  const utmSourceR360 = getUtmBreakdown(mqlDetailsR360, 'utm_source');
  const utmMediumPOR = getUtmBreakdown(mqlDetailsPOR, 'utm_medium');
  const utmMediumR360 = getUtmBreakdown(mqlDetailsR360, 'utm_medium');
  const utmCampaignPOR = getUtmBreakdown(mqlDetailsPOR, 'utm_campaign');
  const utmCampaignR360 = getUtmBreakdown(mqlDetailsR360, 'utm_campaign');
  const utmChannelPOR = getUtmBreakdown(mqlDetailsPOR, 'utm_channel');
  const utmChannelR360 = getUtmBreakdown(mqlDetailsR360, 'utm_channel');
  const utmKeywordPOR = getUtmBreakdown(mqlDetailsPOR, 'utm_keyword');
  const utmKeywordR360 = getUtmBreakdown(mqlDetailsR360, 'utm_keyword');

  const prompt = `You are a Risk Analyst for Inbound Marketing reviewing Q1 2026 performance data.

## CRITICAL INSTRUCTION: RISKS ONLY

**DO NOT include any positive information, wins, or things going well.**
**ONLY report risks to inbound targets, root cause analysis, and action items to fix.**

**R360 NOTE**: R360 does NOT have a SAL stage. R360 flows directly from SQL to SQO.

## OUTPUT FORMAT (plain text, formatting applied separately)

INBOUND RISKS TO Q1 PLAN:
List all inbound risks with: Product, Region, Metric, Gap percentage, Risk level (HIGH/MEDIUM/LOW), Dollar impact.

ROOT CAUSE ANALYSIS:
For Lead Volume Risks: List each product/region behind pacing with root cause and underperforming channels.
For Conversion Rate Risks: List each stage below threshold (MQL to SQL below 30%, SQL to SAL below 50%, SAL to SQO below 60%, SQL to SQO below 50% for R360).
For Google Ads Risks: List CPA above $200 or CTR below 3% with root causes.

ACTION ITEMS:
For each risk, provide: Action, Owner (Marketing/Sales/SDR), Timeline (Immediate/This Week/This Month), Expected Impact.

OVERALL RISK ASSESSMENT:
Risk Level (HIGH/MEDIUM/LOW), Key Risk (single biggest threat), Dollar amount at risk, Confidence percentage of hitting inbound targets.

${filterDescription}

## Current Period
- As of Date: ${period?.as_of_date || 'N/A'}
- Quarter Progress: ${period?.quarter_pct_complete || 0}% complete
- Days Elapsed: ${period?.days_elapsed || 0} of ${period?.total_days || 90}

## POR INBOUND FUNNEL DATA BY REGION
${inboundSourcePOR.map((row: any) =>
  `- ${row.region}: MQL ${row.actual_mql || 0}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql || 0}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct || 0}%), SQO ${row.actual_sqo || 0}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct || 0}%)`
).join('\n') || 'No POR inbound data available'}

## R360 INBOUND FUNNEL DATA BY REGION
${inboundSourceR360.map((row: any) =>
  `- ${row.region}: MQL ${row.actual_mql || 0}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql || 0}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct || 0}%), SQO ${row.actual_sqo || 0}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct || 0}%)`
).join('\n') || 'No R360 inbound data available'}

## POR NEW LOGO FUNNEL (Primary Inbound Category)
${newLogoPOR.map((row: any) =>
  `- ${row.region}: MQL ${row.actual_mql || 0}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql || 0}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct || 0}%), SAL ${row.actual_sal || 0}/${row.qtd_target_sal || 0} (${row.sal_pacing_pct || 0}%), SQO ${row.actual_sqo || 0}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct || 0}%)`
).join('\n') || 'No POR NEW LOGO data'}

## R360 NEW LOGO FUNNEL (Note: R360 has no SAL stage - direct SQL→SQO)
${newLogoR360.map((row: any) =>
  `- ${row.region}: MQL ${row.actual_mql || 0}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql || 0}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct || 0}%), SQO ${row.actual_sqo || 0}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct || 0}%)`
).join('\n') || 'No R360 NEW LOGO data'}

## INBOUND SOURCE ATTAINMENT (Revenue)
### POR Inbound Revenue Attainment
${inboundAttainmentPOR.map((row: any) =>
  `- ${row.region}: ${row.attainment_pct || 0}% attainment, $${(row.gap || 0).toLocaleString()} gap, RAG: ${row.rag_status || 'N/A'}`
).join('\n') || 'No POR inbound attainment data'}

### R360 Inbound Revenue Attainment
${inboundAttainmentR360.map((row: any) =>
  `- ${row.region}: ${row.attainment_pct || 0}% attainment, $${(row.gap || 0).toLocaleString()} gap, RAG: ${row.rag_status || 'N/A'}`
).join('\n') || 'No R360 inbound attainment data'}

## MQL QUALITY ANALYSIS
### POR MQL Status Breakdown
- Total Inbound MQLs: ${porMqlStatus.total}
- Converted to SQL: ${porMqlStatus.converted} (${calcConversionRate(porMqlStatus.converted, porMqlStatus.total)}%)
- Reverted/Disqualified: ${porMqlStatus.reverted} (${calcConversionRate(porMqlStatus.reverted, porMqlStatus.total)}%)
- Stalled (>30 days): ${porMqlStatus.stalled} (${calcConversionRate(porMqlStatus.stalled, porMqlStatus.total)}%)
- Active: ${porMqlStatus.active}
- Average Days in MQL Stage: ${avgDaysInStage(inboundMqlPOR)}

### R360 MQL Status Breakdown
- Total Inbound MQLs: ${r360MqlStatus.total}
- Converted to SQL: ${r360MqlStatus.converted} (${calcConversionRate(r360MqlStatus.converted, r360MqlStatus.total)}%)
- Reverted/Disqualified: ${r360MqlStatus.reverted} (${calcConversionRate(r360MqlStatus.reverted, r360MqlStatus.total)}%)
- Stalled (>30 days): ${r360MqlStatus.stalled} (${calcConversionRate(r360MqlStatus.stalled, r360MqlStatus.total)}%)
- Active: ${r360MqlStatus.active}
- Average Days in MQL Stage: ${avgDaysInStage(inboundMqlR360)}

### Overall MQL Disqualification Summary
- POR: ${dqSummary.POR?.reverted_pct || 0}% reverted, ${dqSummary.POR?.converted_pct || 0}% converted, ${dqSummary.POR?.stalled_pct || 0}% stalled
- R360: ${dqSummary.R360?.reverted_pct || 0}% reverted, ${dqSummary.R360?.converted_pct || 0}% converted, ${dqSummary.R360?.stalled_pct || 0}% stalled

## UTM SOURCE ANALYSIS (Lead Origin Tracking)
### POR - By UTM Source (Top 10)
${utmSourcePOR.length > 0 ? utmSourcePOR.map(s =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% converted, ${s.stallRate}% stalled`
).join('\n') : 'No UTM source data'}

### R360 - By UTM Source (Top 10)
${utmSourceR360.length > 0 ? utmSourceR360.map(s =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% converted, ${s.stallRate}% stalled`
).join('\n') : 'No UTM source data'}

## UTM CHANNEL ANALYSIS
### POR - By UTM Channel
${utmChannelPOR.length > 0 ? utmChannelPOR.map(s =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% converted, ${s.stallRate}% stalled`
).join('\n') : 'No UTM channel data'}

### R360 - By UTM Channel
${utmChannelR360.length > 0 ? utmChannelR360.map(s =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% converted, ${s.stallRate}% stalled`
).join('\n') : 'No UTM channel data'}

## UTM CAMPAIGN ANALYSIS
### POR - By UTM Campaign (Top 10)
${utmCampaignPOR.length > 0 ? utmCampaignPOR.map(s =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% converted, ${s.stallRate}% stalled`
).join('\n') : 'No UTM campaign data'}

### R360 - By UTM Campaign (Top 10)
${utmCampaignR360.length > 0 ? utmCampaignR360.map(s =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% converted, ${s.stallRate}% stalled`
).join('\n') : 'No UTM campaign data'}

## UTM KEYWORD ANALYSIS
### POR - By UTM Keyword/Term (Top 10)
${utmKeywordPOR.length > 0 ? utmKeywordPOR.map(s =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% converted, ${s.stallRate}% stalled`
).join('\n') : 'No UTM keyword data'}

### R360 - By UTM Keyword/Term (Top 10)
${utmKeywordR360.length > 0 ? utmKeywordR360.map(s =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% converted, ${s.stallRate}% stalled`
).join('\n') : 'No UTM keyword data'}

## GOOGLE ADS PERFORMANCE (Paid Inbound)
### POR Google Ads by Region
${googleAdsPOR.map((row: any) =>
  `- ${row.region}: $${(row.ad_spend_usd || 0).toLocaleString()} spend, ${row.clicks || 0} clicks, CTR: ${row.ctr_pct || 0}%, ${row.conversions || 0} conversions, CPA: $${row.cpa_usd || 'N/A'}`
).join('\n') || 'No POR ads data'}

Total POR Ad Spend: $${totalAdSpendPOR.toLocaleString()} | Total Conversions: ${totalConversionsPOR} | Blended CPA: $${totalConversionsPOR > 0 ? Math.round(totalAdSpendPOR / totalConversionsPOR) : 'N/A'}

### R360 Google Ads by Region
${googleAdsR360.map((row: any) =>
  `- ${row.region}: $${(row.ad_spend_usd || 0).toLocaleString()} spend, ${row.clicks || 0} clicks, CTR: ${row.ctr_pct || 0}%, ${row.conversions || 0} conversions, CPA: $${row.cpa_usd || 'N/A'}`
).join('\n') || 'No R360 ads data'}

Total R360 Ad Spend: $${totalAdSpendR360.toLocaleString()} | Total Conversions: ${totalConversionsR360} | Blended CPA: $${totalConversionsR360 > 0 ? Math.round(totalAdSpendR360 / totalConversionsR360) : 'N/A'}

### Google Ads RCA (Performance Issues)
${(google_ads_rca?.POR || []).concat(google_ads_rca?.R360 || []).map((row: any) =>
  `- ${row.product} ${row.region}: CTR ${row.ctr_pct}% (${row.ctr_performance}), CPA $${row.cpa_usd} (${row.cpa_performance}). ${row.rca_commentary}`
).join('\n') || 'No ads RCA data'}

## SQL CONVERSION ANALYSIS
### POR Inbound SQLs
- Total Inbound SQLs: ${inboundSqlPOR.length}
- With Opportunity: ${inboundSqlPOR.filter((s: any) => s.has_opportunity === 'Yes').length}
- Converted to SAL: ${inboundSqlPOR.filter((s: any) => s.converted_to_sal === 'Yes').length}
- Converted to SQO: ${inboundSqlPOR.filter((s: any) => s.converted_to_sqo === 'Yes').length}
- Average Days MQL→SQL: ${Math.round(inboundSqlPOR.reduce((sum: number, s: any) => sum + (s.days_mql_to_sql || 0), 0) / (inboundSqlPOR.length || 1))}

### R360 Inbound SQLs (Note: R360 has no SAL stage - direct SQL→SQO)
- Total Inbound SQLs: ${inboundSqlR360.length}
- With Opportunity: ${inboundSqlR360.filter((s: any) => s.has_opportunity === 'Yes').length}
- Converted to SQO: ${inboundSqlR360.filter((s: any) => s.converted_to_sqo === 'Yes').length}
- Average Days MQL→SQL: ${Math.round(inboundSqlR360.reduce((sum: number, s: any) => sum + (s.days_mql_to_sql || 0), 0) / (inboundSqlR360.length || 1))}

## CRITICAL RULES
- **NO POSITIVE INFO** - Only report problems and risks
- **ROOT CAUSE REQUIRED** - Every risk must explain WHY
- **ACTION REQUIRED** - Every risk needs a fix
- **R360 NOTE** - R360 has no SAL stage (SQL→SQO direct)
- **Thresholds**:
  - MQL→SQL: 30% (below = risk)
  - SQL→SAL: 50% (POR only)
  - SAL→SQO: 60% (POR only)
  - SQL→SQO: 50% (R360 only)
  - CPA: <$200 (above = risk)
  - CTR: >3% (below = risk)`;

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

    const body: InboundAnalysisRequest = await request.json();
    const { reportData, filterContext, formats = ['display'] } = body;

    if (!reportData) {
      return NextResponse.json(
        { error: 'Report data is required' },
        { status: 400 }
      );
    }

    const prompt = buildInboundAnalysisPrompt(reportData, filterContext);

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
            content: 'You are a Risk Analyst for Inbound Marketing. Your ONLY job is to identify RISKS to inbound targets, provide root cause analysis using UTM/channel/keyword data, and recommend fixes. DO NOT include any positive information. Output plain text analysis without markdown formatting - formatting will be applied separately.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2500,
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

    if (validFormats.length > 0) {
      try {
        formattedOutputs = await formatAnalysisMultiple(rawAnalysis, validFormats, apiKey);
      } catch (formatError: any) {
        console.error('Formatting error:', formatError);
        formattedOutputs = { display: rawAnalysis };
      }
    } else {
      formattedOutputs = { display: rawAnalysis };
    }

    const primaryFormat = validFormats[0] || 'display';

    return NextResponse.json({
      success: true,
      analysis: formattedOutputs[primaryFormat] || rawAnalysis,
      raw_analysis: rawAnalysis,
      formatted: formattedOutputs,
      model: insightData.model,
      usage: {
        insight_tokens: insightData.usage?.total_tokens || 0,
        total_tokens: insightData.usage?.total_tokens || 0,
      },
      generated_at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Inbound AI Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to generate analysis', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ai-analysis-inbound',
    method: 'POST',
    description: 'Generate AI-powered inbound marketing risk analysis (two-stage: insights + formatting)',
    parameters: {
      reportData: 'Full report data object from /api/report-data',
      filterContext: 'Optional filter context for products and regions',
      formats: 'Array of output formats: display | html | slack (default: ["display"])',
    },
    response: {
      analysis: 'Primary formatted output (first format in array)',
      raw_analysis: 'Raw unformatted insights from GPT-4o',
      formatted: 'Object with all requested formats { display, html, slack }',
    },
  });
}
