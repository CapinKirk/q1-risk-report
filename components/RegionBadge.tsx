'use client';

import { Region } from '@/lib/types';

interface RegionBadgeProps {
  region: Region | string;
}

const REGION_CONFIG: Record<string, { flag: string; bg: string; text: string; border: string }> = {
  AMER: { flag: '🇺🇸', bg: '#1e3a5f', text: '#ffffff', border: '#2563eb' },  // Navy Blue
  EMEA: { flag: '🇬🇧', bg: '#581c87', text: '#ffffff', border: '#7c3aed' },  // Royal Purple
  APAC: { flag: '🇦🇺', bg: '#115e59', text: '#ffffff', border: '#14b8a6' },  // Teal
};

// Export for use in other components
export { REGION_CONFIG };

export default function RegionBadge({ region }: RegionBadgeProps) {
  const config = REGION_CONFIG[region] || { flag: '🌐', bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };

  return (
    <span
      className="region-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      }}
    >
      <span style={{ fontSize: '12px' }}>{config.flag}</span>
      {region}
    </span>
  );
}
