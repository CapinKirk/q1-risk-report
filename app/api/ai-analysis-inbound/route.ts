import { NextResponse } from 'next/server';

export const maxDuration = 180; // Allow up to 180s for retries with longer outputs

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


// Build the inbound marketing analysis prompt
function buildInboundAnalysisPrompt(reportData: any, filterContext?: FilterContext): string {
  const {
    period, funnel_by_source, funnel_by_category, source_attainment,
    google_ads, google_ads_rca, mql_details, sql_details, sal_details,
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

  // Extract INBOUND source data only (for active products)
  const inboundSourcePOR = includePOR ? (funnel_by_source?.POR || []).filter((row: any) =>
    row.source?.toUpperCase() === 'INBOUND'
  ) : [];
  const inboundSourceR360 = includeR360 ? (funnel_by_source?.R360 || []).filter((row: any) =>
    row.source?.toUpperCase() === 'INBOUND'
  ) : [];

  // Get NEW LOGO category funnel data (primary inbound category)
  const newLogoPOR = includePOR ? (funnel_by_category?.POR || []).filter((row: any) =>
    row.category === 'NEW LOGO'
  ) : [];
  const newLogoR360 = includeR360 ? (funnel_by_category?.R360 || []).filter((row: any) =>
    row.category === 'NEW LOGO'
  ) : [];

  // Source attainment for inbound
  const inboundAttainmentPOR = includePOR ? (source_attainment?.POR || []).filter((row: any) =>
    row.source?.toUpperCase() === 'INBOUND'
  ) : [];
  const inboundAttainmentR360 = includeR360 ? (source_attainment?.R360 || []).filter((row: any) =>
    row.source?.toUpperCase() === 'INBOUND'
  ) : [];

  // Google Ads data (paid inbound)
  const googleAdsPOR = includePOR ? (google_ads?.POR || []) : [];
  const googleAdsR360 = includeR360 ? (google_ads?.R360 || []) : [];

  // MQL disqualification summary
  const dqSummary = mql_disqualification_summary || { POR: {}, R360: {} };

  // MQL detail statistics (for active products)
  const mqlDetailsPOR = includePOR ? (mql_details?.POR || []) : [];
  const mqlDetailsR360 = includeR360 ? (mql_details?.R360 || []) : [];

  // Calculate inbound MQL counts
  const inboundMqlPOR = mqlDetailsPOR.filter((m: any) =>
    m.source?.toUpperCase()?.includes('INBOUND') || m.source?.toUpperCase()?.includes('ORGANIC')
  );
  const inboundMqlR360 = mqlDetailsR360.filter((m: any) =>
    m.source?.toUpperCase()?.includes('INBOUND') || m.source?.toUpperCase()?.includes('ORGANIC')
  );

  // SQL details for conversion analysis (for active products)
  const sqlDetailsPOR = includePOR ? (sql_details?.POR || []) : [];
  const sqlDetailsR360 = includeR360 ? (sql_details?.R360 || []) : [];
  const inboundSqlPOR = sqlDetailsPOR.filter((s: any) =>
    s.source?.toUpperCase()?.includes('INBOUND') || s.source?.toUpperCase()?.includes('ORGANIC')
  );
  const inboundSqlR360 = sqlDetailsR360.filter((s: any) =>
    s.source?.toUpperCase()?.includes('INBOUND') || s.source?.toUpperCase()?.includes('ORGANIC')
  );

  // Calculate conversion metrics
  const calcConversionRate = (numerator: number, denominator: number) =>
    denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

  // MQL status breakdown - MUTUALLY EXCLUSIVE categories that sum to 100%
  const getMqlStatusBreakdown = (mqls: any[]) => {
    const total = mqls.length;
    // Converted to SQL (success path - these are no longer MQLs)
    const converted = mqls.filter(m => m.converted_to_sql === 'Yes').length;
    // Reverted/disqualified (failure path - removed from funnel)
    const reverted = mqls.filter(m => m.was_reverted && m.converted_to_sql !== 'Yes').length;
    // Stalled but not yet converted or reverted (at risk)
    const stalled = mqls.filter(m => m.mql_status === 'STALLED' && m.converted_to_sql !== 'Yes' && !m.was_reverted).length;
    // Still in progress - not converted, not reverted, not stalled (healthy pipeline)
    const inProgress = mqls.filter(m =>
      m.converted_to_sql !== 'Yes' &&
      !m.was_reverted &&
      m.mql_status !== 'STALLED'
    ).length;
    return { total, converted, reverted, stalled, inProgress };
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

  // Derived pacing metrics
  const daysElapsed = period?.days_elapsed || 1;
  const daysRemaining = period?.days_remaining || 68;
  const quarterPctComplete = period?.quarter_pct_complete || 0;

  // Pre-compute worst funnel bottlenecks
  const allInboundFunnel = [...inboundSourcePOR.map((r: any) => ({...r, product: 'POR'})), ...inboundSourceR360.map((r: any) => ({...r, product: 'R360'}))];
  const worstMqlPacing = allInboundFunnel.filter((r: any) => (r.qtd_target_mql || 0) > 5).sort((a: any, b: any) => (a.mql_pacing_pct || 0) - (b.mql_pacing_pct || 0)).slice(0, 5);
  const worstSqoPacing = allInboundFunnel.filter((r: any) => (r.qtd_target_sqo || 0) > 2).sort((a: any, b: any) => (a.sqo_pacing_pct || 0) - (b.sqo_pacing_pct || 0)).slice(0, 5);

  // Pre-compute worst inbound revenue gaps
  const allInboundAttainment = [...inboundAttainmentPOR.map((r: any) => ({...r, product: 'POR'})), ...inboundAttainmentR360.map((r: any) => ({...r, product: 'R360'}))];
  const worstInboundGaps = allInboundAttainment.filter((r: any) => (r.gap || 0) < 0).sort((a: any, b: any) => (a.gap || 0) - (b.gap || 0));

  // UTM Analysis - use pre-aggregated BigQuery data from utm_breakdown
  // Structure: { POR: { by_source: [], by_medium: [], by_campaign: [], by_keyword: [], by_branded: [] }, R360: {...} }
  const emptyUtm = { by_source: [], by_medium: [], by_campaign: [], by_keyword: [], by_branded: [] };
  const utmData = utm_breakdown || { POR: emptyUtm, R360: emptyUtm };

  const mapUtmDimension = (items: any[]) => items
    .filter((item: any) => item.name && item.name !== 'unknown' && item.name !== 'none')
    .map((item: any) => ({
      name: item.name,
      total: item.mql_count || 0,
      converted: item.sql_count || 0,
      stalled: 0,
      convRate: item.mql_to_sql_pct || 0,
      stallRate: 0,
      sqoCount: item.sqo_count || 0,
      sqoRate: item.mql_to_sqo_pct || 0,
    }))
    .slice(0, 10);

  // Get UTM breakdowns from BigQuery data
  const utmSourcePOR = mapUtmDimension(includePOR ? (utmData.POR?.by_source || []) : []);
  const utmSourceR360 = mapUtmDimension(includeR360 ? (utmData.R360?.by_source || []) : []);
  const utmMediumPOR = mapUtmDimension(includePOR ? (utmData.POR?.by_medium || []) : []);
  const utmMediumR360 = mapUtmDimension(includeR360 ? (utmData.R360?.by_medium || []) : []);
  const utmCampaignPOR = mapUtmDimension(includePOR ? (utmData.POR?.by_campaign || []) : []);
  const utmCampaignR360 = mapUtmDimension(includeR360 ? (utmData.R360?.by_campaign || []) : []);
  const utmKeywordPOR = mapUtmDimension(includePOR ? (utmData.POR?.by_keyword || []) : []);
  const utmKeywordR360 = mapUtmDimension(includeR360 ? (utmData.R360?.by_keyword || []) : []);

  // Branded vs Non-Branded keyword breakdown
  const brandedPOR = mapUtmDimension(includePOR ? (utmData.POR?.by_branded || []) : []);
  const brandedR360 = mapUtmDimension(includeR360 ? (utmData.R360?.by_branded || []) : []);

  // Campaign efficiency data (campaigns with spend data from Google Ads)
  const mapCampaignEfficiency = (items: any[]) => items
    .filter((item: any) => item.name && item.name !== 'unknown' && item.name !== 'none' && item.name !== 'Organic')
    .map((item: any) => ({
      name: item.name,
      mql: item.mql_count || 0,
      sql: item.sql_count || 0,
      sal: item.sal_count || 0,
      sqo: item.sqo_count || 0,
      mql_to_sql_pct: item.mql_to_sql_pct || 0,
      mql_to_sqo_pct: item.mql_to_sqo_pct || 0,
      spend: item.ad_spend_usd || 0,
      clicks: item.clicks || 0,
      cost_per_mql: item.cost_per_mql || 0,
      cost_per_sql: item.cost_per_sql || 0,
      cost_per_sqo: item.cost_per_sqo || 0,
    }))
    .slice(0, 15);

  const campaignEffPOR = mapCampaignEfficiency(includePOR ? (utmData.POR?.by_campaign || []) : []);
  const campaignEffR360 = mapCampaignEfficiency(includeR360 ? (utmData.R360?.by_campaign || []) : []);

  // Best/worst converting UTM sources (depends on UTM declarations above)
  const topConvertingUtmPOR = utmSourcePOR.filter(s => s.total >= 3).sort((a, b) => b.convRate - a.convRate).slice(0, 5);
  const worstConvertingUtmPOR = utmSourcePOR.filter(s => s.total >= 3).sort((a, b) => a.convRate - b.convRate).slice(0, 5);
  const topConvertingUtmR360 = utmSourceR360.filter(s => s.total >= 3).sort((a, b) => b.convRate - a.convRate).slice(0, 5);

  // === PAID FUNNEL CONVERSION ANALYSIS ===
  // Filter UTM data to paid sources only (cpc, paid, ppc, display, retargeting)
  const isPaidSource = (name: string) => {
    const n = (name || '').toLowerCase();
    return n.includes('google') || n.includes('cpc') || n.includes('paid') || n.includes('ppc') ||
           n.includes('display') || n.includes('bing') || n.includes('facebook') || n.includes('linkedin') ||
           n.includes('retargeting') || n === 'inbound';
  };

  const isOrganicSource = (name: string) => {
    const n = (name || '').toLowerCase();
    return n.includes('organic') || n.includes('direct') || n.includes('referral') || n.includes('seo') ||
           n.includes('social') || n.includes('email') || n.includes('content');
  };

  // Aggregate paid vs organic funnel metrics
  const aggregateFunnelByType = (utmSources: any[], campaigns: any[]) => {
    const paid = { mql: 0, sql: 0, sal: 0, sqo: 0, spend: 0 };
    const organic = { mql: 0, sql: 0, sal: 0, sqo: 0, spend: 0 };

    for (const s of utmSources) {
      if (isPaidSource(s.name)) {
        paid.mql += s.total || 0;
        paid.sql += s.converted || 0;
        paid.sqo += s.sqoCount || 0;
      } else if (isOrganicSource(s.name)) {
        organic.mql += s.total || 0;
        organic.sql += s.converted || 0;
        organic.sqo += s.sqoCount || 0;
      }
    }

    // Add spend from campaigns
    for (const c of campaigns) {
      paid.spend += c.spend || 0;
      paid.sal += c.sal || 0;
    }

    return {
      paid: {
        ...paid,
        mqlToSql: paid.mql > 0 ? Math.round((paid.sql / paid.mql) * 100) : 0,
        sqlToSqo: paid.sql > 0 ? Math.round((paid.sqo / paid.sql) * 100) : 0,
        mqlToSqo: paid.mql > 0 ? Math.round((paid.sqo / paid.mql) * 100) : 0,
        costPerMql: paid.mql > 0 ? Math.round(paid.spend / paid.mql) : 0,
        costPerSql: paid.sql > 0 ? Math.round(paid.spend / paid.sql) : 0,
        costPerSqo: paid.sqo > 0 ? Math.round(paid.spend / paid.sqo) : 0,
      },
      organic: {
        ...organic,
        mqlToSql: organic.mql > 0 ? Math.round((organic.sql / organic.mql) * 100) : 0,
        sqlToSqo: organic.sql > 0 ? Math.round((organic.sqo / organic.sql) * 100) : 0,
        mqlToSqo: organic.mql > 0 ? Math.round((organic.sqo / organic.mql) * 100) : 0,
      },
    };
  };

  const paidVsOrganicPOR = aggregateFunnelByType(utmSourcePOR, campaignEffPOR);
  const paidVsOrganicR360 = aggregateFunnelByType(utmSourceR360, campaignEffR360);

  // Campaign-level funnel breakdown (paid campaigns with full funnel data)
  const getCampaignFunnelBreakdown = (campaigns: any[]) => {
    return campaigns
      .filter(c => c.mql >= 3) // Minimum volume threshold
      .map(c => ({
        name: c.name,
        mql: c.mql,
        sql: c.sql,
        sal: c.sal,
        sqo: c.sqo,
        mqlToSql: c.mql > 0 ? Math.round((c.sql / c.mql) * 100) : 0,
        sqlToSal: c.sql > 0 ? Math.round((c.sal / c.sql) * 100) : 0,
        salToSqo: c.sal > 0 ? Math.round((c.sqo / c.sal) * 100) : 0,
        sqlToSqo: c.sql > 0 ? Math.round((c.sqo / c.sql) * 100) : 0,
        mqlToSqo: c.mql > 0 ? Math.round((c.sqo / c.mql) * 100) : 0,
        spend: c.spend,
        costPerSqo: c.sqo > 0 ? Math.round(c.spend / c.sqo) : c.spend > 0 ? Infinity : 0,
        funnelLeakage: c.mql > 0 ? Math.round(((c.mql - c.sqo) / c.mql) * 100) : 0,
      }))
      .sort((a, b) => b.mql - a.mql); // Sort by volume
  };

  const campaignFunnelPOR = getCampaignFunnelBreakdown(campaignEffPOR);
  const campaignFunnelR360 = getCampaignFunnelBreakdown(campaignEffR360);

  // Keyword-level funnel performance
  const getKeywordFunnelBreakdown = (keywords: any[]) => {
    return keywords
      .filter(k => k.total >= 2) // Minimum volume
      .map(k => ({
        name: k.name,
        mql: k.total,
        sql: k.converted,
        sqo: k.sqoCount,
        mqlToSql: k.convRate,
        mqlToSqo: k.sqoRate,
        funnelLeakage: k.total > 0 ? Math.round(((k.total - k.sqoCount) / k.total) * 100) : 0,
      }))
      .sort((a, b) => b.mql - a.mql);
  };

  const keywordFunnelPOR = getKeywordFunnelBreakdown(utmKeywordPOR);
  const keywordFunnelR360 = getKeywordFunnelBreakdown(utmKeywordR360);

  // Identify high-leakage campaigns (lots of MQLs, few SQOs)
  const highLeakageCampaigns = [...campaignFunnelPOR.map(c => ({...c, product: 'POR'})), ...campaignFunnelR360.map(c => ({...c, product: 'R360'}))]
    .filter(c => c.funnelLeakage > 70 && c.mql >= 5)
    .sort((a, b) => b.funnelLeakage - a.funnelLeakage)
    .slice(0, 5);

  // Identify high-efficiency campaigns (high MQL→SQO rate)
  const highEfficiencyCampaigns = [...campaignFunnelPOR.map(c => ({...c, product: 'POR'})), ...campaignFunnelR360.map(c => ({...c, product: 'R360'}))]
    .filter(c => c.mqlToSqo >= 30 && c.mql >= 3)
    .sort((a, b) => b.mqlToSqo - a.mqlToSqo)
    .slice(0, 5);

  // Ads efficiency (high CPA / low CTR)
  const highCpaAds = [...googleAdsPOR.map((r: any) => ({...r, product: 'POR'})), ...googleAdsR360.map((r: any) => ({...r, product: 'R360'}))]
    .filter((r: any) => r.cpa_usd && r.cpa_usd > 200)
    .sort((a: any, b: any) => (b.cpa_usd || 0) - (a.cpa_usd || 0));
  const lowCtrAds = [...googleAdsPOR.map((r: any) => ({...r, product: 'POR'})), ...googleAdsR360.map((r: any) => ({...r, product: 'R360'}))]
    .filter((r: any) => r.ctr_pct != null && r.ctr_pct < 3)
    .sort((a: any, b: any) => (a.ctr_pct || 0) - (b.ctr_pct || 0));

  const productDescription = includePOR && includeR360
    ? 'two products: POR (rental management) and R360 (asset inspection)'
    : includePOR
      ? 'POR (rental management software)'
      : 'R360 (asset inspection software)';

  const prompt = `You are a senior Inbound Marketing analyst at a B2B SaaS company (Point of Rental Software) reviewing Q1 2026 inbound performance for ${productDescription}.

Provide a comprehensive, data-driven inbound marketing analysis. Frame ALL suggested actions as RECOMMENDATIONS (never "actions" or "next steps"). Be specific with numbers, percentages, and dollar amounts. Every insight must reference the data provided.

${includeR360 ? '**R360 NOTE**: R360 does NOT have a SAL stage. R360 flows directly from SQL to SQO.' : ''}

---

## REQUIRED OUTPUT SECTIONS

### 1. EXECUTIVE SUMMARY (4 bullet points - NOT a paragraph)
FORMAT: Use 4 SHORT bullet points, one per line:
- **Overall Status**: Inbound is [on-track/at-risk/behind] with [X]% QTD pacing ([GREEN/YELLOW/RED])
- **Key Numbers**: [X] QTD MQLs vs [Y] target, [X]% MQL→SQO conversion
- **Biggest Risk**: [Channel/Campaign] at [X]% efficiency ([COLOR])
- **Action Needed**: [One sentence on priority action]
${includePOR && includeR360 ? '- Product divergence summary (POR vs R360 inbound performance)' : `- Regional performance summary for ${includePOR ? 'POR' : 'R360'} inbound`}

### 2. LEAD VOLUME & PACING ANALYSIS
For each product/region:
- MQL pacing vs target (actual/target, pacing %)
- SQL creation pacing vs target
- SQO creation pacing vs target
- Daily lead generation rate vs required rate to hit Q1 targets
- Volume gaps ranked by severity

### 3. FUNNEL CONVERSION ANALYSIS
Stage-by-stage breakdown:
- MQL→SQL conversion rates by product/region (threshold: 30%)
- SQL→SAL conversion (POR only, threshold: 50%)
- SAL→SQO conversion (POR only, threshold: 60%)
- SQL→SQO conversion (R360 only, threshold: 50%)
- Identify worst bottleneck by product/region with root cause
- Compare conversion rates across UTM sources (which sources produce highest quality leads)

### 4. PAID FUNNEL CONVERSION ANALYSIS (CRITICAL FOR BUDGET DECISIONS)
**Paid vs Organic Comparison** (use the Paid vs Organic Funnel Summary data):
- Compare MQL→SQL conversion: Paid vs Organic - which produces higher quality leads?
- Compare MQL→SQO conversion: Paid vs Organic - full-funnel efficiency
- Cost efficiency: Cost per MQL, Cost per SQL, Cost per SQO for paid traffic
- Identify if paid spend is generating quality leads or "MQL factories" that drop off

**Campaign-Level Funnel Breakdown** (use Campaign Funnel Performance data):
- For EACH campaign with spend, analyze conversion at every stage:
  - MQL→SQL conversion rate
  - SQL→SAL conversion rate (POR) or SQL→SQO (R360)
  - SAL→SQO conversion rate (POR)
  - Full funnel: MQL→SQO rate
- Identify campaigns with HIGH funnel leakage (lots of MQLs, few SQOs)
- Identify campaigns with HIGH efficiency (strong MQL→SQO despite lower volume)
- Calculate where in the funnel each campaign loses leads (MQL→SQL vs SQL→SQO)

**Keyword-Level Funnel Performance** (use Keyword Funnel Performance data):
- Rank keywords by MQL→SQO conversion rate (quality signal)
- Identify keywords generating MQLs that DON'T convert (wasted spend)
- Identify keywords generating MQLs that DO convert (invest more)
- Branded vs Non-Branded keyword funnel efficiency comparison

**Budget Reallocation Signal**:
- Based on funnel data, which campaigns/keywords deserve MORE budget?
- Which campaigns/keywords should be PAUSED due to poor funnel conversion?
- Quantify the SQO uplift if budget shifted from low-converting to high-converting campaigns

### 5. FUNNEL VELOCITY & STALL ANALYSIS
- Average days in each stage by product
- Stall rates: % of leads stuck >30 days in a stage
- MQL reversion/disqualification rates and causes
- Stage-specific velocity issues (where are leads getting stuck?)
- Impact of stalls on downstream pipeline creation

### 6. CHANNEL & CAMPAIGN EFFECTIVENESS
Using UTM data and Campaign Efficiency data:
- Rank UTM sources by MQL→SQL and MQL→SQO conversion rate
- Identify top-performing campaigns with conversion rates and SQO output
- Identify worst-performing campaigns (high volume, low conversion)
- Channel/medium mix analysis: which mediums (cpc, organic, etc.) drive quality vs quantity
- **Campaign Conversion Variance Analysis**: For each campaign with spend data, analyze where leads leak in the funnel. Compare MQL→SQL, SQL→SAL, and SAL→SQO (or SQL→SQO for R360) conversion rates BETWEEN campaigns. Identify which campaigns have the widest variance at each stage. Call out campaigns that generate MQLs but fail to convert downstream (MQL factories) vs campaigns that produce fewer MQLs but convert efficiently to SQO.
- **Campaign Attainment Contribution**: Calculate each campaign's share of total SQO output. Rank campaigns by their contribution to overall funnel attainment (SQO count / total SQOs). Identify campaigns punching above their spend weight (high SQO share relative to spend share) and those underperforming (high spend share, low SQO share).
- **UTM Keyword Analysis**: Rank keywords by volume and conversion efficiency. Identify high-intent keywords (high SQL/SQO conversion) vs low-intent keywords (high MQL, low conversion). Call out specific keyword opportunities.
- **Branded vs Non-Branded Breakdown**: Compare branded keyword performance (brand name searches) vs non-branded (generic/competitor terms). Analyze: volume split, conversion rate differences, SQO efficiency, and what this implies about demand generation vs demand capture strategy. Quantify the gap.

### 7. GOOGLE ADS PERFORMANCE, ROI & BUDGET OPTIMIZATION
- Spend efficiency by product and region
- CPA analysis: which regions are above $200 threshold (risk)
- CTR analysis: which regions are below 3% threshold (risk)
- **Cost per SQO ranking**: Rank ALL campaigns by cost-per-SQO (the true efficiency metric). Campaigns with $0 SQOs but significant spend are the worst performers. Compare cost/SQO across campaigns to identify the most and least efficient.
- **Efficiency Tiers**: Classify campaigns into efficiency tiers: Tier 1 (cost/SQO < $500), Tier 2 ($500-$1500), Tier 3 (>$1500 or no SQOs). Calculate total spend in each tier.
- **Optimal Budget Distribution**: Based on cost-per-SQO and conversion data, recommend how budget SHOULD be distributed vs how it IS distributed. Calculate the potential SQO uplift if budget were shifted from Tier 3 campaigns to Tier 1 campaigns. Provide specific dollar reallocation amounts.
- **Diminishing Returns Analysis**: For top-performing campaigns, assess whether they show signs of saturation (high spend but declining efficiency). Recommend incremental budget caps.
- Specific ads performance issues from RCA data

### 8. INBOUND REVENUE ATTRIBUTION
Using source attainment data:
- Revenue generated from inbound channel by product/region
- Attainment % vs target (RAG status)
- Dollar gaps from inbound underperformance
- Correlation between lead quality and revenue outcomes
- Inbound contribution to overall bookings targets

### 9. PREDICTIVE INDICATORS & FORECAST
- At current MQL rate, projected Q1 total MQLs vs target
- At current conversion rates, projected SQLs and SQOs
- Pipeline generation forecast from inbound
- Risk-adjusted forecast considering stall rates and conversion trends
- Leading indicators: are trends improving or deteriorating?

### 10. PRIORITIZED RECOMMENDATIONS
Provide 5-7 specific recommendations. Each recommendation MUST be a single dense sentence that includes ALL of the following inline:
- Priority prefix (P1/P2/P3)
- The word "Recommend" followed by the specific action
- The metric/data that justifies it (e.g., "to close the 41-MQL gap", "targeting a CPA reduction from $702 to <$300")
- Expected quantified impact (e.g., "with expected savings of ~$8,000", "improving attainment by ~$2,000")
- Owner and Timeframe at the end separated by semicolons

FORMAT EACH RECOMMENDATION - CRITICAL BOLD FORMATTING:

Each recommendation MUST be formatted EXACTLY like this (copy this pattern):
- **P1 – Recommend [action]; expected impact: [impact]; Owner: [owner]; Timeframe: [time].**

Character-by-character: dash SPACE asterisk asterisk P 1 SPACE ... period asterisk asterisk

EXAMPLES OF CORRECT OUTPUT:
- **P1 – Recommend pausing Search campaigns; expected impact: ~$5K savings; Owner: Paid Media; Timeframe: Immediate.**
- **P2 – Recommend scaling branded keywords; expected impact: +15 SQOs; Owner: Growth Marketing; Timeframe: Q1.**

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
- Section 1 (Executive Summary): 4 SHORT bullet points (Overall Status, Key Numbers, Biggest Risk, Action Needed) - NOT a paragraph
- Section 10 (Recommendations): BOLD flat bullets starting with "- **P[1-3] – Recommend..." and ending with "**"
- **STRUCTURE FOR SECTIONS 2-9 (multi-level bullets with sub-bullets):**
  - Top-level bullet: "- **[Label from data]:** [key insight with specific metric]"
  - Sub-bullets (REQUIRED): "  - [supporting metric or implication]" (indent with 2 spaces)
  - EVERY top-level bullet MUST have 1-3 sub-bullets with specific data from the context above

- Always include specific dollar amounts and percentages in sub-bullets.
- Rank items by impact (largest gap or worst performance first).
- Be direct about underperformance - name specific channels/campaigns that are failing.
- Frame suggestions as "Recommend..." not "Action:" or "Next step:".

**REMINDER: Every bullet in sections 2-9 needs sub-bullets. If you write a flat bullet list without indented sub-bullets, the output is INVALID.**

${filterDescription}

## Current Period
- As of Date: ${period?.as_of_date || 'N/A'}
- Quarter Progress: ${period?.quarter_pct_complete || 0}% complete
- Days Elapsed: ${period?.days_elapsed || 0} of ${period?.total_days || 90}

${includePOR ? `## POR INBOUND FUNNEL DATA BY REGION
${inboundSourcePOR.map((row: any) =>
  `- ${row.region}: MQL ${row.actual_mql || 0}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql || 0}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct || 0}%), SQO ${row.actual_sqo || 0}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct || 0}%)`
).join('\n') || 'No POR inbound data available'}` : ''}

${includeR360 ? `## R360 INBOUND FUNNEL DATA BY REGION
${inboundSourceR360.map((row: any) =>
  `- ${row.region}: MQL ${row.actual_mql || 0}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql || 0}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct || 0}%), SQO ${row.actual_sqo || 0}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct || 0}%)`
).join('\n') || 'No R360 inbound data available'}` : ''}

${includePOR ? `## POR NEW LOGO FUNNEL (Primary Inbound Category)
${newLogoPOR.map((row: any) =>
  `- ${row.region}: MQL ${row.actual_mql || 0}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql || 0}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct || 0}%), SAL ${row.actual_sal || 0}/${row.qtd_target_sal || 0} (${row.sal_pacing_pct || 0}%), SQO ${row.actual_sqo || 0}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct || 0}%)`
).join('\n') || 'No POR NEW LOGO data'}` : ''}

${includeR360 ? `## R360 NEW LOGO FUNNEL (Note: R360 has no SAL stage - direct SQL→SQO)
${newLogoR360.map((row: any) =>
  `- ${row.region}: MQL ${row.actual_mql || 0}/${row.qtd_target_mql || 0} (${row.mql_pacing_pct || 0}%), SQL ${row.actual_sql || 0}/${row.qtd_target_sql || 0} (${row.sql_pacing_pct || 0}%), SQO ${row.actual_sqo || 0}/${row.qtd_target_sqo || 0} (${row.sqo_pacing_pct || 0}%)`
).join('\n') || 'No R360 NEW LOGO data'}` : ''}

## INBOUND SOURCE ATTAINMENT (Revenue)
${includePOR ? `### POR Inbound Revenue Attainment
${inboundAttainmentPOR.map((row: any) =>
  `- ${row.region}: ${row.attainment_pct || 0}% attainment, $${(row.gap || 0).toLocaleString()} gap, RAG: ${row.rag_status || 'N/A'}`
).join('\n') || 'No POR inbound attainment data'}` : ''}

${includeR360 ? `### R360 Inbound Revenue Attainment
${inboundAttainmentR360.map((row: any) =>
  `- ${row.region}: ${row.attainment_pct || 0}% attainment, $${(row.gap || 0).toLocaleString()} gap, RAG: ${row.rag_status || 'N/A'}`
).join('\n') || 'No R360 inbound attainment data'}` : ''}

## MQL QUALITY ANALYSIS
${includePOR ? `### POR MQL Status Breakdown (MUTUALLY EXCLUSIVE - sums to 100%)
- Total Inbound MQLs: ${porMqlStatus.total}
- Converted to SQL (success): ${porMqlStatus.converted} (${calcConversionRate(porMqlStatus.converted, porMqlStatus.total)}%)
- Reverted/Disqualified (lost): ${porMqlStatus.reverted} (${calcConversionRate(porMqlStatus.reverted, porMqlStatus.total)}%)
- Stalled >30 days (at risk): ${porMqlStatus.stalled} (${calcConversionRate(porMqlStatus.stalled, porMqlStatus.total)}%)
- In Progress (healthy pipeline): ${porMqlStatus.inProgress} (${calcConversionRate(porMqlStatus.inProgress, porMqlStatus.total)}%)
- MATH CHECK: ${porMqlStatus.converted} + ${porMqlStatus.reverted} + ${porMqlStatus.stalled} + ${porMqlStatus.inProgress} = ${porMqlStatus.converted + porMqlStatus.reverted + porMqlStatus.stalled + porMqlStatus.inProgress} (should equal ${porMqlStatus.total})
- Average Days in MQL Stage: ${avgDaysInStage(inboundMqlPOR)}` : ''}

${includeR360 ? `### R360 MQL Status Breakdown (MUTUALLY EXCLUSIVE - sums to 100%)
- Total Inbound MQLs: ${r360MqlStatus.total}
- Converted to SQL (success): ${r360MqlStatus.converted} (${calcConversionRate(r360MqlStatus.converted, r360MqlStatus.total)}%)
- Reverted/Disqualified (lost): ${r360MqlStatus.reverted} (${calcConversionRate(r360MqlStatus.reverted, r360MqlStatus.total)}%)
- Stalled >30 days (at risk): ${r360MqlStatus.stalled} (${calcConversionRate(r360MqlStatus.stalled, r360MqlStatus.total)}%)
- In Progress (healthy pipeline): ${r360MqlStatus.inProgress} (${calcConversionRate(r360MqlStatus.inProgress, r360MqlStatus.total)}%)
- MATH CHECK: ${r360MqlStatus.converted} + ${r360MqlStatus.reverted} + ${r360MqlStatus.stalled} + ${r360MqlStatus.inProgress} = ${r360MqlStatus.converted + r360MqlStatus.reverted + r360MqlStatus.stalled + r360MqlStatus.inProgress} (should equal ${r360MqlStatus.total})
- Average Days in MQL Stage: ${avgDaysInStage(inboundMqlR360)}` : ''}

### Overall MQL Disqualification Summary
${includePOR ? `- POR: ${dqSummary.POR?.reverted_pct || 0}% reverted, ${dqSummary.POR?.converted_pct || 0}% converted, ${dqSummary.POR?.stalled_pct || 0}% stalled` : ''}
${includeR360 ? `- R360: ${dqSummary.R360?.reverted_pct || 0}% reverted, ${dqSummary.R360?.converted_pct || 0}% converted, ${dqSummary.R360?.stalled_pct || 0}% stalled` : ''}

## PAID vs ORGANIC FUNNEL SUMMARY (USE THIS FOR SECTION 4)
${includePOR ? `### POR - Paid vs Organic Funnel Conversion
**PAID Traffic:**
- MQLs: ${paidVsOrganicPOR.paid.mql}, SQLs: ${paidVsOrganicPOR.paid.sql}, SQOs: ${paidVsOrganicPOR.paid.sqo}
- MQL→SQL: ${paidVsOrganicPOR.paid.mqlToSql}%, SQL→SQO: ${paidVsOrganicPOR.paid.sqlToSqo}%, MQL→SQO: ${paidVsOrganicPOR.paid.mqlToSqo}%
- Total Spend: $${paidVsOrganicPOR.paid.spend.toLocaleString()}
- Cost per MQL: $${paidVsOrganicPOR.paid.costPerMql}, Cost per SQL: $${paidVsOrganicPOR.paid.costPerSql}, Cost per SQO: $${paidVsOrganicPOR.paid.costPerSqo}
**ORGANIC Traffic:**
- MQLs: ${paidVsOrganicPOR.organic.mql}, SQLs: ${paidVsOrganicPOR.organic.sql}, SQOs: ${paidVsOrganicPOR.organic.sqo}
- MQL→SQL: ${paidVsOrganicPOR.organic.mqlToSql}%, SQL→SQO: ${paidVsOrganicPOR.organic.sqlToSqo}%, MQL→SQO: ${paidVsOrganicPOR.organic.mqlToSqo}%` : ''}

${includeR360 ? `### R360 - Paid vs Organic Funnel Conversion
**PAID Traffic:**
- MQLs: ${paidVsOrganicR360.paid.mql}, SQLs: ${paidVsOrganicR360.paid.sql}, SQOs: ${paidVsOrganicR360.paid.sqo}
- MQL→SQL: ${paidVsOrganicR360.paid.mqlToSql}%, SQL→SQO: ${paidVsOrganicR360.paid.sqlToSqo}%, MQL→SQO: ${paidVsOrganicR360.paid.mqlToSqo}%
- Total Spend: $${paidVsOrganicR360.paid.spend.toLocaleString()}
- Cost per MQL: $${paidVsOrganicR360.paid.costPerMql}, Cost per SQL: $${paidVsOrganicR360.paid.costPerSql}, Cost per SQO: $${paidVsOrganicR360.paid.costPerSqo}
**ORGANIC Traffic:**
- MQLs: ${paidVsOrganicR360.organic.mql}, SQLs: ${paidVsOrganicR360.organic.sql}, SQOs: ${paidVsOrganicR360.organic.sqo}
- MQL→SQL: ${paidVsOrganicR360.organic.mqlToSql}%, SQL→SQO: ${paidVsOrganicR360.organic.sqlToSqo}%, MQL→SQO: ${paidVsOrganicR360.organic.mqlToSqo}%` : ''}

## CAMPAIGN FUNNEL PERFORMANCE (USE THIS FOR SECTION 4)
${includePOR ? `### POR - Campaign-Level Funnel Breakdown
${campaignFunnelPOR.length > 0 ? campaignFunnelPOR.slice(0, 10).map((c: any) =>
  `- ${c.name}: ${c.mql} MQLs → ${c.sql} SQLs (${c.mqlToSql}%) → ${c.sal} SALs (${c.sqlToSal}%) → ${c.sqo} SQOs (${c.salToSqo}%), Full funnel: ${c.mqlToSqo}% MQL→SQO, Leakage: ${c.funnelLeakage}%${c.spend > 0 ? `, Spend: $${c.spend.toLocaleString()}, Cost/SQO: $${c.costPerSqo === Infinity ? '∞ (no SQOs)' : c.costPerSqo}` : ''}`
).join('\n') : 'No campaign funnel data'}` : ''}

${includeR360 ? `### R360 - Campaign-Level Funnel Breakdown
${campaignFunnelR360.length > 0 ? campaignFunnelR360.slice(0, 10).map((c: any) =>
  `- ${c.name}: ${c.mql} MQLs → ${c.sql} SQLs (${c.mqlToSql}%) → ${c.sqo} SQOs (${c.sqlToSqo}%), Full funnel: ${c.mqlToSqo}% MQL→SQO, Leakage: ${c.funnelLeakage}%${c.spend > 0 ? `, Spend: $${c.spend.toLocaleString()}, Cost/SQO: $${c.costPerSqo === Infinity ? '∞ (no SQOs)' : c.costPerSqo}` : ''}`
).join('\n') : 'No campaign funnel data'}` : ''}

## HIGH-LEAKAGE CAMPAIGNS (Lots of MQLs, Few SQOs - Budget Risk)
${highLeakageCampaigns.length > 0 ? highLeakageCampaigns.map((c: any) =>
  `- ${c.product} ${c.name}: ${c.mql} MQLs but only ${c.sqo} SQOs, ${c.funnelLeakage}% leakage, MQL→SQO: ${c.mqlToSqo}%${c.spend > 0 ? `, Spend: $${c.spend.toLocaleString()}` : ''}`
).join('\n') : 'No high-leakage campaigns identified'}

## HIGH-EFFICIENCY CAMPAIGNS (Strong MQL→SQO Conversion - Investment Opportunities)
${highEfficiencyCampaigns.length > 0 ? highEfficiencyCampaigns.map((c: any) =>
  `- ${c.product} ${c.name}: ${c.mql} MQLs → ${c.sqo} SQOs, ${c.mqlToSqo}% MQL→SQO${c.spend > 0 ? `, Spend: $${c.spend.toLocaleString()}, Cost/SQO: $${c.costPerSqo}` : ''}`
).join('\n') : 'No high-efficiency campaigns identified'}

## KEYWORD FUNNEL PERFORMANCE
${includePOR ? `### POR - Keyword-Level Funnel
${keywordFunnelPOR.length > 0 ? keywordFunnelPOR.slice(0, 10).map((k: any) =>
  `- ${k.name}: ${k.mql} MQLs → ${k.sql} SQLs (${k.mqlToSql}%) → ${k.sqo} SQOs (${k.mqlToSqo}% MQL→SQO), Leakage: ${k.funnelLeakage}%`
).join('\n') : 'No keyword funnel data'}` : ''}

${includeR360 ? `### R360 - Keyword-Level Funnel
${keywordFunnelR360.length > 0 ? keywordFunnelR360.slice(0, 10).map((k: any) =>
  `- ${k.name}: ${k.mql} MQLs → ${k.sql} SQLs (${k.mqlToSql}%) → ${k.sqo} SQOs (${k.mqlToSqo}% MQL→SQO), Leakage: ${k.funnelLeakage}%`
).join('\n') : 'No keyword funnel data'}` : ''}

## UTM SOURCE ANALYSIS (Lead Origin Tracking from BigQuery MarketingFunnel)
${includePOR ? `### POR - By UTM Source (Top 10)
${utmSourcePOR.length > 0 ? utmSourcePOR.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM source data'}` : ''}

${includeR360 ? `### R360 - By UTM Source (Top 10)
${utmSourceR360.length > 0 ? utmSourceR360.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM source data'}` : ''}

## UTM MEDIUM ANALYSIS (Traffic Channel Type)
${includePOR ? `### POR - By UTM Medium
${utmMediumPOR.length > 0 ? utmMediumPOR.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM medium data'}` : ''}

${includeR360 ? `### R360 - By UTM Medium
${utmMediumR360.length > 0 ? utmMediumR360.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM medium data'}` : ''}

## UTM CAMPAIGN ANALYSIS
${includePOR ? `### POR - By UTM Campaign (Top 10)
${utmCampaignPOR.length > 0 ? utmCampaignPOR.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM campaign data'}` : ''}

${includeR360 ? `### R360 - By UTM Campaign (Top 10)
${utmCampaignR360.length > 0 ? utmCampaignR360.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM campaign data'}` : ''}

## UTM KEYWORD ANALYSIS
${includePOR ? `### POR - By UTM Keyword/Term (Top 10)
${utmKeywordPOR.length > 0 ? utmKeywordPOR.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM keyword data'}` : ''}

${includeR360 ? `### R360 - By UTM Keyword/Term (Top 10)
${utmKeywordR360.length > 0 ? utmKeywordR360.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs, ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No UTM keyword data'}` : ''}

## BRANDED vs NON-BRANDED KEYWORD ANALYSIS
${includePOR ? `### POR - Branded vs Non-Branded Keywords
${brandedPOR.length > 0 ? brandedPOR.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs (${s.total > 0 ? Math.round((s.total / (brandedPOR.reduce((sum: number, x: any) => sum + x.total, 0) || 1)) * 100) : 0}% of total), ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No branded/non-branded data'}` : ''}

${includeR360 ? `### R360 - Branded vs Non-Branded Keywords
${brandedR360.length > 0 ? brandedR360.map((s: any) =>
  `- ${s.name}: ${s.total} MQLs (${s.total > 0 ? Math.round((s.total / (brandedR360.reduce((sum: number, x: any) => sum + x.total, 0) || 1)) * 100) : 0}% of total), ${s.convRate}% MQL→SQL, ${s.sqoRate}% MQL→SQO, ${s.sqoCount} SQOs`
).join('\n') : 'No branded/non-branded data'}` : ''}

## CAMPAIGN-LEVEL EFFICIENCY & FUNNEL CONTRIBUTION (Google Ads Spend Matched to Funnel Outcomes)
${includePOR ? `### POR Campaign Performance (Spend + Funnel Conversion)
${campaignEffPOR.filter((c: any) => c.spend > 0).length > 0 ? campaignEffPOR.filter((c: any) => c.spend > 0).map((c: any) =>
  `- ${c.name}: $${c.spend.toLocaleString()} spend | ${c.mql} MQLs, ${c.sql} SQLs, ${c.sal} SALs, ${c.sqo} SQOs | MQL→SQL ${c.mql_to_sql_pct}%, MQL→SQO ${c.mql_to_sqo_pct}% | Cost/MQL: $${c.cost_per_mql}, Cost/SQL: $${c.cost_per_sql}, Cost/SQO: $${c.cost_per_sqo > 0 ? c.cost_per_sqo : 'N/A (0 SQOs)'}`
).join('\n') : 'No POR campaign spend data matched'}
${campaignEffPOR.filter((c: any) => c.spend === 0 && c.mql > 0).length > 0 ? `\nPOR Campaigns with MQLs but NO matched spend (organic/untracked):
${campaignEffPOR.filter((c: any) => c.spend === 0 && c.mql > 0).map((c: any) =>
  `- ${c.name}: ${c.mql} MQLs, ${c.sql} SQLs, ${c.sqo} SQOs | MQL→SQO ${c.mql_to_sqo_pct}%`
).join('\n')}` : ''}` : ''}

${includeR360 ? `### R360 Campaign Performance (Spend + Funnel Conversion)
${campaignEffR360.filter((c: any) => c.spend > 0).length > 0 ? campaignEffR360.filter((c: any) => c.spend > 0).map((c: any) =>
  `- ${c.name}: $${c.spend.toLocaleString()} spend | ${c.mql} MQLs, ${c.sql} SQLs, ${c.sal} SALs, ${c.sqo} SQOs | MQL→SQL ${c.mql_to_sql_pct}%, MQL→SQO ${c.mql_to_sqo_pct}% | Cost/MQL: $${c.cost_per_mql}, Cost/SQL: $${c.cost_per_sql}, Cost/SQO: $${c.cost_per_sqo > 0 ? c.cost_per_sqo : 'N/A (0 SQOs)'}`
).join('\n') : 'No R360 campaign spend data matched'}
${campaignEffR360.filter((c: any) => c.spend === 0 && c.mql > 0).length > 0 ? `\nR360 Campaigns with MQLs but NO matched spend (organic/untracked):
${campaignEffR360.filter((c: any) => c.spend === 0 && c.mql > 0).map((c: any) =>
  `- ${c.name}: ${c.mql} MQLs, ${c.sql} SQLs, ${c.sqo} SQOs | MQL→SQO ${c.mql_to_sqo_pct}%`
).join('\n')}` : ''}` : ''}

## GOOGLE ADS PERFORMANCE (Paid Inbound)
${includePOR ? `### POR Google Ads by Region
${googleAdsPOR.map((row: any) =>
  `- ${row.region}: $${(row.ad_spend_usd || 0).toLocaleString()} spend, ${row.clicks || 0} clicks, CTR: ${row.ctr_pct || 0}%, ${row.conversions || 0} conversions, CPA: $${row.cpa_usd || 'N/A'}`
).join('\n') || 'No POR ads data'}

Total POR Ad Spend: $${totalAdSpendPOR.toLocaleString()} | Total Conversions: ${totalConversionsPOR} | Blended CPA: $${totalConversionsPOR > 0 ? Math.round(totalAdSpendPOR / totalConversionsPOR) : 'N/A'}` : ''}

${includeR360 ? `### R360 Google Ads by Region
${googleAdsR360.map((row: any) =>
  `- ${row.region}: $${(row.ad_spend_usd || 0).toLocaleString()} spend, ${row.clicks || 0} clicks, CTR: ${row.ctr_pct || 0}%, ${row.conversions || 0} conversions, CPA: $${row.cpa_usd || 'N/A'}`
).join('\n') || 'No R360 ads data'}

Total R360 Ad Spend: $${totalAdSpendR360.toLocaleString()} | Total Conversions: ${totalConversionsR360} | Blended CPA: $${totalConversionsR360 > 0 ? Math.round(totalAdSpendR360 / totalConversionsR360) : 'N/A'}` : ''}

### Google Ads RCA (Performance Issues)
${(includePOR ? (google_ads_rca?.POR || []) : []).concat(includeR360 ? (google_ads_rca?.R360 || []) : []).map((row: any) =>
  `- ${row.product} ${row.region}: CTR ${row.ctr_pct}% (${row.ctr_performance}), CPA $${row.cpa_usd} (${row.cpa_performance}). ${row.rca_commentary}`
).join('\n') || 'No ads RCA data'}

## SQL CONVERSION ANALYSIS
${includePOR ? `### POR Inbound SQLs
- Total Inbound SQLs: ${inboundSqlPOR.length}
- With Opportunity: ${inboundSqlPOR.filter((s: any) => s.has_opportunity === 'Yes').length}
- Converted to SAL: ${inboundSqlPOR.filter((s: any) => s.converted_to_sal === 'Yes').length}
- Converted to SQO: ${inboundSqlPOR.filter((s: any) => s.converted_to_sqo === 'Yes').length}
- Average Days MQL→SQL: ${Math.round(inboundSqlPOR.reduce((sum: number, s: any) => sum + (s.days_mql_to_sql || 0), 0) / (inboundSqlPOR.length || 1))}` : ''}

${includeR360 ? `### R360 Inbound SQLs (Note: R360 has no SAL stage - direct SQL→SQO)
- Total Inbound SQLs: ${inboundSqlR360.length}
- With Opportunity: ${inboundSqlR360.filter((s: any) => s.has_opportunity === 'Yes').length}
- Converted to SQO: ${inboundSqlR360.filter((s: any) => s.converted_to_sqo === 'Yes').length}
- Average Days MQL→SQL: ${Math.round(inboundSqlR360.reduce((sum: number, s: any) => sum + (s.days_mql_to_sql || 0), 0) / (inboundSqlR360.length || 1))}` : ''}

## PRE-COMPUTED KEY INSIGHTS (use these to anchor your analysis)

### Worst Inbound Revenue Gaps
${worstInboundGaps.map((r: any) => `- ${r.product} Inbound (${r.region}): -$${Math.abs(r.gap || 0).toLocaleString()} gap, ${r.attainment_pct || 0}% attainment, RAG: ${r.rag_status}`).join('\n') || 'No inbound gaps identified'}

### Worst MQL Pacing
${worstMqlPacing.map((r: any) => `- ${r.product} (${r.region}): MQL pacing ${r.mql_pacing_pct || 0}% (${r.actual_mql || 0} of ${r.qtd_target_mql || 0} target)`).join('\n') || 'All MQL pacing on track'}

### Worst SQO Pacing
${worstSqoPacing.map((r: any) => `- ${r.product} (${r.region}): SQO pacing ${r.sqo_pacing_pct || 0}% (${r.actual_sqo || 0} of ${r.qtd_target_sqo || 0} target)`).join('\n') || 'All SQO pacing on track'}

### High CPA Regions (above $200 threshold)
${highCpaAds.map((r: any) => `- ${r.product} (${r.region}): CPA $${r.cpa_usd}, spend $${(r.ad_spend_usd || 0).toLocaleString()}, ${r.conversions || 0} conversions`).join('\n') || 'All CPAs below threshold'}

### Low CTR Regions (below 3% threshold)
${lowCtrAds.map((r: any) => `- ${r.product} (${r.region}): CTR ${r.ctr_pct}%, ${r.clicks || 0} clicks, spend $${(r.ad_spend_usd || 0).toLocaleString()}`).join('\n') || 'All CTRs above threshold'}

${includePOR ? `### Top Converting UTM Sources (POR)
${topConvertingUtmPOR.map((s: any) => `- ${s.name}: ${s.convRate}% MQL→SQL, ${s.sqoRate || 0}% MQL→SQO, ${s.total} MQLs`).join('\n') || 'No UTM source data'}

### Worst Converting UTM Sources (POR)
${worstConvertingUtmPOR.map((s: any) => `- ${s.name}: ${s.convRate}% MQL→SQL, ${s.sqoRate || 0}% MQL→SQO, ${s.total} MQLs`).join('\n') || 'No UTM source data'}` : ''}

${includeR360 ? `### Top Converting UTM Sources (R360)
${topConvertingUtmR360.map((s: any) => `- ${s.name}: ${s.convRate}% MQL→SQL, ${s.sqoRate || 0}% MQL→SQO, ${s.total} MQLs`).join('\n') || 'No UTM source data'}` : ''}

### Period Context
- Quarter ${quarterPctComplete}% complete (${daysElapsed} days elapsed, ${daysRemaining} remaining)

## CRITICAL RULES
1. PRODUCE ALL 10 SECTIONS - do not skip any section. Each section must be DETAILED and COMPREHENSIVE.
2. **ZERO TOLERANCE FOR FABRICATED NUMBERS**: You MUST use ONLY the exact numbers provided in the data sections above. NEVER calculate, derive, estimate, or round numbers yourself. If you output a number that differs from what's in the data context, the ENTIRE response will be rejected.
3. ALL METRICS MUST BE EXPLICITLY QTD: Every attainment %, variance %, dollar amount, and count MUST be labeled as QTD. Examples: "QTD MQL pacing: 85%", "$12K QTD spend", "QTD gap: -41 MQLs", "15 QTD conversions". NEVER show a metric without the QTD prefix/suffix.
4. Reference the pre-computed insights above to ensure accuracy - use those numbers EXACTLY
5. Frame ALL actions as "Recommend:" not "Action:" or "Next step:" or "Consider:"
6. R360 has NO SAL stage - flows directly from SQL to SQO. Explain this difference in funnel analysis.
7. Conversion thresholds: MQL→SQL 30%, SQL→SAL 50% (POR), SAL→SQO 60% (POR), SQL→SQO 50% (R360). Call out EVERY threshold breach with specific numbers.
8. Ads thresholds: CPA above $200 = risk, CTR below 3% = risk. Quantify the dollar waste for each breach.
9. Be DIRECT about failures - name specific channels, campaigns, UTM sources, and regions that are underperforming with exact numbers
10. Every recommendation MUST be a single dense sentence with: the specific data point driving it, the quantified target, the expected dollar/lead impact, owner, and timeframe. Format: "P1 – Recommend [action] to [metric justification], targeting [goal]; expected impact: [quantified]; Owner: [team]; Timeframe: [when]." NO sub-bullets under recommendations.
11. When UTM data shows no matches, analyze the available funnel and ads data instead
12. ${includePOR && includeR360 ? 'Compare POR vs R360 inbound effectiveness explicitly with specific conversion rate and volume comparisons per region' : `Focus exclusively on ${includePOR ? 'POR' : 'R360'} inbound performance. Do NOT mention or reference ${includePOR ? 'R360' : 'POR'} - it is excluded from this analysis.`}
13. Prioritize recommendations by lead-to-revenue impact potential
14. YOUR RESPONSE MUST BE AT LEAST 7000 CHARACTERS LONG AND CONTAIN ALL 10 SECTION HEADERS. DO NOT STOP EARLY OR ABBREVIATE. AIM FOR 8000-10000 CHARACTERS.
15. Each section must have at least 5 specific data-backed observations. Never produce a section with fewer than 4 bullet points.
16. Include regional breakdowns (AMER/EMEA/APAC) in EVERY section where data is available - do not aggregate away regional detail
17. For Lead Volume section: break down MQL counts by region, by product, show pacing %, and compare to target for each
18. For Google Ads: analyze each region separately with spend, CPA, CTR, conversion rate, and ROI assessment
19. In Predictive Indicators: project Q1 lead volumes, conversion rates, and revenue impact by product and region based on current trends
20. CAMPAIGN EFFICIENCY: When campaign-level spend data is available, you MUST analyze conversion variances BETWEEN campaigns (not just overall rates). Compare each campaign's MQL→SQL→SQO funnel individually. Rank by cost-per-SQO, NOT cost-per-MQL.
21. BUDGET OPTIMIZATION: Identify campaigns where spend share >> SQO share as wasteful. Recommend specific dollar amounts to reallocate.
22. Do NOT output "---" horizontal rules between sections.
23. **DO NOT MENTION QUARTER PROGRESS**: NEVER compare attainment/pacing to quarter progress percentage. NEVER say "at X% quarter progress" or "vs Y% benchmark". Only show QTD attainment or pacing (actual/target). The quarter progress is ${quarterPctComplete}% but do NOT include this in your analysis output.
24. **ATTAINMENT COLOR CODING**: >=100% = GREEN, 70-99% = YELLOW, <70% = RED. Apply this color coding to every attainment percentage mentioned.
25. **FUNNEL MATH CONSISTENCY (CRITICAL)**: MQL status categories are MUTUALLY EXCLUSIVE and must sum to 100%. The categories are: Converted (success), Reverted (lost), Stalled (at risk), and In Progress (healthy pipeline). If X% converted and Y% are reverted/stalled, then the remaining % are "in progress" (still being worked). Do NOT say "0% loss" if leads are still in progress - those aren't lost, they're active. Do NOT make contradictory statements like "60% conversion and 0% stalled" if other leads exist - explain where the remaining % are (in progress).
26. **LEAD STATUS DEFINITIONS**: "Converted" = moved to SQL stage (success). "Reverted" = disqualified/removed from funnel (loss). "Stalled" = stuck >30 days without progress (at risk). "In Progress" = actively being worked, not yet converted (healthy). When discussing funnel health, distinguish between true losses (reverted) and leads still in the pipeline (in progress or stalled).

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

    const body: InboundAnalysisRequest = await request.json();
    const { reportData, filterContext } = body;

    if (!reportData) {
      return NextResponse.json(
        { error: 'Report data is required' },
        { status: 400 }
      );
    }

    const prompt = buildInboundAnalysisPrompt(reportData, filterContext);

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

    const systemMessage = `You are a senior Inbound Marketing analyst at a B2B SaaS company producing EXTREMELY DETAILED quarterly inbound analysis. You write LONG, COMPREHENSIVE reports with EXACTLY 10 sections: Executive Summary, Lead Volume & Pacing, Funnel Conversion, Paid Funnel Conversion Analysis, Funnel Velocity & Stall, Channel & Campaign Effectiveness, Google Ads Performance, Inbound Revenue Attribution, Predictive Indicators, and Prioritized Recommendations. EVERY section must have 5+ data-backed observations. Include regional breakdowns (AMER/EMEA/APAC) in every section. ${productInstruction} Cite specific numbers, percentages, conversion rates, and dollar amounts throughout. Be direct about underperformance with root cause analysis. Frame suggestions as recommendations with priority (P1/P2/P3). TARGET 9000-12000 CHARACTERS. NEVER stop before completing all 10 sections.

**CRITICAL DATA ACCURACY RULE**: You MUST use ONLY the EXACT numbers provided in the data sections. NEVER calculate, derive, estimate, round, or modify any number yourself. For totals and aggregates, find them in the data and copy them EXACTLY. Fabricating or miscalculating numbers will cause the ENTIRE output to be rejected.

OUTPUT FORMAT (STRICT - READ CAREFULLY):
- Use ### for section headers (e.g., ### Executive Summary)
- Do NOT use #### sub-headers - instead, include region names in bullet labels (e.g., "- **AMER MQL Gap:** ..." not "#### AMER" followed by bullets)

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
- ALL METRICS MUST INCLUDE "QTD" - e.g., "QTD pacing: 85%", "$12K QTD spend", "QTD gap: -41 MQLs"

Do NOT use numbered lists (no "1.", "2." prefix). Do NOT output "---" horizontal rules. Do NOT write flat bullet lists in sections 2-9. All metrics must come from the data context provided. Unlabeled metrics without "QTD" are rejected.`;

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
        break;
      }
      console.log(`Inbound analysis too short (${rawAnalysis.length} chars), retrying (attempt ${attempt + 2})...`);
    }

    if (!rawAnalysis) {
      rawAnalysis = 'No analysis generated';
    }

    // Post-process to fix AI output issues

    // Fix 1: RAG status format - replace HIGH">RED, MEDIUM">YELLOW, etc. with just the color
    // Handle various quote characters (straight, curly, unicode)
    rawAnalysis = rawAnalysis
      .replace(/HIGH.?>.?RED/gi, 'RED')
      .replace(/MEDIUM.?>.?YELLOW/gi, 'YELLOW')
      .replace(/LOW.?>.?GREEN/gi, 'GREEN')
      .replace(/HIGH["'"">]+RED/gi, 'RED')
      .replace(/MEDIUM["'"">]+YELLOW/gi, 'YELLOW')
      .replace(/LOW["'"">]+GREEN/gi, 'GREEN');

    // Fix 2: Remove "no data available" mentions for filtered regions
    rawAnalysis = rawAnalysis
      .replace(/🇬🇧\s*EMEA[^.]*no\s*(QTD\s*)?(data|inbound)[^.]*\./gi, '')
      .replace(/🇦🇺\s*APAC[^.]*no\s*(QTD\s*)?(data|inbound)[^.]*\./gi, '')
      .replace(/EMEA\/APAC[^.]*no\s*(QTD\s*)?(data|inbound)[^.]*\./gi, '')
      .replace(/No\s*(QTD\s*)?(data|inbound)\s*(available\s*)?(for|in)\s*🇬🇧[^.]*\./gi, '')
      .replace(/No\s*(QTD\s*)?(data|inbound)\s*(available\s*)?(for|in)\s*🇦🇺[^.]*\./gi, '')
      .replace(/:\s*No data available\.?/gi, ': Excluded by filter.')
      .replace(/No data available/gi, 'Excluded by current filter');

    // Fix 3: Recommendation bold formatting - handle ** on its own line
    // First, collapse ** that's alone on a line with the content
    rawAnalysis = rawAnalysis.replace(/\*\*\s*\n(P[123])/g, '**$1');
    rawAnalysis = rawAnalysis.replace(/(Timeframe:[^*\n]+\.?)\s*\n\*\*/g, '$1**');

    // Find the recommendations section and reformat it
    const recSectionMatch = rawAnalysis.match(/((?:10\.|PRIORITIZED RECOMMENDATIONS)[^\n]*\n)([\s\S]*?)(?=\n###|\n##|$)/i);
    if (recSectionMatch) {
      const header = recSectionMatch[1];
      let content = recSectionMatch[2];

      // Check if this contains recommendations
      if ((content.includes('P1') || content.includes('P2') || content.includes('P3')) &&
          (content.includes('Owner:') || content.includes('Timeframe:'))) {

        // Remove all asterisks first
        content = content.replace(/\*/g, '');

        // Split by P1/P2/P3 markers
        const recs = content.split(/(?=P[123]\s*[–-])/).filter((r: string) => r.trim());

        // Format each recommendation
        const formattedRecs = recs.map((rec: string) => {
          let cleaned = rec
            .replace(/^[\s\-–]+/, '')  // Remove leading whitespace/dashes
            .replace(/[\s\-–]+$/, '')  // Remove trailing whitespace/dashes
            .trim();
          if (!cleaned) return '';
          if (!cleaned.endsWith('.')) cleaned += '.';
          return `**${cleaned}**`;
        }).filter((r: string) => r).join('\n');

        // Replace the section
        rawAnalysis = rawAnalysis.replace(recSectionMatch[0], header + formattedRecs);
      }
    }

    // Fix 4: Handle any remaining individual recommendation lines
    const lines = rawAnalysis.split('\n');
    const fixedLines = lines.map(line => {
      // Skip lines that are just **
      if (line.trim() === '**' || line.trim() === '') return null;

      const hasP123 = line.includes('P1') || line.includes('P2') || line.includes('P3');
      const hasMarkers = line.includes('Owner:') || line.includes('Timeframe:') ||
                         line.toLowerCase().includes('expected impact');

      // Skip if already properly formatted
      if (line.match(/^\*\*P[123]/) && line.endsWith('**')) {
        return line;
      }

      if (hasP123 && hasMarkers) {
        let content = line.replace(/\*/g, '').trim();
        content = content.replace(/^[\s\-–]+/, '').replace(/[\s\-–]+$/, '');
        content = content.replace(/\.+$/, '') + '.';
        return `**${content}**`;
      }
      return line;
    }).filter((line): line is string => line !== null);
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
