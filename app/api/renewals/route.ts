import { NextResponse } from 'next/server';
import { getBigQueryClient } from '@/lib/bigquery-client';
import {
  RenewalsData,
  RenewalOpportunity,
  RenewalSummary,
  SalesforceContract,
  Product,
  Region,
} from '@/lib/types';

// Empty summary for fallback
function getEmptySummary(): RenewalSummary {
  return {
    renewalCount: 0,
    renewalACV: 0,
    autoRenewalCount: 0,
    autoRenewalACV: 0,
    manualRenewalCount: 0,
    manualRenewalACV: 0,
    avgUpliftPct: 0,
    totalUpliftAmount: 0,
    atRiskCount: 0,
    atRiskACV: 0,
    upcomingRenewals30: 0,
    upcomingRenewals30ACV: 0,
    upcomingRenewals60: 0,
    upcomingRenewals60ACV: 0,
    upcomingRenewals90: 0,
    upcomingRenewals90ACV: 0,
    wonRenewalCount: 0,
    wonRenewalACV: 0,
    lostRenewalCount: 0,
    lostRenewalACV: 0,
    pipelineRenewalCount: 0,
    pipelineRenewalACV: 0,
    expectedRenewalACV: 0,
    expectedRenewalACVWithUplift: 0,
    renewalRiskGap: 0,
    renewalRiskPct: 0,
    // New target/RAG fields
    q1Target: 0,
    qtdTarget: 0,
    qtdAttainmentPct: 0,
    forecastedBookings: 0,
    ragStatus: 'RED',
    // Missing uplift tracking
    missingUpliftCount: 0,
    missingUpliftACV: 0,
    potentialLostUplift: 0,
  };
}

// Empty renewals data for fallback
function getEmptyRenewalsData(): RenewalsData {
  return {
    summary: { POR: getEmptySummary(), R360: getEmptySummary() },
    wonRenewals: { POR: [], R360: [] },
    lostRenewals: { POR: [], R360: [] },
    pipelineRenewals: { POR: [], R360: [] },
    upcomingContracts: { POR: [], R360: [] },
    atRiskContracts: { POR: [], R360: [] },
    missingUpliftContracts: { POR: [], R360: [] },
    sfAvailable: false,
    bqDataOnly: false,
  };
}

// Standard renewal uplift percentage (from CPQ config)
const DEFAULT_RENEWAL_UPLIFT_PCT = 5;

interface RequestFilters {
  products?: string[];
  regions?: string[];
}

// Renewal targets from RevOpsReport (P75)
// Now includes regional breakdown for accurate filtering
interface RegionalTargets {
  q1Target: number;
  qtdActual: number;
  attainmentPct: number;
}

interface RenewalTargets {
  POR: {
    total: { q1Target: number; qtdTarget: number };
    byRegion: Record<Region, RegionalTargets>;
  };
  R360: {
    total: { q1Target: number; qtdTarget: number };
    byRegion: Record<Region, RegionalTargets>;
  };
}

// Calculate RAG status based on attainment percentage
function calculateRAG(attainmentPct: number): 'GREEN' | 'YELLOW' | 'RED' {
  if (attainmentPct >= 90) return 'GREEN';
  if (attainmentPct >= 70) return 'YELLOW';
  return 'RED';
}

// Query renewal targets from RAW_2026_Plan_by_Month (Q1_Actual_2025 = renewal baseline)
// RATIONALE: Renewal targets use prior year actuals as the baseline, not planned targets
// This matches the 2026 Bookings Plan where Q1_Actual_2025 represents the renewal baseline
async function getRenewalTargets(): Promise<RenewalTargets> {
  const emptyRegionalTargets: Record<Region, RegionalTargets> = {
    AMER: { q1Target: 0, qtdActual: 0, attainmentPct: 0 },
    EMEA: { q1Target: 0, qtdActual: 0, attainmentPct: 0 },
    APAC: { q1Target: 0, qtdActual: 0, attainmentPct: 0 },
  };

  try {
    const bigquery = getBigQueryClient();

    // Query RAW_2026_Plan_by_Month for renewal targets
    // Q1_Actual_2025 is the correct baseline for renewal targets (prior year actuals)
    // Division format: "AMER POR", "EMEA POR", "APAC POR", "AMER R360"
    const query = `
      SELECT
        Division,
        Booking_Type,
        ROUND(COALESCE(Q1_Actual_2025, 0), 2) AS q1_target
      FROM \`data-analytics-306119.Staging.RAW_2026_Plan_by_Month\`
      WHERE LOWER(Booking_Type) = 'renewal'
    `;

    const [rows] = await bigquery.query({ query });

    // Initialize targets structure
    const targets: RenewalTargets = {
      POR: {
        total: { q1Target: 0, qtdTarget: 0 },
        byRegion: { ...emptyRegionalTargets },
      },
      R360: {
        total: { q1Target: 0, qtdTarget: 0 },
        byRegion: { ...emptyRegionalTargets },
      },
    };

    // Process rows and aggregate by product/region
    // Division format: "AMER POR", "EMEA POR", "APAC POR", "AMER R360"
    for (const row of rows as any[]) {
      const division = (row.Division || '').toUpperCase();
      const q1Target = row.q1_target || 0;

      // Parse Division to extract region and product
      let region: Region | null = null;
      let product: Product | null = null;

      if (division.includes('AMER')) region = 'AMER';
      else if (division.includes('EMEA')) region = 'EMEA';
      else if (division.includes('APAC')) region = 'APAC';

      if (division.includes('R360')) product = 'R360';
      else if (division.includes('POR')) product = 'POR';

      if (product && region) {
        // Store regional targets
        targets[product].byRegion[region] = {
          q1Target: q1Target,
          qtdActual: 0, // Actuals come from won renewals, calculated separately
          attainmentPct: 0, // Calculated after we have actuals
        };

        // Aggregate to total (Q1 target sum across regions)
        targets[product].total.q1Target += q1Target;
        // QTD target is same as Q1 target for renewals (full quarter target)
        targets[product].total.qtdTarget += q1Target;
      }
    }

    console.log('Renewal targets (Q1_Actual_2025 from RAW_2026_Plan_by_Month):', JSON.stringify(targets, null, 2));
    return targets;
  } catch (error: any) {
    console.error('Failed to fetch renewal targets from RAW_2026_Plan_by_Month:', error.message);
    return {
      POR: {
        total: { q1Target: 0, qtdTarget: 0 },
        byRegion: { ...emptyRegionalTargets },
      },
      R360: {
        total: { q1Target: 0, qtdTarget: 0 },
        byRegion: { ...emptyRegionalTargets },
      },
    };
  }
}

// Map Division to Region
function divisionToRegion(division: string): Region {
  const map: Record<string, Region> = { US: 'AMER', UK: 'EMEA', AU: 'APAC' };
  return map[division] || 'AMER';
}

// Query Contract data from BigQuery (SF data is synced there)
// IMPORTANT: All amounts are converted to USD using CurrencyType conversion rates
// FORMULA: Expected Increase = (ACV / ConversionRate) × (UpliftRate / 100)
async function queryContractsFromBigQuery(): Promise<SalesforceContract[]> {
  try {
    const bigquery = getBigQueryClient();

    // Join with CurrencyType to convert all amounts to USD
    // Join with Account to get AccountName
    // Salesforce formula: local_amount / conversionrate = USD_amount
    // CORRECT UPLIFT FORMULA: ACV_USD × (uplift_rate / 100)
    const query = `
      SELECT
        c.Id,
        c.ContractNumber,
        c.AccountId,
        COALESCE(a.Name, 'Unknown') as AccountName,
        c.StartDate,
        DATE(c.EndDate) as EndDate,
        c.ContractTerm,
        c.Status,
        c.Renewal_Status__c,
        c.neo_automaticrenewal__c,
        c.manual_renewal__c,
        c.sbqq__evergreen__c,
        c.currencyisocode,
        -- Original values (local currency)
        c.acv__c as acv_local,
        c.starting_acv__c as starting_acv_local,
        c.ending_acv__c as ending_acv_local,
        COALESCE(c.sbqq__renewalupliftrate__c, 5) as uplift_rate,
        -- USD converted ACV (divide by conversion rate, default to 1 for USD)
        ROUND(COALESCE(c.acv__c, 0) / COALESCE(ct.conversionrate, 1), 2) as acv_usd,
        ROUND(COALESCE(c.starting_acv__c, 0) / COALESCE(ct.conversionrate, 1), 2) as starting_acv_usd,
        ROUND(COALESCE(c.ending_acv__c, 0) / COALESCE(ct.conversionrate, 1), 2) as ending_acv_usd,
        -- CORRECT: Expected increase = ACV_USD × (uplift_rate / 100)
        ROUND((COALESCE(c.acv__c, 0) / COALESCE(ct.conversionrate, 1)) * (COALESCE(c.sbqq__renewalupliftrate__c, 5) / 100), 2) as expected_increase_usd,
        COALESCE(ct.conversionrate, 1) as conversion_rate,
        c.sbqq__renewalupliftrate__c,
        c.sbqq__renewalopportunity__c,
        c.r360_record__c,
        c.account_division__c,
        -- Salesforce URL for linking
        CONCAT('https://por.my.salesforce.com/', c.Id) as SalesforceUrl
      FROM \`data-analytics-306119.sfdc.Contract\` c
      LEFT JOIN \`data-analytics-306119.sfdc.CurrencyType\` ct
        ON LOWER(c.currencyisocode) = LOWER(ct.isocode)
      LEFT JOIN \`data-analytics-306119.sfdc.Account\` a
        ON c.AccountId = a.Id
      WHERE c.Status = 'Activated'
        AND DATE(c.EndDate) >= CURRENT_DATE()
        -- Q1 2026 ends March 31 - include all contracts through that date
        AND DATE(c.EndDate) <= '2026-03-31'
        AND c.account_division__c IN ('US', 'UK', 'AU')
        -- CRITICAL: Only include contracts that will actually renew
        AND (c.Renewal_Status__c IS NULL
             OR c.Renewal_Status__c NOT IN ('Non Renewing', 'Success'))
        AND c.acv__c > 0
      ORDER BY c.EndDate ASC
      LIMIT 2000
    `;

    console.log('Querying Contract data from BigQuery with USD conversion...');
    const [rows] = await bigquery.query({ query });

    const today = new Date();

    return (rows as any[]).map((record: any) => {
      const endDate = new Date(record.EndDate.value || record.EndDate);
      const daysUntilRenewal = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Product: r360_record__c = true means R360, otherwise POR
      const isR360 = record.r360_record__c === true || record.r360_record__c === 'true';
      const product: Product = isR360 ? 'R360' : 'POR';

      // Region: account_division__c contains US/UK/AU
      const region = divisionToRegion(record.account_division__c);

      // Use USD-converted values (already converted in query)
      const currentACV = parseFloat(record.acv_usd) || parseFloat(record.starting_acv_usd) || 0;
      const endingACV = parseFloat(record.ending_acv_usd) || currentACV;

      // CORRECT FORMULA: Expected increase = ACV_USD × (uplift_rate / 100)
      // This is calculated in SQL as expected_increase_usd
      const upliftAmount = parseFloat(record.expected_increase_usd) || 0;
      const upliftPct = parseFloat(record.sbqq__renewalupliftrate__c) || DEFAULT_RENEWAL_UPLIFT_PCT;

      // Check if auto-renewing (Future Renewal status indicates it will renew)
      const renewalStatus = record.Renewal_Status__c || '';
      const isAutoRenewalFlag = record.neo_automaticrenewal__c === true || record.neo_automaticrenewal__c === 'true';
      const isEvergreen = record.sbqq__evergreen__c === true || record.sbqq__evergreen__c === 'true';
      const isFutureRenewal = renewalStatus === 'Future Renewal';
      const isAutoRenewal = isAutoRenewalFlag || isEvergreen || isFutureRenewal;
      const isManualRenewal = record.manual_renewal__c === true || record.manual_renewal__c === 'true';

      // A contract is at risk if expiring within 30 days and NOT auto-renewing
      const isAtRisk = daysUntilRenewal <= 30 && !isAutoRenewal;

      return {
        Id: record.Id,
        ContractNumber: record.ContractNumber,
        AccountId: record.AccountId,
        AccountName: record.AccountName || 'Unknown',
        StartDate: record.StartDate?.value || record.StartDate,
        EndDate: record.EndDate?.value || record.EndDate,
        ContractTerm: record.ContractTerm || 12,
        Status: record.Status,
        AutoRenewal: isAutoRenewal,
        CurrentACV: Math.round(currentACV * 100) / 100,
        EndingACV: Math.round(endingACV * 100) / 100,
        UpliftAmount: Math.round(upliftAmount * 100) / 100,
        UpliftPct: upliftPct,
        Product: product,
        Region: region,
        DaysUntilRenewal: daysUntilRenewal,
        IsAtRisk: isAtRisk,
        RenewalOpportunityId: record.sbqq__renewalopportunity__c,
        RenewalOpportunityName: '',
        SalesforceUrl: record.SalesforceUrl || `https://por.my.salesforce.com/${record.Id}`,
      };
    });
  } catch (error: any) {
    console.error('BigQuery Contract query error:', error.message);
    return [];
  }
}

// Query BigQuery for renewal opportunities
async function getRenewalOpportunities(filters: RequestFilters): Promise<{
  won: RenewalOpportunity[];
  lost: RenewalOpportunity[];
  pipeline: RenewalOpportunity[];
}> {
  try {
    const bigquery = getBigQueryClient();

    // Build filter clauses
    let productClause = '';
    if (filters.products && filters.products.length === 1) {
      productClause = filters.products[0] === 'POR'
        ? 'AND por_record__c = true'
        : 'AND r360_record__c = true';
    }

    let regionClause = '';
    if (filters.regions && filters.regions.length > 0 && filters.regions.length < 3) {
      const divisionMap: Record<string, string> = { AMER: 'US', EMEA: 'UK', APAC: 'AU' };
      const divisions = filters.regions.map(r => `'${divisionMap[r]}'`).join(', ');
      regionClause = `AND Division IN (${divisions})`;
    }

    // Query for closed renewals (Q1 2026)
    const closedQuery = `
      SELECT
        Id AS opportunity_id,
        AccountId AS account_id,
        AccountName AS account_name,
        OpportunityName AS opportunity_name,
        CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
        CASE Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        ROUND(COALESCE(ACV, 0), 2) AS acv,
        CAST(CloseDate AS STRING) AS close_date,
        StageName AS stage,
        Won AS is_won,
        IsClosed AS is_closed,
        ClosedLostReason AS loss_reason,
        Owner AS owner_name,
        CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url,
        '' AS contract_id,
        0 AS uplift_amount,
        0 AS prior_acv
      FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
      WHERE Type = 'Renewal'
        AND IsClosed = true
        AND CloseDate >= '2026-01-01'
        AND CloseDate <= CURRENT_DATE()
        AND Division IN ('US', 'UK', 'AU')
        AND ACV > 0  -- Exclude negative ACV renewals (credits, downgrades)
        ${productClause}
        ${regionClause}
      ORDER BY CloseDate DESC
      LIMIT 200
    `;

    // Query for pipeline renewals (open, close date in Q1 2026)
    const pipelineQuery = `
      SELECT
        Id AS opportunity_id,
        AccountId AS account_id,
        AccountName AS account_name,
        OpportunityName AS opportunity_name,
        CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
        CASE Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        ROUND(COALESCE(ACV, 0), 2) AS acv,
        CAST(CloseDate AS STRING) AS close_date,
        StageName AS stage,
        Won AS is_won,
        IsClosed AS is_closed,
        ClosedLostReason AS loss_reason,
        Owner AS owner_name,
        CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url,
        '' AS contract_id,
        0 AS uplift_amount,
        0 AS prior_acv
      FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
      WHERE Type = 'Renewal'
        AND IsClosed = false
        AND CloseDate >= '2026-01-01'
        AND CloseDate <= '2026-03-31'
        AND Division IN ('US', 'UK', 'AU')
        AND ACV > 0  -- Exclude negative ACV renewals (credits, downgrades)
        ${productClause}
        ${regionClause}
      ORDER BY CloseDate ASC
      LIMIT 200
    `;

    // Run both queries
    const [closedRows] = await bigquery.query({ query: closedQuery });
    const [pipelineRows] = await bigquery.query({ query: pipelineQuery });

    const won: RenewalOpportunity[] = [];
    const lost: RenewalOpportunity[] = [];
    const pipeline: RenewalOpportunity[] = [];

    // Process closed deals (won and lost)
    for (const row of closedRows as any[]) {
      const opp: RenewalOpportunity = {
        opportunity_id: row.opportunity_id,
        account_id: row.account_id,
        account_name: row.account_name || 'Unknown',
        opportunity_name: row.opportunity_name,
        product: row.product as Product,
        region: row.region as Region,
        acv: row.acv || 0,
        close_date: row.close_date,
        stage: row.stage,
        is_won: row.is_won,
        is_closed: row.is_closed,
        loss_reason: row.loss_reason,
        owner_name: row.owner_name || 'Unknown',
        salesforce_url: row.salesforce_url,
        contract_id: row.contract_id,
        uplift_amount: row.uplift_amount || 0,
        prior_acv: row.prior_acv || 0,
      };

      if (row.is_won) {
        won.push(opp);
      } else {
        lost.push(opp);
      }
    }

    // Process pipeline deals
    for (const row of pipelineRows as any[]) {
      const opp: RenewalOpportunity = {
        opportunity_id: row.opportunity_id,
        account_id: row.account_id,
        account_name: row.account_name || 'Unknown',
        opportunity_name: row.opportunity_name,
        product: row.product as Product,
        region: row.region as Region,
        acv: row.acv || 0,
        close_date: row.close_date,
        stage: row.stage,
        is_won: row.is_won,
        is_closed: row.is_closed,
        loss_reason: row.loss_reason,
        owner_name: row.owner_name || 'Unknown',
        salesforce_url: row.salesforce_url,
        contract_id: row.contract_id,
        uplift_amount: row.uplift_amount || 0,
        prior_acv: row.prior_acv || 0,
      };
      pipeline.push(opp);
    }

    return { won, lost, pipeline };
  } catch (error: any) {
    console.error('BigQuery renewal query error:', error.message);
    // Return empty arrays on error
    return { won: [], lost: [], pipeline: [] };
  }
}

// Calculate renewal summary from opportunities and contracts
// IMPORTANT: For bookings forecast, only UPLIFT counts as new bookings, not full ACV!
// targets now includes regional breakdown for accurate filtering
function calculateRenewalSummary(
  wonOpps: RenewalOpportunity[],
  lostOpps: RenewalOpportunity[],
  pipelineOpps: RenewalOpportunity[],
  contracts: SalesforceContract[],
  targets: {
    total: { q1Target: number; qtdTarget: number };
    byRegion: Record<Region, RegionalTargets>;
  },
  regionFilter?: Region[]
): RenewalSummary {
  // Calculate effective targets based on region filter
  // If filtering by specific regions, sum only those regional targets
  // CRITICAL: qtdTarget = q1Target for renewal bookings forecast (no prorating)
  let effectiveQ1Target = targets.total.q1Target;

  if (regionFilter && regionFilter.length > 0 && regionFilter.length < 3) {
    effectiveQ1Target = regionFilter.reduce(
      (sum, region) => sum + (targets.byRegion[region]?.q1Target || 0),
      0
    );
  }

  // QTD target equals Q1 target for renewal forecast (we track against full quarter)
  const effectiveQtdTarget = effectiveQ1Target;
  const wonRenewalACV = wonOpps.reduce((sum, o) => sum + (o.acv || 0), 0);
  const lostRenewalACV = lostOpps.reduce((sum, o) => sum + (o.acv || 0), 0);
  const pipelineRenewalACV = pipelineOpps.reduce((sum, o) => sum + (o.acv || 0), 0);

  const autoRenewalContracts = contracts.filter(c => c.AutoRenewal);
  const manualRenewalContracts = contracts.filter(c => !c.AutoRenewal);
  const atRiskContracts = contracts.filter(c => c.IsAtRisk);

  const upcoming30 = contracts.filter(c => c.DaysUntilRenewal <= 30);
  const upcoming60 = contracts.filter(c => c.DaysUntilRenewal <= 60);
  const upcoming90 = contracts.filter(c => c.DaysUntilRenewal <= 90);

  // CRITICAL FIX: Filter contracts that renew within Q1 (by March 31, 2026)
  // This ensures we only count uplift that will book in Q1
  const q1EndDate = new Date('2026-03-31');
  const today = new Date();
  const daysUntilQ1End = Math.ceil((q1EndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Contracts renewing within Q1 (EndDate <= March 31, 2026)
  const q1Contracts = autoRenewalContracts.filter(c => c.DaysUntilRenewal <= daysUntilQ1End);
  const q1ExpectedUplift = q1Contracts.reduce((sum, c) => sum + (c.UpliftAmount || 0), 0);

  // All 90-day uplift (for display purposes)
  const autoRenewalUplift = autoRenewalContracts.reduce((sum, c) => sum + (c.UpliftAmount || 0), 0);
  const totalContractUplift = contracts.reduce((sum, c) => sum + (c.UpliftAmount || 0), 0);

  // Use default uplift percentage
  const avgUpliftPct = DEFAULT_RENEWAL_UPLIFT_PCT;

  // Calculate upcoming ACV values (for display)
  const autoRenewalACV = autoRenewalContracts.reduce((sum, c) => sum + (c.CurrentACV || 0), 0);
  const manualRenewalACV = manualRenewalContracts.reduce((sum, c) => sum + (c.CurrentACV || 0), 0);
  const atRiskACV = atRiskContracts.reduce((sum, c) => sum + (c.CurrentACV || 0), 0);
  const upcoming30ACV = upcoming30.reduce((sum, c) => sum + (c.CurrentACV || 0), 0);
  const upcoming60ACV = upcoming60.reduce((sum, c) => sum + (c.CurrentACV || 0), 0);
  const upcoming90ACV = upcoming90.reduce((sum, c) => sum + (c.CurrentACV || 0), 0);

  // CRITICAL: For bookings forecast, only UPLIFT from auto-renewing contracts counts!
  // expectedRenewalACV = base ACV (not new bookings)
  // expectedRenewalACVWithUplift = base + uplift (uplift is the new bookings)
  const expectedRenewalACV = autoRenewalContracts.reduce((sum, c) => sum + (c.CurrentACV || 0), 0);
  const expectedRenewalACVWithUplift = autoRenewalContracts.reduce((sum, c) => sum + (c.EndingACV || c.CurrentACV || 0), 0);

  // BOOKINGS FORECAST = Sum of UpliftAmount from Q1-renewing auto-renewal contracts only
  // This is the actual new revenue expected to book in Q1
  const expectedUpliftBookings = q1ExpectedUplift;

  // FORECASTED BOOKINGS = Won renewal ACV + expected Q1 uplift from upcoming contracts
  // This is what we compare against Q1 target for RAG status
  const forecastedBookings = wonRenewalACV + expectedUpliftBookings;

  // Risk gap: Expected uplift bookings vs any lost renewal value
  // Positive = ahead of plan, Negative = behind
  const renewalRiskGap = expectedUpliftBookings - (lostRenewalACV * 0.05); // Lost ACV * 5% = lost uplift

  // Risk percentage: What % of potential uplift is from auto-renewing contracts?
  const totalPotentialUplift = totalContractUplift;
  const renewalRiskPct = totalPotentialUplift > 0
    ? Math.round((autoRenewalUplift / totalPotentialUplift) * 100)
    : 0;

  // CALCULATE RAG STATUS based on Q1 forecast vs FULL Q1 target
  // Q1 Attainment = (Won + Q1 Expected Uplift) / Q1 Target
  // Uses effectiveQ1Target which accounts for region filtering
  // CRITICAL: Use full Q1 target, not prorated QTD target
  const qtdAttainmentPct = effectiveQ1Target > 0
    ? Math.round((forecastedBookings / effectiveQ1Target) * 1000) / 10
    : 100; // No target = 100%

  const ragStatus = calculateRAG(qtdAttainmentPct);

  console.log(`Renewal Forecast (P75): Won=${wonRenewalACV}, Q1 Uplift=${q1ExpectedUplift}, Total Forecast=${forecastedBookings}, Q1 Target=${effectiveQ1Target}, Attainment=${qtdAttainmentPct}%, RAG=${ragStatus}`);

  // Track contracts with ACV but missing uplift - these are revenue leakage!
  const missingUpliftContracts = contracts.filter(c => c.CurrentACV > 0 && c.UpliftAmount === 0);
  const missingUpliftCount = missingUpliftContracts.length;
  const missingUpliftACV = missingUpliftContracts.reduce((sum, c) => sum + c.CurrentACV, 0);
  const potentialLostUplift = Math.round(missingUpliftACV * (DEFAULT_RENEWAL_UPLIFT_PCT / 100) * 100) / 100;

  return {
    renewalCount: wonOpps.length + pipelineOpps.length,
    renewalACV: wonRenewalACV + pipelineRenewalACV,
    autoRenewalCount: autoRenewalContracts.length,
    autoRenewalACV,
    manualRenewalCount: manualRenewalContracts.length,
    manualRenewalACV,
    avgUpliftPct,
    totalUpliftAmount: expectedUpliftBookings, // This is the bookings forecast!
    atRiskCount: atRiskContracts.length,
    atRiskACV,
    upcomingRenewals30: upcoming30.length,
    upcomingRenewals30ACV: upcoming30ACV,
    upcomingRenewals60: upcoming60.length,
    upcomingRenewals60ACV: upcoming60ACV,
    upcomingRenewals90: upcoming90.length,
    upcomingRenewals90ACV: upcoming90ACV,
    wonRenewalCount: wonOpps.length,
    wonRenewalACV,
    lostRenewalCount: lostOpps.length,
    lostRenewalACV,
    pipelineRenewalCount: pipelineOpps.length,
    pipelineRenewalACV,
    expectedRenewalACV,
    expectedRenewalACVWithUplift,
    renewalRiskGap,
    renewalRiskPct,
    // New target/RAG fields (P75 from RevOpsReport)
    q1Target: effectiveQ1Target,
    qtdTarget: effectiveQtdTarget,
    qtdAttainmentPct,
    forecastedBookings,
    ragStatus,
    // Missing uplift tracking
    missingUpliftCount,
    missingUpliftACV,
    potentialLostUplift,
  };
}

// Split data by product
function splitByProduct<T extends { product?: Product; Product?: Product }>(
  items: T[]
): { POR: T[]; R360: T[] } {
  return {
    POR: items.filter(i => (i.product || i.Product) === 'POR'),
    R360: items.filter(i => (i.product || i.Product) === 'R360'),
  };
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const filters: RequestFilters = {
      products: searchParams.get('products')?.split(',').filter(Boolean) || [],
      regions: searchParams.get('regions')?.split(',').filter(Boolean) || [],
    };

    console.log('Renewals API called with filters:', filters);

    // Fetch data in parallel - Contract data from BigQuery (synced from SF), plus targets
    const [contracts, bqRenewals, renewalTargets] = await Promise.all([
      queryContractsFromBigQuery(),
      getRenewalOpportunities(filters),
      getRenewalTargets(),
    ]);

    const sfAvailable = contracts.length > 0;
    console.log(`Contracts from BQ: ${contracts.length}, BQ Renewals: won=${bqRenewals.won.length}, lost=${bqRenewals.lost.length}, pipeline=${bqRenewals.pipeline.length}`);
    console.log('Renewal targets:', renewalTargets);

    // Split by product
    const wonByProduct = splitByProduct(bqRenewals.won);
    const lostByProduct = splitByProduct(bqRenewals.lost);
    const pipelineByProduct = splitByProduct(bqRenewals.pipeline);
    const contractsByProduct = splitByProduct(contracts);

    // Apply filters to contracts
    let filteredContracts = contracts;
    if (filters.products && filters.products.length === 1) {
      filteredContracts = filteredContracts.filter(c => c.Product === filters.products![0]);
    }
    if (filters.regions && filters.regions.length > 0 && filters.regions.length < 3) {
      filteredContracts = filteredContracts.filter(c => filters.regions!.includes(c.Region));
    }

    const filteredContractsByProduct = splitByProduct(filteredContracts);

    // Parse region filter for target calculation
    const regionFilter = (filters.regions && filters.regions.length > 0 && filters.regions.length < 3)
      ? filters.regions as Region[]
      : undefined;

    // Calculate summaries with P75 targets for RAG status
    const porSummary = calculateRenewalSummary(
      wonByProduct.POR,
      lostByProduct.POR,
      pipelineByProduct.POR,
      filteredContractsByProduct.POR,
      renewalTargets.POR,
      regionFilter
    );

    const r360Summary = calculateRenewalSummary(
      wonByProduct.R360,
      lostByProduct.R360,
      pipelineByProduct.R360,
      filteredContractsByProduct.R360,
      renewalTargets.R360,
      regionFilter
    );

    // Build response
    const renewalsData: RenewalsData = {
      summary: { POR: porSummary, R360: r360Summary },
      wonRenewals: wonByProduct,
      lostRenewals: lostByProduct,
      pipelineRenewals: pipelineByProduct,
      upcomingContracts: {
        POR: filteredContractsByProduct.POR.filter(c => c.DaysUntilRenewal <= 90),
        R360: filteredContractsByProduct.R360.filter(c => c.DaysUntilRenewal <= 90),
      },
      atRiskContracts: {
        POR: filteredContractsByProduct.POR.filter(c => c.IsAtRisk),
        R360: filteredContractsByProduct.R360.filter(c => c.IsAtRisk),
      },
      missingUpliftContracts: {
        POR: filteredContractsByProduct.POR.filter(c => c.CurrentACV > 0 && c.UpliftAmount === 0),
        R360: filteredContractsByProduct.R360.filter(c => c.CurrentACV > 0 && c.UpliftAmount === 0),
      },
      sfAvailable,
      bqDataOnly: !sfAvailable,
    };

    const duration = Date.now() - startTime;
    console.log(`Renewals API completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      data: renewalsData,
      metadata: {
        sfAvailable,
        contractCount: contracts.length,
        wonRenewalsCount: bqRenewals.won.length,
        lostRenewalsCount: bqRenewals.lost.length,
        pipelineRenewalsCount: bqRenewals.pipeline.length,
        durationMs: duration,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    console.error('Renewals API error:', error);
    // Return empty data instead of error so UI can still render
    const emptyData = getEmptyRenewalsData();
    return NextResponse.json({
      success: true,
      data: emptyData,
      metadata: {
        sfAvailable: false,
        contractCount: 0,
        wonRenewalsCount: 0,
        lostRenewalsCount: 0,
        pipelineRenewalsCount: 0,
        durationMs: Date.now() - startTime,
        generatedAt: new Date().toISOString(),
        error: error.message,
        note: 'Data unavailable - showing empty state',
      },
    });
  }
}

// API info endpoint
export async function OPTIONS() {
  return NextResponse.json({
    endpoint: '/api/renewals',
    method: 'GET',
    description: 'Fetch renewal data from Salesforce Contracts + BigQuery Opportunities',
    parameters: {
      products: 'Comma-separated list: POR,R360 (optional)',
      regions: 'Comma-separated list: AMER,EMEA,APAC (optional)',
    },
    response: {
      summary: 'Renewal metrics by product (POR/R360)',
      wonRenewals: 'Won renewal opportunities from BigQuery',
      lostRenewals: 'Lost renewal opportunities from BigQuery',
      pipelineRenewals: 'Open renewal opportunities from BigQuery',
      upcomingContracts: 'Contracts with renewals in next 90 days (from SF)',
      atRiskContracts: 'Manual renewal contracts expiring within 30 days',
      sfAvailable: 'Whether Salesforce real-time data was fetched',
      bqDataOnly: 'True if only BigQuery data available',
    },
  });
}
