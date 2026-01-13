'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Region } from '@/lib/types';

interface RegionFilterProps {
  selectedRegions: Region[];
  onRegionChange: (regions: Region[]) => void;
}

const ALL_REGIONS: Region[] = ['AMER', 'EMEA', 'APAC'];

export default function RegionFilter({ selectedRegions, onRegionChange }: RegionFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAllSelected = selectedRegions.length === 3 || selectedRegions.length === 0;

  const handleAllClick = () => {
    onRegionChange(ALL_REGIONS);
    router.push('?region=ALL', { scroll: false });
  };

  const handleRegionClick = (region: Region) => {
    let newRegions: Region[];

    if (selectedRegions.includes(region)) {
      // Remove region (unless it's the last one)
      newRegions = selectedRegions.filter(r => r !== region);
      if (newRegions.length === 0) {
        newRegions = ALL_REGIONS;
      }
    } else {
      // Add region
      newRegions = [...selectedRegions.filter(r => ALL_REGIONS.includes(r)), region];
    }

    // If all regions are selected, show as ALL
    if (newRegions.length === 3) {
      onRegionChange(ALL_REGIONS);
      router.push('?region=ALL', { scroll: false });
    } else {
      onRegionChange(newRegions);
      router.push(`?region=${newRegions.join(',')}`, { scroll: false });
    }
  };

  return (
    <div className="filter-bar">
      <span className="filter-label">Filter by Region:</span>
      <button
        className={`filter-btn ${isAllSelected ? 'active' : ''}`}
        onClick={handleAllClick}
      >
        All Regions
      </button>
      {ALL_REGIONS.map(region => (
        <button
          key={region}
          className={`filter-btn ${!isAllSelected && selectedRegions.includes(region) ? 'active' : ''}`}
          onClick={() => handleRegionClick(region)}
        >
          {region}
        </button>
      ))}
    </div>
  );
}
