'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Region, ReportData } from '@/lib/types';
import { filterReportData, parseRegionsFromURL } from '@/lib/filterData';
import RegionFilter from '@/components/RegionFilter';
import UserMenu from '@/components/UserMenu';
import ExecutiveSummary from '@/components/ExecutiveSummary';
import AttainmentTable from '@/components/AttainmentTable';
import SourceAttainment from '@/components/SourceAttainment';
import HitsMisses from '@/components/HitsMisses';
import PipelineCoverage from '@/components/PipelineCoverage';
import LostOpportunities from '@/components/LostOpportunities';
import GoogleAdsPerf from '@/components/GoogleAdsPerf';

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

      <ExecutiveSummary data={filteredData} />
      <AttainmentTable data={filteredData} />
      <SourceAttainment data={filteredData} />
      <HitsMisses data={filteredData} />
      <PipelineCoverage data={filteredData} />
      <LostOpportunities data={filteredData} />
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
