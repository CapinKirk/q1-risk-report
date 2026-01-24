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

// Build the analysis prompt based on report data
function buildAnalysisPrompt(reportData: any, analysisType: string, filterContext?: FilterContext): string {
  const {
    period, grand_total, product_totals, attainment_detail,
    funnel_by_category, funnel_by_source, pipeline_rca, loss_reason_rca,
    source_attainment, google_ads, google_ads_rca,
    mql_details, sql_details, mql_disqualification_summary
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
Using the Source Channel Attainment data:
- Rank ALL channels by dollar gap (largest miss first)
- Identify RED channels (below 50% attainment) with dollar impact
- Identify YELLOW channels (50-80% attainment) with recovery potential
- Identify overperforming channels (above 120%) as acceleration opportunities
- Channel diversification risk: over-reliance on any single source
- Channel mix recommendations by product

### 4. FUNNEL HEALTH & VELOCITY
- Stage-by-stage conversion analysis (MQL→SQL→SAL→SQO)
- Identify the worst funnel bottleneck by source and region
- Compare conversion rates across sources (which sources produce highest quality leads)
- Funnel pacing vs plan: where is top-of-funnel vs bottom-of-funnel relative to targets
- Lead quality indicators: MQL reversion rates, stall rates

### 5. PIPELINE RISK ASSESSMENT
- Coverage adequacy by segment (need 3x for healthy, below 2x is critical)
- Pipeline aging: segments with avg age >60 days (stale pipeline risk)
- Pipeline quality: segments marked "AT RISK" or "CRITICAL"
- Close probability: given current win rates, how much pipeline will actually close

### 6. WIN/LOSS PATTERN ANALYSIS
- Top loss reasons ranked by dollar impact
- Winnable losses: losses due to process failures (unresponsive, timing) vs market (competition, pricing)
- Loss rate trends by region and product
- Loss concentration: are losses concentrated in specific segments or distributed

### 7. MARKETING & CHANNEL EFFICIENCY
- Google Ads ROI by region: CPA relative to average deal size
- Spend efficiency: regions with highest/lowest conversion rates
- Channel cost-effectiveness ranking
- Recommendations for budget reallocation

### 8. PREDICTIVE INDICATORS & FORECAST
- Current daily run rate: $${Math.round(dailyRunRate).toLocaleString()}/day
- Required daily rate to hit Q1 target: $${Math.round(requiredDailyRate).toLocaleString()}/day
- Projected Q1 close (at current pace): $${Math.round(projectedQ1).toLocaleString()} (${projectedAttainment}% of target)
${includePOR ? `- POR projected: $${Math.round(porProjected).toLocaleString()} vs $${Math.round(porQ1Target).toLocaleString()} target` : ''}
${includeR360 ? `- R360 projected: $${Math.round(r360Projected).toLocaleString()} vs $${Math.round(r360Q1Target).toLocaleString()} target` : ''}
- Pipeline sufficiency: is there enough pipeline to close the remaining gap?
- Risk-adjusted forecast considering win rates and pipeline age

### 9. PRIORITIZED RECOMMENDATIONS
Provide 5-7 specific recommendations. Each recommendation MUST be a single dense sentence that includes ALL of the following inline:
- Priority prefix (P1/P2/P3)
- The word "Recommend" followed by the specific action
- The metric/data that justifies it (e.g., "to close the $128K EMEA gap", "given 42% attainment vs 75% target")
- Expected quantified impact (e.g., "recovering ~$50K in bookings", "improving pacing by 15 points")
- Owner and Timeframe at the end separated by semicolons

FORMAT EACH RECOMMENDATION AS A SEPARATE BULLET starting with "- P1 –":
- P1 – Recommend [specific action] to [address specific metric/gap from the data], targeting [quantified goal]; expected impact: [dollar/pipeline improvement]; Owner: [team]; Timeframe: [when].

EXAMPLE:
- P1 – Recommend accelerating 12 EMEA pipeline deals past Proposal stage to close the -$128K attainment gap, targeting $80K in incremental bookings this quarter; Owner: Sales Leadership; Timeframe: Immediate.
- P2 – Recommend reallocating senior AMER sales capacity to address the -$86,369 combined gap in AE-Sourced and Outbound; Owner: Sales Leadership; Timeframe: 30 days.

CRITICAL: Each recommendation MUST start on its own line with "- P[1-3] –". Every recommendation must reference a SPECIFIC number from the data. Generic recommendations will be rejected. NEVER combine multiple recommendations into one paragraph.

---

## FORMATTING RULES
- NEVER write paragraph blobs. Every data point must be a bullet or sub-bullet.
- Each section must use multi-level bullets: top-level "- " for main points, indented "  - " for supporting data.
- Each top-level bullet should have a **bold label:** followed by the key insight, then 1-3 sub-bullets with supporting metrics.
- Always include specific dollar amounts and percentages.
- Rank items by dollar impact (largest first).
- Be direct and honest - do not sugarcoat underperformance.
- Frame suggestions as "Recommend..." not "Action:" or "Next step:".
- Recommendations MUST each be on their own line starting with "- P[1-3] –".

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

${includePOR ? `## POR Performance
- Q1 Target: $${(porTotal.total_q1_target || 0).toLocaleString()}
- QTD Actual: $${(porTotal.total_qtd_acv || 0).toLocaleString()}
- Attainment: ${porTotal.total_qtd_attainment_pct || 0}%
- Pipeline Coverage: ${porTotal.total_pipeline_coverage_x || 0}x
- Lost Deals: ${porTotal.total_lost_deals || 0} worth $${(porTotal.total_lost_acv || 0).toLocaleString()}` : ''}

${includeR360 ? `## R360 Performance
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

${includeR360 ? `## Funnel Performance (R360 by Category)
${funnelData.R360.map((row: any) =>
  `- ${row.category} ${row.region}: MQL ${row.actual_mql}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct}%), SQL ${row.actual_sql}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct}%), SQO ${row.actual_sqo}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct}%)`
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
${includePOR ? `### POR MQL Status
- Total MQLs: ${dqSummary.POR?.total_mqls || 0}
- Reverted/Disqualified: ${dqSummary.POR?.reverted_count || 0} (${dqSummary.POR?.reverted_pct || 0}%)
- Converted to SQL: ${dqSummary.POR?.converted_count || 0} (${dqSummary.POR?.converted_pct || 0}%)
- Stalled (>30 days): ${dqSummary.POR?.stalled_count || 0} (${dqSummary.POR?.stalled_pct || 0}%)
- Active: ${dqSummary.POR?.active_count || 0}` : ''}

${includeR360 ? `### R360 MQL Status
- Total MQLs: ${dqSummary.R360?.total_mqls || 0}
- Reverted/Disqualified: ${dqSummary.R360?.reverted_count || 0} (${dqSummary.R360?.reverted_pct || 0}%)
- Converted to SQL: ${dqSummary.R360?.converted_count || 0} (${dqSummary.R360?.converted_pct || 0}%)
- Stalled (>30 days): ${dqSummary.R360?.stalled_count || 0} (${dqSummary.R360?.stalled_pct || 0}%)
- Active: ${dqSummary.R360?.active_count || 0}` : ''}

## Google Ads Performance
${includePOR ? `### POR Ads
${googleAdsData.POR.map((row: any) =>
  `- ${row.region}: $${(row.ad_spend_usd || 0).toLocaleString()} spend, ${row.clicks || 0} clicks, ${row.conversions || 0} conversions, CPA: $${row.cpa_usd || 'N/A'}`
).join('\n') || 'No POR ads data'}` : ''}

${includeR360 ? `### R360 Ads
${googleAdsData.R360.map((row: any) =>
  `- ${row.region}: $${(row.ad_spend_usd || 0).toLocaleString()} spend, ${row.clicks || 0} clicks, ${row.conversions || 0} conversions, CPA: $${row.cpa_usd || 'N/A'}`
).join('\n') || 'No R360 ads data'}` : ''}

## Source Channel Attainment (Revenue by Source)
${includePOR ? `### POR by Source
${sourceAttainmentData.POR.map((row: any) =>
  `- ${row.source} (${row.region}): Q1 Target $${(row.q1_target || 0).toLocaleString()}, QTD Target $${(row.qtd_target || 0).toLocaleString()}, QTD Actual $${(row.qtd_acv || 0).toLocaleString()}, Attainment ${row.attainment_pct || 0}%, Gap $${(row.gap || 0).toLocaleString()}, RAG: ${row.rag_status || 'N/A'}`
).join('\n') || 'No POR source attainment data'}` : ''}

${includeR360 ? `### R360 by Source
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
1. PRODUCE ALL 9 SECTIONS - do not skip any section. Each section must be DETAILED and COMPREHENSIVE.
2. Use SPECIFIC dollar amounts and percentages from the data above - never generalize. Every paragraph needs at least 2 data points.
3. Reference the pre-computed insights above to ensure accuracy
4. Frame ALL actions as "Recommend:" not "Action:" or "Next step:" or "Consider:"
5. RAG status meanings: GREEN (>80%), YELLOW (50-80%), RED (<50%) - call these out explicitly for EVERY region/product combo
6. For channel analysis: ALWAYS rank by dollar gap, ALWAYS identify RED channels by name, explain WHY each channel is underperforming
7. NEVER say "underperforming channels not identified" or "insufficient data" - the Source Channel Attainment section has COMPLETE data
8. Pipeline coverage: 3x+ = healthy, 2-3x = adequate, <2x = critical risk. Quantify the dollar risk.
9. Be DIRECT about underperformance - if a segment is failing, say so clearly with the dollar impact AND root cause hypothesis
10. Each recommendation MUST be a single dense sentence with: the specific data point driving it, the quantified target, the expected dollar impact, owner, and timeframe. Format: "P1 – Recommend [action] to [metric justification], targeting [goal]; expected impact: [quantified]; Owner: [team]; Timeframe: [when]." NO sub-bullets under recommendations.
11. Prioritize recommendations by ROI potential (largest gap with quickest fix first)
12. ${includePOR && includeR360 ? 'Compare products: explicitly note where R360 is trailing POR and why, with specific dollar and percentage comparisons' : `Focus exclusively on ${includePOR ? 'POR' : 'R360'} performance. Do NOT mention or reference ${includePOR ? 'R360' : 'POR'} in any way.`}
13. YOUR RESPONSE MUST BE AT LEAST 7000 CHARACTERS LONG AND CONTAIN ALL 9 SECTION HEADERS. DO NOT STOP EARLY OR ABBREVIATE. AIM FOR 8000-10000 CHARACTERS.
14. Each section must have at least 5 specific data-backed observations with dollar amounts. Never produce a section with fewer than 4 bullet points.
15. For EVERY underperforming segment, include: current value, target value, gap amount, percentage shortfall, and trend direction
16. Include regional breakdowns (AMER/EMEA/APAC) in EVERY section where data is available - do not aggregate away regional detail
17. In Win/Loss Patterns, analyze EACH loss reason category with dollar amounts and suggest specific countermeasures
18. In Predictive Indicators, provide SPECIFIC projected Q1 close amounts by category and region based on current run rates
19. Do NOT output "---" horizontal rules between sections. Section headers provide separation.

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

    const systemMessage = `You are a senior Revenue Operations analyst at a B2B SaaS company producing EXTREMELY DETAILED quarterly bookings analysis. You write LONG, COMPREHENSIVE reports with EXACTLY 9 sections: Executive Summary, Revenue Attainment Deep Dive, Channel Performance, Funnel Health & Velocity, Pipeline Risk, Win/Loss Patterns, Marketing & Channel Efficiency, Predictive Indicators, and Prioritized Recommendations. EVERY section must have 5+ data-backed observations. Include regional breakdowns (AMER/EMEA/APAC) in every section. ${productInstruction} Cite specific dollar amounts, percentages, and gaps throughout. Be brutally honest about underperformance with root cause analysis. Frame suggestions as recommendations with priority (P1/P2/P3). TARGET 8000-10000 CHARACTERS. NEVER stop before completing all 9 sections.

OUTPUT FORMAT (STRICT):
- Use ### for section headers (e.g., ### Executive Summary)
- Use #### for sub-headers when breaking down by region (e.g., #### AMER)
- EVERY section MUST use multi-level bullets:
  - Top-level: "- **Bold Label:** key insight or finding"
  - Sub-bullets: "  - supporting metric, data point, or implication"
- NEVER write paragraph blobs. ALL content must be structured as bullets with sub-bullets.
- Each top-level bullet should have 1-3 sub-bullets with supporting data.
- For Recommendations section: each recommendation on its own line starting with "- P[1-3] –"
- NEVER combine multiple recommendations into one paragraph or line.
- Do NOT use numbered lists for sections (no "1.", "2." prefix on headers)

EXAMPLE SECTION FORMAT:
### Revenue Attainment Deep Dive
- **POR AMER:** Expansion at 160% carrying the region (+$132K surplus)
  - Renewal at 116% (+$45K) provides secondary strength
  - Strategic at 0% (-$44K, 0.7x coverage) indicates total reliance on non-strategic motions
- **R360 AMER:** Structurally behind at 39% New Logo attainment (-$65K gap)
  - Pipeline coverage at 2.6x suggests win rate issues, not demand`;

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

    // GPT-5.2 now outputs structured markdown directly — no formatter needed

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
