import { NextResponse } from 'next/server';

// OpenAI API endpoint
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface AnalysisRequest {
  reportData: any;
  analysisType: 'bookings_miss' | 'pipeline_risk' | 'full_report';
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
function buildAnalysisPrompt(reportData: any, analysisType: string): string {
  const { period, grand_total, product_totals, attainment_detail, funnel_by_category, pipeline_rca, loss_reason_rca } = reportData;

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

  // Build comprehensive context
  const prompt = `You are a Revenue Operations analyst reviewing Q1 2026 Bookings performance data. Analyze the following data and provide:

1. **Executive Summary** (2-3 sentences on overall performance)
2. **Critical Misses Analysis** - For each underperforming segment, explain WHY it's missing and the root cause
3. **Recommended Actions** - Specific, actionable recommendations with owner suggestions
4. **Risk Assessment** - Likelihood of hitting Q1 targets based on current trajectory

## Current Period
- As of Date: ${period?.as_of_date || 'N/A'}
- Quarter Progress: ${period?.quarter_pct_complete || 0}% complete
- Days Elapsed: ${period?.days_elapsed || 0} of ${period?.total_days || 90}

## Grand Total Performance
- Q1 Target: $${(grand_total?.total_q1_target || 0).toLocaleString()}
- QTD Target: $${(grand_total?.total_qtd_target || 0).toLocaleString()}
- QTD Actual: $${(grand_total?.total_qtd_acv || 0).toLocaleString()}
- QTD Attainment: ${grand_total?.total_qtd_attainment_pct || 0}%
- Pipeline: $${(grand_total?.total_pipeline_acv || 0).toLocaleString()}
- Pipeline Coverage: ${grand_total?.total_pipeline_coverage_x || 0}x

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

## Segment-Level Attainment (All Segments)
${allAttainment.map((row: any) =>
  `- ${row.product} ${row.region} ${row.category}: ${row.qtd_attainment_pct}% attainment, $${(row.qtd_gap || 0).toLocaleString()} gap, ${row.pipeline_coverage_x}x coverage, RAG: ${row.rag_status}`
).join('\n')}

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

## Loss Reasons (Top Issues)
${(loss_reason_rca?.POR || []).concat(loss_reason_rca?.R360 || []).slice(0, 10).map((row: any) =>
  `- ${row.loss_reason}: ${row.deal_count} deals, $${(row.lost_acv || 0).toLocaleString()} lost`
).join('\n')}

Provide your analysis in a structured format with clear headers. Be specific about which segments need attention and what actions should be taken. Include realistic assessments - don't sugarcoat underperformance.`;

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
    const { reportData, analysisType = 'bookings_miss' } = body;

    if (!reportData) {
      return NextResponse.json(
        { error: 'Report data is required' },
        { status: 400 }
      );
    }

    const prompt = buildAnalysisPrompt(reportData, analysisType);

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
