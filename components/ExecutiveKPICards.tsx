import { ExecutiveCounts } from '@/lib/types';

interface ExecutiveKPICardsProps {
  counts: ExecutiveCounts;
}

export default function ExecutiveKPICards({ counts }: ExecutiveKPICardsProps) {
  const cards = [
    {
      label: 'Exceeding Target',
      value: counts.areas_exceeding_target,
      color: '#22c55e',
      bgColor: '#dcfce7',
    },
    {
      label: 'At Risk',
      value: counts.areas_at_risk,
      color: '#ef4444',
      bgColor: '#fee2e2',
    },
    {
      label: 'Needs Attention',
      value: counts.areas_needing_attention,
      color: '#f59e0b',
      bgColor: '#fef3c7',
    },
    {
      label: 'With Momentum',
      value: counts.areas_with_momentum,
      color: '#3b82f6',
      bgColor: '#dbeafe',
    },
  ];

  return (
    <div className="kpi-cards">
      {cards.map((card) => (
        <div
          key={card.label}
          className="kpi-card"
          style={{
            backgroundColor: card.bgColor,
            borderColor: card.color,
          }}
        >
          <div className="kpi-value" style={{ color: card.color }}>
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
        }
        .kpi-value {
          font-size: 2rem;
          font-weight: bold;
        }
        .kpi-label {
          font-size: 0.875rem;
          color: #4b5563;
          margin-top: 4px;
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
