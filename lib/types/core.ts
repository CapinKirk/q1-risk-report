// Core domain types - fundamental building blocks
export type Region = 'AMER' | 'EMEA' | 'APAC';
export type Product = 'POR' | 'R360';
export type Category = 'NEW LOGO' | 'STRATEGIC' | 'EXPANSION' | 'MIGRATION' | 'RENEWAL';
export type Source = 'INBOUND' | 'OUTBOUND' | 'AE SOURCED' | 'AM SOURCED' | 'TRADESHOW' | 'PARTNERSHIPS';
export type RAGStatus = 'GREEN' | 'YELLOW' | 'RED';
export type LeadType = 'MQL' | 'EQL';

// Filter state
export interface FilterState {
  regions: Region[];
  products: Product[];
  categories: Category[];
  sources: Source[];
}

// Period information
export interface Period {
  as_of_date: string;
  quarter_pct_complete: number;
  days_elapsed: number;
  total_days: number;
}
