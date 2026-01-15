# Shared Resources for Risk Reports

## Overview

This document defines shared data sources, targets, and conventions used across all risk analysis reports in this directory.

---

## Data Sources

### 1. Bookings Actuals

| Source | Table | Purpose |
|--------|-------|---------|
| Salesforce | `data-analytics-306119.sfdc.OpportunityViewTable` | Won/Lost deals, ACV, Close dates |

**Key Fields:**
- `Won = true` for closed-won deals
- `por_record__c = true` for POR deals
- `r360_record__c = true` for R360 deals
- `ACV` for Annual Contract Value
- `CloseDate` for timing
- `Division` (US, UK, AU) for region mapping

### 2. Funnel Actuals

| Source | Table | Purpose |
|--------|-------|---------|
| DailyRevenueFunnel | `data-analytics-306119.Staging.DailyRevenueFunnel` | MQL, SQL, SAL, SQO aggregated |
| POR Inbound | `data-analytics-306119.MarketingFunnel.InboundFunnel` | POR inbound lead details |
| R360 Inbound | `data-analytics-306119.MarketingFunnel.R360InboundFunnel` | R360 inbound lead details |

**Key Fields:**
- `FunnelType` = 'INBOUND' or 'R360 INBOUND'
- `CaptureDate` for MQL timing (NOT MQL_DT)
- `RecordType` = 'POR' or 'R360'

### 3. Targets

| Source | Table | Purpose |
|--------|-------|---------|
| SOP | `data-analytics-306119.Staging.StrategicOperatingPlan` | Daily targets by dimension |

**Key Filters:**
- `Percentile = 'P50'`
- `OpportunityType != 'RENEWAL'`

### 4. Google Ads

| Source | Table | Purpose |
|--------|-------|---------|
| POR Ads | `data-analytics-306119.GoogleAds_POR_8275359090.ads_CampaignBasicStats_8275359090` | POR search ad metrics |
| R360 Ads | `data-analytics-306119.GoogleAds_Record360_3799591491.ads_CampaignBasicStats_3799591491` | R360 search ad metrics |

**Key Fields:**
- `segments_ad_network_type = 'SEARCH'` for search only
- `metrics_cost_micros / 1000000` for USD spend

---

## Q1 2026 Targets (Authoritative)

### POR Q1 2026 Targets

| Region | Category | Q1 Target |
|--------|----------|-----------|
| AMER | New Logo | $524,260 |
| AMER | Expansion | $832,000 |
| AMER | Migration | $264,000 |
| EMEA | New Logo | $261,800 |
| EMEA | Expansion | $304,800 |
| EMEA | Migration | $273,600 |
| APAC | New Logo | $94,000 |
| APAC | Expansion | $46,200 |
| APAC | Migration | $58,650 |
| **TOTAL** | | **$2,659,310** |

### R360 Q1 2026 Targets

| Region | Category | Q1 Target |
|--------|----------|-----------|
| AMER | New Logo | $525,160 |
| AMER | Expansion | $210,000 |
| EMEA | New Logo | $112,200 |
| EMEA | Expansion | $0 |
| APAC | New Logo | $20,400 |
| APAC | Expansion | $850 |
| **TOTAL** | | **$868,610** |

### Combined Q1 2026 Target: **$3,527,920**

---

## Region Mapping

| Division (Salesforce) | Region (Reports) |
|-----------------------|------------------|
| US | AMER |
| UK | EMEA |
| AU | APAC |

---

## Category/FunnelType Mapping

| Type (Salesforce) | Category | POR FunnelType | R360 FunnelType |
|-------------------|----------|----------------|-----------------|
| New Business | NEW LOGO | NEW LOGO | R360 NEW LOGO |
| Existing Business | EXPANSION | EXPANSION | R360 EXPANSION |
| Migration | MIGRATION | MIGRATION | R360 MIGRATION |
| Renewal | RENEWAL | RENEWAL | RENEWAL |

---

## Source Mapping

| SDRSource Value | Mapped Source |
|-----------------|---------------|
| INBOUND | INBOUND |
| OUTBOUND | OUTBOUND |
| AE SOURCED | AE SOURCED |
| AM SOURCED | AM SOURCED |
| TRADESHOW | TRADESHOW |
| N/A or NULL (Expansion/Migration) | AM SOURCED |
| N/A or NULL (New Business) | AE SOURCED |

---

## RAG Status Thresholds

| Status | Attainment Range | Description |
|--------|------------------|-------------|
| GREEN | >= 90% | On track |
| YELLOW | 70% - 89% | At risk |
| RED | < 70% | Off track |

---

## Conversion Benchmarks

| Stage | Benchmark |
|-------|-----------|
| MQL -> SQL | 50% |
| SQL -> SAL | 70% |
| SAL -> SQO | 60% |
| SQO -> Won | 30% |

---

## Report Inventory

| Report | File | Purpose | Scope |
|--------|------|---------|-------|
| Comprehensive Risk | `query_comprehensive_risk_analysis.sql` | Full risk analysis POR+R360 | All metrics |
| POR Risk | `query_por_risk_analysis.sql` | POR-specific risk analysis | POR only |
| R360 Risk | `query_r360_risk_analysis.sql` | R360-specific risk analysis | R360 only |
| Top of Funnel | `query_top_of_funnel_enhanced.sql` | Marketing funnel pacing | Inbound only |
| Marketing Funnel | `query_marketing_funnel_pacing.sql` | Simplified funnel view | Marketing KPIs |

---

## How to Run

### BigQuery CLI

```bash
# Comprehensive Risk Analysis
bq query --use_legacy_sql=false --format=json < "/Users/prestonharris/Risk Report/query_comprehensive_risk_analysis.sql"

# Top of Funnel
bq query --use_legacy_sql=false --format=json < "/Users/prestonharris/Risk Report/query_top_of_funnel_enhanced.sql"

# POR Risk Analysis
bq query --use_legacy_sql=false --format=json < "/Users/prestonharris/Risk Report/query_por_risk_analysis.sql"

# R360 Risk Analysis
bq query --use_legacy_sql=false --format=json < "/Users/prestonharris/Risk Report/query_r360_risk_analysis.sql"
```

### Python Report Generator

```bash
cd "/Users/prestonharris/Risk Report/"
python3 generate_tof_report.py --format all
```

---

## Version History

| Version | Date | Report | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-12 | Comprehensive | Initial unified report |
| 4.2.0 | 2026-01-12 | POR/R360 Risk | FunnelType mapping fix |
| 2.0.0 | 2026-01-12 | Top of Funnel | Enhanced with full features |

---

## Contact

AI Center of Excellence Team
