'use client';

import { ActionItem, Period } from '@/lib/types';

interface ActionItemsDashboardProps {
  actionItems: {
    immediate: ActionItem[];
    short_term: ActionItem[];
    strategic: ActionItem[];
  };
  period: Period;
}

/**
 * Format numbers with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Clean up issue text - format numbers and reduce redundancy
 */
function cleanIssueText(text: string): string {
  // Format dollar amounts with commas
  const formatted = text.replace(/\$(\d+)(?:\.(\d+))?/g, (_, dollars, cents) => {
    const num = parseFloat(dollars + (cents ? '.' + cents : ''));
    return '$' + formatNumber(Math.round(num));
  });

  // Remove redundant phrases
  return formatted
    .replace(/Review and categorize for actionable insights\./gi, '')
    .replace(/Immediate action required to build pipeline\./gi, '')
    .replace(/top of funnel deficit will cascade to bookings\./gi, 'funnel deficit.')
    .replace(/Increase marketing spend or lead gen activities\./gi, '')
    .trim();
}

/**
 * Clean up action text - reduce redundancy
 */
function cleanActionText(text: string): string {
  return text
    .replace(/Immediate pipeline generation needed\.\s*/gi, '')
    .replace(/Review and categorize for process improvement\./gi, 'Review for process improvements.')
    .replace(/Increase marketing spend, launch supplementary campaigns, or expand outbound efforts\./gi, 'Boost marketing/outbound.')
    .replace(/Deploy outbound, accelerate inbound campaigns\./gi, 'Accelerate campaigns.')
    .replace(/Increase prospecting activity\. Review stalled deals for reactivation\./gi, 'Increase prospecting, reactivate stalled deals.')
    .replace(/Implement process improvements based on loss patterns\./gi, 'Address loss patterns.')
    .trim();
}

/**
 * Adjust severity based on quarter progress (sample size)
 * Early quarter = lower severity, later quarter = higher severity
 */
function adjustSeverityForSampleSize(
  severity: string,
  quarterPctComplete: number
): { severity: string; adjusted: boolean } {
  // If we're less than 20% through the quarter, downgrade severity
  if (quarterPctComplete < 20) {
    if (severity === 'CRITICAL') return { severity: 'HIGH', adjusted: true };
    if (severity === 'HIGH') return { severity: 'MEDIUM', adjusted: true };
  }
  // If we're less than 35% through, slight downgrade for CRITICAL
  if (quarterPctComplete < 35) {
    if (severity === 'CRITICAL') return { severity: 'HIGH', adjusted: true };
  }
  return { severity, adjusted: false };
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '#dc2626';
    case 'HIGH': return '#ea580c';
    case 'MEDIUM': return '#ca8a04';
    case 'LOW': return '#16a34a';
    default: return '#6b7280';
  }
}

function getUrgencyStyle(urgency: string): { bg: string; border: string; badge: string } {
  switch (urgency) {
    case 'IMMEDIATE':
      return { bg: '#fef2f2', border: '#fecaca', badge: '#dc2626' };
    case 'SHORT_TERM':
      return { bg: '#fffbeb', border: '#fde68a', badge: '#d97706' };
    case 'STRATEGIC':
      return { bg: '#eff6ff', border: '#bfdbfe', badge: '#2563eb' };
    default:
      return { bg: '#f9fafb', border: '#e5e7eb', badge: '#6b7280' };
  }
}

/**
 * Get attainment color based on percentage
 */
function getAttainmentColor(pct: number): string {
  if (pct >= 90) return '#16a34a'; // green
  if (pct >= 70) return '#ca8a04'; // yellow
  return '#dc2626'; // red
}

/**
 * Sort action items by attainment % (worst first)
 */
function sortByAttainment(items: ActionItem[]): ActionItem[] {
  return [...items].sort((a, b) => {
    const aAtt = a.attainmentPct ?? 100; // Default to 100 if no attainment
    const bAtt = b.attainmentPct ?? 100;
    return aAtt - bAtt; // Lowest attainment first
  });
}

function ActionItemCard({
  item,
  quarterPctComplete
}: {
  item: ActionItem;
  quarterPctComplete: number;
}) {
  const urgencyStyle = getUrgencyStyle(item.urgency);
  const { severity: adjustedSeverity, adjusted } = adjustSeverityForSampleSize(
    item.severity,
    quarterPctComplete
  );

  const cleanedIssue = cleanIssueText(item.issue);
  const cleanedAction = cleanActionText(item.action);
  const hasEnhancedData = item.reason || item.metric || item.recommendedAction;

  return (
    <div
      className="action-card"
      style={{
        backgroundColor: urgencyStyle.bg,
        borderColor: urgencyStyle.border,
      }}
    >
      <div className="action-header">
        <span
          className="severity-badge"
          style={{ backgroundColor: getSeverityColor(adjustedSeverity) }}
        >
          {adjustedSeverity}
          {adjusted && '*'}
        </span>
        {item.attainmentPct !== undefined && (
          <span
            className="attainment-badge"
            style={{ backgroundColor: getAttainmentColor(item.attainmentPct) }}
          >
            {item.attainmentPct.toFixed(0)}%
          </span>
        )}
        <span className="action-context">
          {item.product} {item.region ? `${item.region}` : ''} • {item.category.replace(/_/g, ' ')}
        </span>
      </div>
      <p className="action-issue">{cleanedIssue}</p>

      {/* Enhanced fields */}
      {item.reason && (
        <p className="action-reason">
          <strong>Why:</strong> {item.reason}
        </p>
      )}

      {item.metric && item.metricValue !== undefined && item.metricTarget !== undefined && (
        <p className="action-metric">
          <strong>{item.metric}:</strong> {formatNumber(item.metricValue)} vs {formatNumber(item.metricTarget)} target
        </p>
      )}

      {/* Show recommendedAction if available, otherwise fall back to cleaned action */}
      {item.recommendedAction ? (
        <div className="action-recommendation">
          → {item.recommendedAction}
        </div>
      ) : cleanedAction ? (
        <div className="action-recommendation">
          → {cleanedAction}
        </div>
      ) : null}

      <style jsx>{`
        .action-card {
          border: 1px solid;
          border-radius: 6px;
          padding: 10px;
          margin-bottom: 8px;
        }
        .action-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }
        .severity-badge {
          padding: 2px 6px;
          border-radius: 3px;
          color: white;
          font-size: 0.625rem;
          font-weight: bold;
          text-transform: uppercase;
        }
        .attainment-badge {
          padding: 2px 6px;
          border-radius: 3px;
          color: white;
          font-size: 0.625rem;
          font-weight: bold;
        }
        .action-context {
          font-size: 0.7rem;
          color: #6b7280;
        }
        .action-issue {
          font-size: 0.8rem;
          color: #1f2937;
          margin: 0 0 6px 0;
          line-height: 1.35;
        }
        .action-reason {
          font-size: 0.7rem;
          color: #4b5563;
          margin: 0 0 4px 0;
          line-height: 1.3;
        }
        .action-metric {
          font-size: 0.7rem;
          color: #4b5563;
          margin: 0 0 4px 0;
          line-height: 1.3;
        }
        .action-recommendation {
          font-size: 0.7rem;
          color: #2563eb;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

export default function ActionItemsDashboard({ actionItems, period }: ActionItemsDashboardProps) {
  const { immediate = [], short_term = [], strategic = [] } = actionItems;
  const quarterPct = period.quarter_pct_complete || 0;

  if (immediate.length === 0 && short_term.length === 0 && strategic.length === 0) {
    return null;
  }

  // Sort each category by attainment % (worst first)
  const sortedImmediate = sortByAttainment(immediate);
  const sortedShortTerm = sortByAttainment(short_term);
  const sortedStrategic = sortByAttainment(strategic);

  const showSampleSizeNote = quarterPct < 35;

  return (
    <section>
      <h2>Action Items</h2>
      <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '8px' }}>
        Sorted by attainment % (worst first)
        {showSampleSizeNote && ` • * Severity adjusted for early quarter (${quarterPct.toFixed(0)}% complete)`}
      </p>
      <div className="action-columns">
        {/* Immediate Column */}
        <div className="action-column">
          <div className="column-header" style={{ backgroundColor: '#dc2626' }}>
            IMMEDIATE ({immediate.length})
          </div>
          <div className="column-content">
            {sortedImmediate.slice(0, 6).map((item, idx) => (
              <ActionItemCard key={idx} item={item} quarterPctComplete={quarterPct} />
            ))}
            {sortedImmediate.length > 6 && (
              <div className="more-items">+{sortedImmediate.length - 6} more</div>
            )}
          </div>
        </div>

        {/* Short Term Column */}
        <div className="action-column">
          <div className="column-header" style={{ backgroundColor: '#d97706' }}>
            SHORT TERM ({short_term.length})
          </div>
          <div className="column-content">
            {sortedShortTerm.slice(0, 6).map((item, idx) => (
              <ActionItemCard key={idx} item={item} quarterPctComplete={quarterPct} />
            ))}
            {sortedShortTerm.length > 6 && (
              <div className="more-items">+{sortedShortTerm.length - 6} more</div>
            )}
          </div>
        </div>

        {/* Strategic Column */}
        <div className="action-column">
          <div className="column-header" style={{ backgroundColor: '#2563eb' }}>
            STRATEGIC ({strategic.length})
          </div>
          <div className="column-content">
            {sortedStrategic.slice(0, 6).map((item, idx) => (
              <ActionItemCard key={idx} item={item} quarterPctComplete={quarterPct} />
            ))}
            {sortedStrategic.length > 6 && (
              <div className="more-items">+{sortedStrategic.length - 6} more</div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .action-columns {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 12px;
        }
        .action-column {
          background: #f9fafb;
          border-radius: 8px;
          overflow: hidden;
        }
        .column-header {
          color: white;
          font-weight: bold;
          font-size: 0.7rem;
          padding: 8px 10px;
          text-align: center;
        }
        .column-content {
          padding: 10px;
          max-height: 450px;
          overflow-y: auto;
        }
        .more-items {
          text-align: center;
          padding: 6px;
          color: #6b7280;
          font-size: 0.7rem;
        }
        @media (max-width: 900px) {
          .action-columns {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
