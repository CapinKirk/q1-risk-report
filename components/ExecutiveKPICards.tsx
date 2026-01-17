import { ExecutiveCounts } from '@/lib/types';

interface ExecutiveKPICardsProps {
  counts: ExecutiveCounts;
}

export default function ExecutiveKPICards({ counts }: ExecutiveKPICardsProps) {
  const cards = [
    {
      label: 'Exceeding Target',
      value: counts.areas_exceeding_target,
      semanticClass: 'kpi-success',
    },
    {
      label: 'At Risk',
      value: counts.areas_at_risk,
      semanticClass: 'kpi-danger',
    },
    {
      label: 'Needs Attention',
      value: counts.areas_needing_attention,
      semanticClass: 'kpi-warning',
    },
    {
      label: 'With Momentum',
      value: counts.areas_with_momentum,
      semanticClass: 'kpi-info',
    },
  ];

  return (
    <div className="kpi-cards-container">
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
    </div>
  );
}
