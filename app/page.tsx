'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Region, ReportData } from '@/lib/types';
import { filterReportData, parseRegionsFromURL } from '@/lib/filterData';
import RegionFilter from '@/components/RegionFilter';
import UserMenu from '@/components/UserMenu';
import ExecutiveKPICards from '@/components/ExecutiveKPICards';
import ExecutiveSummary from '@/components/ExecutiveSummary';
import BrightSpots from '@/components/BrightSpots';
import MomentumTracker from '@/components/MomentumTracker';
import AttainmentTable from '@/components/AttainmentTable';
import SourceAttainment from '@/components/SourceAttainment';
import HitsMisses from '@/components/HitsMisses';
import ActionItemsDashboard from '@/components/ActionItemsDashboard';
import PipelineCoverage from '@/components/PipelineCoverage';
import LostOpportunities from '@/components/LostOpportunities';
import GoogleAdsPerf from '@/components/GoogleAdsPerf';
import OpportunitiesTable from '@/components/OpportunitiesTable';

// Import the pre-generated data
import reportDataJson from '@/data/report-data.json';

function ReportContent() {
  const searchParams = useSearchParams();
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(['AMER', 'EMEA', 'APAC']);
  const [filteredData, setFilteredData] = useState<ReportData | null>(null);

  // Load and parse data
  const rawData = reportDataJson as ReportData;

  // Initialize regions from URL on mount
  useEffect(() => {
    const regions = parseRegionsFromURL(searchParams);
    setSelectedRegions(regions);
  }, [searchParams]);

  // Filter data when regions change
  useEffect(() => {
    if (rawData) {
      const filtered = filterReportData(rawData, selectedRegions);
      setFilteredData(filtered);
    }
  }, [selectedRegions, rawData]);

  if (!filteredData) {
    return <div className="loading">Loading report data...</div>;
  }

  const { period, query_version } = filteredData;

  return (
    <div className="container">
      <div className="header-bar">
        <div>
          <h1>Q1 2026 Risk Analysis Report</h1>
          <div className="meta">
            <span>Report Date: {period.as_of_date}</span>
            <span>Q1 Progress: {period.quarter_pct_complete.toFixed(1)}% ({period.days_elapsed}/{period.total_days} days)</span>
            <span>Version: {query_version || '2.7.0'}</span>
          </div>
        </div>
        <UserMenu />
      </div>

      <RegionFilter
        selectedRegions={selectedRegions}
        onRegionChange={setSelectedRegions}
      />

      {/* Executive KPI Overview Cards */}
      {filteredData.executive_counts && (
        <ExecutiveKPICards counts={filteredData.executive_counts} />
      )}

      <ExecutiveSummary data={filteredData} />

      {/* Bright Spots - Areas exceeding targets */}
      {filteredData.wins_bright_spots && (
        <BrightSpots wins={filteredData.wins_bright_spots} />
      )}

      {/* Momentum Tracker - WoW trend indicators */}
      {filteredData.momentum_indicators && (
        <MomentumTracker momentum={filteredData.momentum_indicators} period={period} />
      )}

      <AttainmentTable data={filteredData} />
      <SourceAttainment data={filteredData} />
      <HitsMisses data={filteredData} />

      {/* Action Items Dashboard */}
      {filteredData.action_items && (
        <ActionItemsDashboard actionItems={filteredData.action_items} period={period} />
      )}

      <PipelineCoverage data={filteredData} />
      <LostOpportunities data={filteredData} />

      {/* Opportunities Table with filtering and pagination */}
      <OpportunitiesTable data={filteredData} selectedRegions={selectedRegions} />

      <GoogleAdsPerf data={filteredData} />

      <footer className="footer">
        <p>
          Generated {new Date().toISOString().split('T')[0]} | Version {query_version || '2.7.0'} | Data as of {period.as_of_date}
        </p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <ReportContent />
    </Suspense>
  );
}
