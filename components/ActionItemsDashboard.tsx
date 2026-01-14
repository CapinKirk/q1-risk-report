import { ActionItem } from '@/lib/types';

interface ActionItemsDashboardProps {
  actionItems: {
    immediate: ActionItem[];
    short_term: ActionItem[];
    strategic: ActionItem[];
  };
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

function ActionItemCard({ item }: { item: ActionItem }) {
  const urgencyStyle = getUrgencyStyle(item.urgency);

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
          style={{ backgroundColor: getSeverityColor(item.severity) }}
        >
          {item.severity}
        </span>
        <span className="action-context">
          {item.product} {item.region ? `${item.region}` : ''} • {item.category}
        </span>
      </div>
      <p className="action-issue">{item.issue}</p>
      <div className="action-recommendation">
        <strong>Action:</strong> {item.action}
      </div>
      <style jsx>{`
        .action-card {
          border: 1px solid;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 8px;
        }
        .action-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .severity-badge {
          padding: 2px 6px;
          border-radius: 3px;
          color: white;
          font-size: 0.625rem;
          font-weight: bold;
          text-transform: uppercase;
        }
        .action-context {
          font-size: 0.75rem;
          color: #6b7280;
        }
        .action-issue {
          font-size: 0.875rem;
          color: #1f2937;
          margin: 0 0 8px 0;
          line-height: 1.4;
        }
        .action-recommendation {
          font-size: 0.75rem;
          color: #374151;
          background: rgba(255,255,255,0.7);
          padding: 6px 8px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

export default function ActionItemsDashboard({ actionItems }: ActionItemsDashboardProps) {
  const { immediate = [], short_term = [], strategic = [] } = actionItems;

  if (immediate.length === 0 && short_term.length === 0 && strategic.length === 0) {
    return null;
  }

  return (
    <section>
      <h2>Action Items</h2>
      <div className="action-columns">
        {/* Immediate Column */}
        <div className="action-column">
          <div className="column-header" style={{ backgroundColor: '#dc2626' }}>
            IMMEDIATE ({immediate.length})
          </div>
          <div className="column-content">
            {immediate.slice(0, 5).map((item, idx) => (
              <ActionItemCard key={idx} item={item} />
            ))}
            {immediate.length > 5 && (
              <div className="more-items">+{immediate.length - 5} more</div>
            )}
          </div>
        </div>

        {/* Short Term Column */}
        <div className="action-column">
          <div className="column-header" style={{ backgroundColor: '#d97706' }}>
            SHORT TERM ({short_term.length})
          </div>
          <div className="column-content">
            {short_term.slice(0, 5).map((item, idx) => (
              <ActionItemCard key={idx} item={item} />
            ))}
            {short_term.length > 5 && (
              <div className="more-items">+{short_term.length - 5} more</div>
            )}
          </div>
        </div>

        {/* Strategic Column */}
        <div className="action-column">
          <div className="column-header" style={{ backgroundColor: '#2563eb' }}>
            STRATEGIC ({strategic.length})
          </div>
          <div className="column-content">
            {strategic.slice(0, 5).map((item, idx) => (
              <ActionItemCard key={idx} item={item} />
            ))}
            {strategic.length > 5 && (
              <div className="more-items">+{strategic.length - 5} more</div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .action-columns {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 16px;
        }
        .action-column {
          background: #f9fafb;
          border-radius: 8px;
          overflow: hidden;
        }
        .column-header {
          color: white;
          font-weight: bold;
          font-size: 0.75rem;
          padding: 10px 12px;
          text-align: center;
        }
        .column-content {
          padding: 12px;
          max-height: 500px;
          overflow-y: auto;
        }
        .more-items {
          text-align: center;
          padding: 8px;
          color: #6b7280;
          font-size: 0.75rem;
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
