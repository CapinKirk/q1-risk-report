import { ExecutiveCounts } from '@/lib/types';

interface ExecutiveKPICardsProps {
  counts: ExecutiveCounts;
}

export default function ExecutiveKPICards({ counts }: ExecutiveKPICardsProps) {
  const cards = [
    {
      label: 'Exceeding Target',
      value: counts.areas_exceeding_target,
      semanticClass: 'card-success',
    },
    {
      label: 'At Risk',
      value: counts.areas_at_risk,
      semanticClass: 'card-danger',
    },
    {
      label: 'Needs Attention',
      value: counts.areas_needing_attention,
      semanticClass: 'card-warning',
    },
    {
      label: 'With Momentum',
      value: counts.areas_with_momentum,
      semanticClass: 'card-info',
    },
  ];

  return (
    <div className="kpi-cards">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`kpi-card ${card.semanticClass}`}
        >
          <div className="kpi-value">
            {card.value}
          </div>
          <div className="kpi-label">{card.label}</div>
        </div>
      ))}
      <style jsx>{`
        .kpi-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .kpi-card {
          padding: 16px;
          border-radius: 8px;
          border: 2px solid;
          text-align: center;
          transition: background-color 0.2s, border-color 0.2s;
        }
        .kpi-value {
          font-size: 2rem;
          font-weight: bold;
        }
        .kpi-label {
          font-size: 0.875rem;
          margin-top: 4px;
          color: var(--text-secondary, #4b5563);
        }

        /* Light mode colors (default) */
        .card-success {
          background-color: #dcfce7;
          border-color: #22c55e;
        }
        .card-success .kpi-value {
          color: #16a34a;
        }
        .card-success .kpi-label {
          color: #166534;
        }

        .card-danger {
          background-color: #fee2e2;
          border-color: #ef4444;
        }
        .card-danger .kpi-value {
          color: #dc2626;
        }
        .card-danger .kpi-label {
          color: #991b1b;
        }

        .card-warning {
          background-color: #fef3c7;
          border-color: #f59e0b;
        }
        .card-warning .kpi-value {
          color: #d97706;
        }
        .card-warning .kpi-label {
          color: #92400e;
        }

        .card-info {
          background-color: #dbeafe;
          border-color: #3b82f6;
        }
        .card-info .kpi-value {
          color: #2563eb;
        }
        .card-info .kpi-label {
          color: #1e40af;
        }

        /* Dark mode colors */
        :global([data-theme="dark"]) .card-success {
          background-color: rgba(34, 197, 94, 0.15);
          border-color: #22c55e;
        }
        :global([data-theme="dark"]) .card-success .kpi-value {
          color: #4ade80;
        }
        :global([data-theme="dark"]) .card-success .kpi-label {
          color: #86efac;
        }

        :global([data-theme="dark"]) .card-danger {
          background-color: rgba(239, 68, 68, 0.15);
          border-color: #ef4444;
        }
        :global([data-theme="dark"]) .card-danger .kpi-value {
          color: #f87171;
        }
        :global([data-theme="dark"]) .card-danger .kpi-label {
          color: #fca5a5;
        }

        :global([data-theme="dark"]) .card-warning {
          background-color: rgba(245, 158, 11, 0.15);
          border-color: #f59e0b;
        }
        :global([data-theme="dark"]) .card-warning .kpi-value {
          color: #fbbf24;
        }
        :global([data-theme="dark"]) .card-warning .kpi-label {
          color: #fcd34d;
        }

        :global([data-theme="dark"]) .card-info {
          background-color: rgba(59, 130, 246, 0.15);
          border-color: #3b82f6;
        }
        :global([data-theme="dark"]) .card-info .kpi-value {
          color: #60a5fa;
        }
        :global([data-theme="dark"]) .card-info .kpi-label {
          color: #93c5fd;
        }

        @media (max-width: 768px) {
          .kpi-cards {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
