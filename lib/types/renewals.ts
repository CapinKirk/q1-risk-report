// Renewals types (Salesforce Contract + BQ Renewal Opportunities)
import { Product, Region, RAGStatus } from './core';

// Salesforce Contract (from real-time SF CLI query)
export interface SalesforceContract {
  Id: string;
  ContractNumber: string;
  AccountId: string;
  AccountName: string;
  StartDate: string;
  EndDate: string;
  ContractTerm: number;
  Status: string;
  AutoRenewal: boolean;
  CurrentACV: number;
  EndingACV: number;
  UpliftAmount: number;
  UpliftPct: number;
  Product: Product;
  Region: Region;
  DaysUntilRenewal: number;
  IsAtRisk: boolean;
  RenewalOpportunityId?: string;
  RenewalOpportunityName?: string;
  SalesforceUrl?: string;
}

// Renewal Opportunity (from BigQuery Type='Renewal')
export interface RenewalOpportunity {
  opportunity_id: string;
  account_id: string;
  account_name: string;
  opportunity_name: string;
  product: Product;
  region: Region;
  acv: number;
  close_date: string;
  stage: string;
  is_won: boolean;
  is_closed: boolean;
  loss_reason: string | null;
  owner_name: string;
  salesforce_url: string;
  contract_id?: string;
  uplift_amount?: number;
  uplift_pct?: number;
  prior_acv?: number;
}

// Renewal summary metrics
export interface RenewalSummary {
  renewalCount: number;
  renewalACV: number;
  autoRenewalCount: number;
  autoRenewalACV: number;
  manualRenewalCount: number;
  manualRenewalACV: number;
  avgUpliftPct: number;
  totalUpliftAmount: number;
  atRiskCount: number;
  atRiskACV: number;
  upcomingRenewals30: number;
  upcomingRenewals30ACV: number;
  upcomingRenewals60: number;
  upcomingRenewals60ACV: number;
  upcomingRenewals90: number;
  upcomingRenewals90ACV: number;
  upcomingQ1Remaining: number;
  upcomingQ1RemainingACV: number;
  wonRenewalCount: number;
  wonRenewalACV: number;
  lostRenewalCount: number;
  lostRenewalACV: number;
  pipelineRenewalCount: number;
  pipelineRenewalACV: number;
  expectedRenewalACV: number;
  expectedRenewalACVWithUplift: number;
  renewalRiskGap: number;
  renewalRiskPct: number;
  q1Target: number;
  qtdTarget: number;
  qtdAttainmentPct: number;
  forecastedBookings: number;
  ragStatus: RAGStatus;
  missingUpliftCount: number;
  missingUpliftACV: number;
  potentialLostUplift: number;
}

// Full renewals data structure
export interface RenewalsData {
  summary: { POR: RenewalSummary; R360: RenewalSummary };
  wonRenewals: { POR: RenewalOpportunity[]; R360: RenewalOpportunity[] };
  lostRenewals: { POR: RenewalOpportunity[]; R360: RenewalOpportunity[] };
  pipelineRenewals: { POR: RenewalOpportunity[]; R360: RenewalOpportunity[] };
  upcomingContracts: { POR: SalesforceContract[]; R360: SalesforceContract[] };
  atRiskContracts: { POR: SalesforceContract[]; R360: SalesforceContract[] };
  missingUpliftContracts: { POR: SalesforceContract[]; R360: SalesforceContract[] };
  sfAvailable: boolean;
  bqDataOnly: boolean;
}
