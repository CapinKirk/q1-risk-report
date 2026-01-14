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
    // Simple single-select: clicking a region selects only that region
    // If the region is already the only one selected, go back to all
    if (selectedRegions.length === 1 && selectedRegions[0] === region) {
      onRegionChange(ALL_REGIONS);
      router.push('?region=ALL', { scroll: false });
    } else {
      onRegionChange([region]);
      router.push(`?region=${region}`, { scroll: false });
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
