'use client';

import { Region, Product, Category, RAGStatus } from '@/lib/types';

// Badge type configurations
type BadgeType = 'region' | 'product' | 'category' | 'status' | 'rag';

interface BadgeConfig {
  icon?: string;
  bg: string;
  text: string;
  border: string;
}

// Region configurations
const REGION_CONFIG: Record<string, BadgeConfig> = {
  AMER: { icon: '🇺🇸', bg: '#1e3a5f', text: '#ffffff', border: '#2563eb' },
  EMEA: { icon: '🇬🇧', bg: '#581c87', text: '#ffffff', border: '#7c3aed' },
  APAC: { icon: '🇦🇺', bg: '#115e59', text: '#ffffff', border: '#14b8a6' },
};

// Product configurations - POR = Green, R360 = Red (consistent across all tables)
const PRODUCT_CONFIG: Record<string, BadgeConfig> = {
  POR: { bg: '#059669', text: '#ffffff', border: '#10b981' },   // Green
  R360: { bg: '#dc2626', text: '#ffffff', border: '#ef4444' },  // Red
};

// Product tile colors (lighter variants for backgrounds)
export const PRODUCT_TILE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  POR: { bg: '#dcfce7', border: '#16a34a', text: '#166534' },   // Light green
  R360: { bg: '#fef2f2', border: '#dc2626', text: '#dc2626' },  // Light red
};

// Category configurations
const CATEGORY_CONFIG: Record<string, BadgeConfig> = {
  'NEW LOGO': { bg: '#059669', text: '#ffffff', border: '#10b981' },
  STRATEGIC: { bg: '#0d9488', text: '#ffffff', border: '#14b8a6' },
  EXPANSION: { bg: '#2563eb', text: '#ffffff', border: '#3b82f6' },
  MIGRATION: { bg: '#7c3aed', text: '#ffffff', border: '#8b5cf6' },
  RENEWAL: { bg: '#ca8a04', text: '#ffffff', border: '#eab308' },
};

// Status configurations
const STATUS_CONFIG: Record<string, BadgeConfig> = {
  ACTIVE: { bg: '#059669', text: '#ffffff', border: '#10b981' },
  CONVERTED: { bg: '#2563eb', text: '#ffffff', border: '#3b82f6' },
  WON: { bg: '#059669', text: '#ffffff', border: '#10b981' },
  LOST: { bg: '#dc2626', text: '#ffffff', border: '#ef4444' },
  STALLED: { bg: '#ca8a04', text: '#ffffff', border: '#eab308' },
  DISQUALIFIED: { bg: '#6b7280', text: '#ffffff', border: '#9ca3af' },
};

// RAG status configurations
const RAG_CONFIG: Record<string, BadgeConfig> = {
  GREEN: { bg: '#059669', text: '#ffffff', border: '#10b981' },
  YELLOW: { bg: '#ca8a04', text: '#ffffff', border: '#eab308' },
  RED: { bg: '#dc2626', text: '#ffffff', border: '#ef4444' },
};

// Default configuration for unknown values
const DEFAULT_CONFIG: BadgeConfig = {
  bg: '#f3f4f6',
  text: '#374151',
  border: '#d1d5db',
};

// Get config based on type and value
function getConfig(type: BadgeType, value: string): BadgeConfig {
  switch (type) {
    case 'region':
      return REGION_CONFIG[value] || DEFAULT_CONFIG;
    case 'product':
      return PRODUCT_CONFIG[value] || DEFAULT_CONFIG;
    case 'category':
      return CATEGORY_CONFIG[value] || DEFAULT_CONFIG;
    case 'status':
      return STATUS_CONFIG[value.toUpperCase()] || DEFAULT_CONFIG;
    case 'rag':
      return RAG_CONFIG[value] || DEFAULT_CONFIG;
    default:
      return DEFAULT_CONFIG;
  }
}

// Badge sizes
type BadgeSize = 'sm' | 'md' | 'lg';

const SIZE_STYLES: Record<BadgeSize, { padding: string; fontSize: string; iconSize: string }> = {
  sm: { padding: '2px 6px', fontSize: '10px', iconSize: '10px' },
  md: { padding: '3px 10px', fontSize: '11px', iconSize: '12px' },
  lg: { padding: '4px 12px', fontSize: '12px', iconSize: '14px' },
};

// Props interfaces for different badge types
interface BaseBadgeProps {
  size?: BadgeSize;
  className?: string;
}

interface RegionBadgeProps extends BaseBadgeProps {
  type: 'region';
  value: Region | string;
}

interface ProductBadgeProps extends BaseBadgeProps {
  type: 'product';
  value: Product | string;
}

interface CategoryBadgeProps extends BaseBadgeProps {
  type: 'category';
  value: Category | string;
}

interface StatusBadgeProps extends BaseBadgeProps {
  type: 'status';
  value: string;
}

interface RAGBadgeProps extends BaseBadgeProps {
  type: 'rag';
  value: RAGStatus | string;
}

type BadgeProps = RegionBadgeProps | ProductBadgeProps | CategoryBadgeProps | StatusBadgeProps | RAGBadgeProps;

/**
 * Unified Badge component for displaying Region, Product, Category, Status, or RAG badges
 *
 * Usage:
 *   <Badge type="region" value="AMER" />
 *   <Badge type="product" value="POR" />
 *   <Badge type="category" value="NEW LOGO" />
 *   <Badge type="status" value="ACTIVE" />
 *   <Badge type="rag" value="GREEN" />
 */
export default function Badge({ type, value, size = 'md', className = '' }: BadgeProps) {
  const config = getConfig(type, value);
  const sizeStyle = SIZE_STYLES[size];

  return (
    <span
      className={`badge badge-${type} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: sizeStyle.padding,
        borderRadius: '6px',
        fontSize: sizeStyle.fontSize,
        fontWeight: 600,
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        whiteSpace: 'nowrap',
      }}
    >
      {config.icon && <span style={{ fontSize: sizeStyle.iconSize }}>{config.icon}</span>}
      {value}
    </span>
  );
}

// Export configurations for use in other components
export { REGION_CONFIG, PRODUCT_CONFIG, CATEGORY_CONFIG, STATUS_CONFIG, RAG_CONFIG };

// Convenience components for common use cases
export function RegionBadge({ value, size = 'md' }: { value: Region | string; size?: BadgeSize }) {
  return <Badge type="region" value={value} size={size} />;
}

export function ProductBadge({ value, size = 'md' }: { value: Product | string; size?: BadgeSize }) {
  return <Badge type="product" value={value} size={size} />;
}

export function CategoryBadge({ value, size = 'md' }: { value: Category | string; size?: BadgeSize }) {
  return <Badge type="category" value={value} size={size} />;
}

export function StatusBadge({ value, size = 'md' }: { value: string; size?: BadgeSize }) {
  return <Badge type="status" value={value} size={size} />;
}

export function RAGBadge({ value, size = 'md' }: { value: RAGStatus | string; size?: BadgeSize }) {
  return <Badge type="rag" value={value} size={size} />;
}
