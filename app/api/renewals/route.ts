import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getBigQueryClient } from '@/lib/bigquery-client';
import {
  RenewalsData,
  RenewalOpportunity,
  RenewalSummary,
  SalesforceContract,
  Product,
  Region,
} from '@/lib/types';

const execAsync = promisify(exec);

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
    sfAvailable: false,
    bqDataOnly: false,
  };
}

// SF CLI query for Contract data
const SF_CONTRACT_SOQL = `
SELECT
  Id,
  ContractNumber,
  AccountId,
  Account.Name,
  StartDate,
  EndDate,
  ContractTerm,
  Status,
  SBQQ__AutoRenewal__c,
  SBQQ__RenewalOpportunity__c,
  por_record__c,
  Division
FROM Contract
WHERE Status = 'Activated'
  AND EndDate >= TODAY
  AND Division IN ('US', 'UK', 'AU')
ORDER BY EndDate ASC
LIMIT 500
`;

interface RequestFilters {
  products?: string[];
  regions?: string[];
}

// Map Division to Region
function divisionToRegion(division: string): Region {
  const map: Record<string, Region> = { US: 'AMER', UK: 'EMEA', AU: 'APAC' };
  return map[division] || 'AMER';
}

// Execute Salesforce CLI query
async function querySalesforceContracts(): Promise<SalesforceContract[]> {
  try {
    const soql = SF_CONTRACT_SOQL.replace(/\n/g, ' ').trim();
    const command = `sf data query --query "${soql}" --target-org por-prod --json`;

    console.log('Executing SF CLI query for contracts...');
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

    if (stderr) {
      console.warn('SF CLI stderr:', stderr);
    }

    const result = JSON.parse(stdout);

    if (result.status !== 0 || !result.result?.records) {
      console.error('SF CLI query failed:', result);
      return [];
    }

    const today = new Date();

    return result.result.records.map((record: any) => {
      const endDate = new Date(record.EndDate);
      const daysUntilRenewal = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const product: Product = record.por_record__c ? 'POR' : 'R360';
      const region = divisionToRegion(record.Division);

      return {
        Id: record.Id,
        ContractNumber: record.ContractNumber,
        AccountId: record.AccountId,
        AccountName: record.Account?.Name || 'Unknown',
        StartDate: record.StartDate,
        EndDate: record.EndDate,
        ContractTerm: record.ContractTerm || 12,
        Status: record.Status,
        AutoRenewal: record.SBQQ__AutoRenewal__c || false,
        CurrentACV: 0, // Would need additional query to get ACV
        EndingACV: 0,
        UpliftAmount: 0,
        UpliftPct: 0,
        Product: product,
        Region: region,
        DaysUntilRenewal: daysUntilRenewal,
        IsAtRisk: daysUntilRenewal <= 30 && !record.SBQQ__AutoRenewal__c,
        RenewalOpportunityId: record.SBQQ__RenewalOpportunity__c,
      };
    });
  } catch (error: any) {
    console.error('SF CLI query error:', error.message);
    // Return empty array - we'll fall back to BQ-only data
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

    const query = `
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
        ROUND(ACV, 2) AS acv,
        CAST(CloseDate AS STRING) AS close_date,
        StageName AS stage,
        Won AS is_won,
        IsClosed AS is_closed,
        ClosedLostReason AS loss_reason,
        Owner AS owner_name,
        CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url,
        SBQQ__RenewedContract__c AS contract_id,
        ROUND(ACV - COALESCE(PriorYearACV, 0), 2) AS uplift_amount,
        ROUND(COALESCE(PriorYearACV, 0), 2) AS prior_acv
      FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
      WHERE Type = 'Renewal'
        AND CloseDate >= '2026-01-01'
        AND CloseDate <= CURRENT_DATE()
        AND Division IN ('US', 'UK', 'AU')
        ${productClause}
        ${regionClause}
      ORDER BY CloseDate DESC
    `;

    const [rows] = await bigquery.query({ query });

  const won: RenewalOpportunity[] = [];
  const lost: RenewalOpportunity[] = [];
  const pipeline: RenewalOpportunity[] = [];

  for (const row of rows as any[]) {
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
    } else if (row.is_closed && !row.is_won) {
      lost.push(opp);
    } else {
      pipeline.push(opp);
    }
  }

  return { won, lost, pipeline };
  } catch (error: any) {
    console.error('BigQuery renewal query error:', error.message);
    // Return empty arrays on error
    return { won: [], lost: [], pipeline: [] };
  }
}

// Calculate renewal summary from opportunities and contracts
function calculateRenewalSummary(
  wonOpps: RenewalOpportunity[],
  lostOpps: RenewalOpportunity[],
  pipelineOpps: RenewalOpportunity[],
  contracts: SalesforceContract[]
): RenewalSummary {
  const wonRenewalACV = wonOpps.reduce((sum, o) => sum + (o.acv || 0), 0);
  const lostRenewalACV = lostOpps.reduce((sum, o) => sum + (o.acv || 0), 0);
  const pipelineRenewalACV = pipelineOpps.reduce((sum, o) => sum + (o.acv || 0), 0);

  const autoRenewalContracts = contracts.filter(c => c.AutoRenewal);
  const manualRenewalContracts = contracts.filter(c => !c.AutoRenewal);
  const atRiskContracts = contracts.filter(c => c.IsAtRisk);

  const upcoming30 = contracts.filter(c => c.DaysUntilRenewal <= 30);
  const upcoming60 = contracts.filter(c => c.DaysUntilRenewal <= 60);
  const upcoming90 = contracts.filter(c => c.DaysUntilRenewal <= 90);

  // Calculate average uplift from won renewals
  const totalUplift = wonOpps.reduce((sum, o) => sum + (o.uplift_amount || 0), 0);
  const totalPriorACV = wonOpps.reduce((sum, o) => sum + (o.prior_acv || 0), 0);
  const avgUpliftPct = totalPriorACV > 0 ? Math.round((totalUplift / totalPriorACV) * 100) : 0;

  return {
    renewalCount: wonOpps.length + pipelineOpps.length,
    renewalACV: wonRenewalACV + pipelineRenewalACV,
    autoRenewalCount: autoRenewalContracts.length,
    autoRenewalACV: autoRenewalContracts.reduce((sum, c) => sum + (c.CurrentACV || 0), 0),
    manualRenewalCount: manualRenewalContracts.length,
    manualRenewalACV: manualRenewalContracts.reduce((sum, c) => sum + (c.CurrentACV || 0), 0),
    avgUpliftPct,
    totalUpliftAmount: totalUplift,
    atRiskCount: atRiskContracts.length,
    atRiskACV: atRiskContracts.reduce((sum, c) => sum + (c.CurrentACV || 0), 0),
    upcomingRenewals30: upcoming30.length,
    upcomingRenewals30ACV: upcoming30.reduce((sum, c) => sum + (c.CurrentACV || 0), 0),
    upcomingRenewals60: upcoming60.length,
    upcomingRenewals60ACV: upcoming60.reduce((sum, c) => sum + (c.CurrentACV || 0), 0),
    upcomingRenewals90: upcoming90.length,
    upcomingRenewals90ACV: upcoming90.reduce((sum, c) => sum + (c.CurrentACV || 0), 0),
    wonRenewalCount: wonOpps.length,
    wonRenewalACV,
    lostRenewalCount: lostOpps.length,
    lostRenewalACV,
    pipelineRenewalCount: pipelineOpps.length,
    pipelineRenewalACV,
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

    // Fetch data in parallel
    const [sfContracts, bqRenewals] = await Promise.all([
      querySalesforceContracts(),
      getRenewalOpportunities(filters),
    ]);

    const sfAvailable = sfContracts.length > 0;
    console.log(`SF Contracts: ${sfContracts.length}, BQ Renewals: won=${bqRenewals.won.length}, lost=${bqRenewals.lost.length}, pipeline=${bqRenewals.pipeline.length}`);

    // Split by product
    const wonByProduct = splitByProduct(bqRenewals.won);
    const lostByProduct = splitByProduct(bqRenewals.lost);
    const pipelineByProduct = splitByProduct(bqRenewals.pipeline);
    const contractsByProduct = splitByProduct(sfContracts);

    // Apply filters to contracts
    let filteredContracts = sfContracts;
    if (filters.products && filters.products.length === 1) {
      filteredContracts = filteredContracts.filter(c => c.Product === filters.products![0]);
    }
    if (filters.regions && filters.regions.length > 0 && filters.regions.length < 3) {
      filteredContracts = filteredContracts.filter(c => filters.regions!.includes(c.Region));
    }

    const filteredContractsByProduct = splitByProduct(filteredContracts);

    // Calculate summaries
    const porSummary = calculateRenewalSummary(
      wonByProduct.POR,
      lostByProduct.POR,
      pipelineByProduct.POR,
      filteredContractsByProduct.POR
    );

    const r360Summary = calculateRenewalSummary(
      wonByProduct.R360,
      lostByProduct.R360,
      pipelineByProduct.R360,
      filteredContractsByProduct.R360
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
        contractCount: sfContracts.length,
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
