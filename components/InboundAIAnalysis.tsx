'use client';

import { useState, useMemo } from 'react';
import { ReportData, Product, Region, ProductTotal, AttainmentRow } from '@/lib/types';

interface InboundAIAnalysisProps {
  reportData: ReportData | null;
  selectedProducts: Product[];
  selectedRegions: Region[];
}

interface AnalysisState {
  loading: boolean;
  analysis: string | null;
  error: string | null;
  generatedAt: string | null;
}

type ViewMode = 'display' | 'slack' | 'html';

function recalculateProductTotals(attainmentRows: AttainmentRow[]): ProductTotal {
  const fyTarget = attainmentRows.reduce((sum, row) => sum + (row.fy_target || 0), 0);
  const q1Target = attainmentRows.reduce((sum, row) => sum + (row.q1_target || 0), 0);
  const qtdTarget = attainmentRows.reduce((sum, row) => sum + (row.qtd_target || 0), 0);
  const qtdAcv = attainmentRows.reduce((sum, row) => sum + (row.qtd_acv || 0), 0);
  const pipelineAcv = attainmentRows.reduce((sum, row) => sum + (row.pipeline_acv || 0), 0);
  const wonDeals = attainmentRows.reduce((sum, row) => sum + (row.qtd_deals || 0), 0);
  const lostDeals = attainmentRows.reduce((sum, row) => sum + (row.qtd_lost_deals || 0), 0);
  const lostAcv = attainmentRows.reduce((sum, row) => sum + (row.qtd_lost_acv || 0), 0);
  const remaining = q1Target - qtdAcv;
  const totalDeals = wonDeals + lostDeals;

  return {
    total_fy_target: fyTarget,
    total_q1_target: q1Target,
    total_qtd_target: qtdTarget,
    total_qtd_acv: qtdAcv,
    total_qtd_attainment_pct: qtdTarget > 0 ? Math.round((qtdAcv / qtdTarget) * 100) : 100,
    total_pipeline_acv: pipelineAcv,
    total_pipeline_coverage_x: remaining > 0 ? Math.round((pipelineAcv / remaining) * 10) / 10 : 0,
    total_win_rate_pct: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 1000) / 10 : 0,
    total_won_deals: wonDeals,
    total_lost_deals: lostDeals,
    total_lost_acv: lostAcv,
  };
}

function filterReportData(reportData: ReportData, products: Product[], regions: Region[]): ReportData {
  const filterByRegion = <T extends { region?: Region }>(arr: T[] | undefined): T[] =>
    arr?.filter(item => !item.region || regions.length === 0 || regions.includes(item.region)) || [];

  const includePOR = products.length === 0 || products.includes('POR');
  const includeR360 = products.length === 0 || products.includes('R360');

  const filteredPOR = includePOR ? filterByRegion(reportData.attainment_detail?.POR) : [];
  const filteredR360 = includeR360 ? filterByRegion(reportData.attainment_detail?.R360) : [];

  const emptyTotal: ProductTotal = {
    total_fy_target: 0, total_q1_target: 0, total_qtd_target: 0, total_qtd_acv: 0,
    total_qtd_attainment_pct: 0, total_pipeline_acv: 0, total_pipeline_coverage_x: 0,
    total_win_rate_pct: 0, total_won_deals: 0, total_lost_deals: 0, total_lost_acv: 0,
  };

  const porTotals = includePOR ? recalculateProductTotals(filteredPOR) : emptyTotal;
  const r360Totals = includeR360 ? recalculateProductTotals(filteredR360) : emptyTotal;

  const combinedQtdTarget = porTotals.total_qtd_target + r360Totals.total_qtd_target;
  const combinedQtdAcv = porTotals.total_qtd_acv + r360Totals.total_qtd_acv;
  const combinedPipeline = porTotals.total_pipeline_acv + r360Totals.total_pipeline_acv;
  const totalQ1Target = porTotals.total_q1_target + r360Totals.total_q1_target;
  const totalRemaining = totalQ1Target - combinedQtdAcv;
  const combinedWonDeals = porTotals.total_won_deals + r360Totals.total_won_deals;
  const combinedLostDeals = porTotals.total_lost_deals + r360Totals.total_lost_deals;
  const combinedTotalDeals = combinedWonDeals + combinedLostDeals;

  return {
    ...reportData,
    grand_total: {
      total_fy_target: porTotals.total_fy_target + r360Totals.total_fy_target,
      total_q1_target: totalQ1Target,
      total_qtd_target: combinedQtdTarget,
      total_qtd_acv: combinedQtdAcv,
      total_qtd_attainment_pct: combinedQtdTarget > 0 ? Math.round((combinedQtdAcv / combinedQtdTarget) * 100) : 100,
      total_pipeline_acv: combinedPipeline,
      total_pipeline_coverage_x: totalRemaining > 0 ? Math.round((combinedPipeline / totalRemaining) * 10) / 10 : 0,
      total_win_rate_pct: combinedTotalDeals > 0 ? Math.round((combinedWonDeals / combinedTotalDeals) * 1000) / 10 : 0,
      total_won_deals: combinedWonDeals,
      total_lost_deals: combinedLostDeals,
    },
    product_totals: { POR: porTotals, R360: r360Totals },
    attainment_detail: { POR: filteredPOR, R360: filteredR360 },
    funnel_by_category: {
      POR: includePOR ? filterByRegion(reportData.funnel_by_category?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.funnel_by_category?.R360) : [],
    },
    funnel_by_source: {
      POR: includePOR ? filterByRegion(reportData.funnel_by_source?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.funnel_by_source?.R360) : [],
    },
    source_attainment: {
      POR: includePOR ? filterByRegion(reportData.source_attainment?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.source_attainment?.R360) : [],
    },
    google_ads: {
      POR: includePOR ? filterByRegion(reportData.google_ads?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.google_ads?.R360) : [],
    },
    google_ads_rca: {
      POR: includePOR ? (reportData.google_ads_rca?.POR || []) : [],
      R360: includeR360 ? (reportData.google_ads_rca?.R360 || []) : [],
    },
    mql_details: {
      POR: includePOR ? filterByRegion(reportData.mql_details?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.mql_details?.R360) : [],
    },
    sql_details: {
      POR: includePOR ? filterByRegion(reportData.sql_details?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.sql_details?.R360) : [],
    },
    sal_details: {
      POR: includePOR ? filterByRegion(reportData.sal_details?.POR) : [],
      R360: includeR360 ? filterByRegion(reportData.sal_details?.R360) : [],
    },
  };
}

function getFilterLabel(products: Product[], regions: Region[]): string {
  const productLabel = products.length === 0 || products.length === 2 ? 'All Products' : products[0];
  const regionLabel = regions.length === 0 || regions.length === 3 ? 'All Regions' : regions.join(', ');
  return `${productLabel} • ${regionLabel}`;
}

// Format inline text with badges and highlighting
function formatInline(text: string): string {
  return text
    // First strip all markdown formatting
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [text](url) -> text
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')     // ***bold italic*** -> plain
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // **bold** -> strong
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')      // __bold__ -> strong
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')   // *italic* -> em
    .replace(/_([^_\s][^_]*[^_\s])_/g, '<em>$1</em>')  // _italic_ -> em
    .replace(/`([^`]+)`/g, '<code>$1</code>')  // `code` -> code
    // Product badges
    .replace(/\bPOR\b/g, '<span class="badge-por">POR</span>')
    .replace(/\bR360\b/g, '<span class="badge-r360">R360</span>')
    // Risk levels
    .replace(/\bHIGH\b/gi, '<span class="risk-high">HIGH</span>')
    .replace(/\bMEDIUM\b/gi, '<span class="risk-medium">MEDIUM</span>')
    .replace(/\bLOW\b/gi, '<span class="risk-low">LOW</span>')
    // Funnel stages
    .replace(/\b(MQL|SQL|SAL|SQO|EQL)\b/g, '<span class="stage-badge">$1</span>')
    // CPA highlighting
    .replace(/\$[\d,]+\.?\d*\s*\(target/gi, '<span class="text-red">$&</span>')
    // Percentages with "attainment" or "behind"
    .replace(/(\d+%)\s*(attainment|behind)/gi, '<span class="text-amber">$1</span> $2')
    // Positive variances
    .replace(/(\+\$?[\d,]+\.?\d*%?)/g, '<span class="text-green">$1</span>')
    // Negative variances
    .replace(/(-\$?[\d,]+\.?\d*%?)/g, '<span class="text-red">$1</span>');
}

// Detect section type from header text
function getSectionType(text: string): { type: string; emoji: string; color: string } {
  const t = text.toLowerCase();
  // Region-specific sections
  if (t.includes('amer') || t.includes('americas') || t.includes('us ') || t.includes('united states')) {
    return { type: 'region-amer', emoji: '🇺🇸', color: '#2563eb' };
  }
  if (t.includes('emea') || t.includes('europe') || t.includes('uk ') || t.includes('united kingdom')) {
    return { type: 'region-emea', emoji: '🇬🇧', color: '#7c3aed' };
  }
  if (t.includes('apac') || t.includes('asia') || t.includes('pacific') || t.includes('australia')) {
    return { type: 'region-apac', emoji: '🇦🇺', color: '#0d9488' };
  }
  if (t.includes('risk') && (t.includes('inbound') || t.includes('q1') || t.includes('plan'))) {
    return { type: 'risks', emoji: '🚨', color: '#dc2626' };
  }
  if (t.includes('root cause') || t.includes('rca') || t.includes('analysis')) {
    return { type: 'rca', emoji: '🔍', color: '#f59e0b' };
  }
  if (t.includes('action') || t.includes('recommend') || t.includes('next step')) {
    return { type: 'actions', emoji: '✅', color: '#10b981' };
  }
  if (t.includes('overall') || t.includes('assessment') || t.includes('summary')) {
    return { type: 'summary', emoji: '⚠️', color: '#ef4444' };
  }
  if (t.includes('lead') || t.includes('volume')) {
    return { type: 'leads', emoji: '📊', color: '#6366f1' };
  }
  if (t.includes('conversion')) {
    return { type: 'conversion', emoji: '📈', color: '#8b5cf6' };
  }
  if (t.includes('google') || t.includes('ads') || t.includes('cpa')) {
    return { type: 'ads', emoji: '📢', color: '#0ea5e9' };
  }
  return { type: 'default', emoji: '📈', color: '#10b981' };
}

// Check if line is a section header
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  // Include country flag emojis (🇺🇸🇬🇧🇦🇺) and standard section emojis
  if (/^[🚨📊✅⚠️📈📋🔍💡🎯📌📢🇺🇸🇬🇧🇦🇺🌍🌎🌏]/.test(trimmed)) return true;
  if (/^#{1,4}\s+.+/.test(trimmed)) return true;  // Match 1-4 # markers
  // ALL-CAPS section headers (e.g., "EXECUTIVE SUMMARY", "FUNNEL CONVERSION ANALYSIS")
  if (/^[A-Z][A-Z &\/\-']{8,}[A-Z]$/.test(trimmed)) return true;
  return false;
}

// Check if line is a metric/risk item (product + region + stage pattern)
function isMetricItem(line: string): boolean {
  const trimmed = line.trim();
  // Patterns like "POR APAC MQL:" or "AMER R360 CPA:"
  return /^(POR|R360)\s+(AMER|EMEA|APAC)\s+(MQL|SQL|SAL|SQO|CPA)/i.test(trimmed) ||
         /^(AMER|EMEA|APAC)\s+(POR|R360)\s+(MQL|SQL|SAL|SQO|CPA)/i.test(trimmed);
}

// Check if line starts with Action/Owner/Timeline pattern
function isActionItem(line: string): boolean {
  return /^(Action|Owner|Timeline|Expected Impact):/i.test(line.trim());
}

// Check if line is a standalone number
function isStandaloneNumber(line: string): boolean {
  return /^\d+$/.test(line.trim());
}

// Nested bullet item
interface BulletItem {
  text: string;
  children: BulletItem[];
}

// Parse content into structured sections
interface ContentSection {
  type: 'header' | 'metrics' | 'actions' | 'bullets' | 'numbered' | 'paragraph' | 'summary-box';
  header?: { title: string; emoji: string; color: string };
  metrics?: string[];
  actions?: { action: string; owner: string; timeline: string; impact: string }[];
  bullets?: BulletItem[];
  numbered?: { num: string; text: string }[];
  text?: string;
}

// Preprocess markdown to split inline numbered lists into separate lines
function preprocessNumberedLists(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    // Check if line contains inline numbered items like "1. xxx 2. xxx 3. xxx"
    // Pattern: starts with "1." and contains " 2." or " 3." etc later in the line
    if (/^\d+\.\s+.+\s+\d+\.\s+/.test(line.trim())) {
      // Split on pattern like " 2. " or " 3. " (space + digit + period + space)
      const parts = line.trim().split(/\s+(?=\d+\.\s)/);
      for (const part of parts) {
        if (part.trim()) {
          result.push(part.trim());
        }
      }
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

function parseContent(markdown: string): ContentSection[] {
  // Preprocess to split inline numbered lists
  const preprocessed = preprocessNumberedLists(markdown);
  const lines = preprocessed.split('\n');
  const sections: ContentSection[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines and standalone numbers
    if (!line || isStandaloneNumber(line)) {
      i++;
      continue;
    }

    // Section header
    if (isSectionHeader(line)) {
      let title = line.replace(/^#{1,4}\s+/, '');  // Strip 1-4 # markers
      let emoji = '📈';

      // Match country flag emojis (note: flags are 2 unicode chars) and standard emojis
      const emojiMatch = title.match(/^(🇺🇸|🇬🇧|🇦🇺|🌍|🌎|🌏|[🚨📊✅⚠️📈📋🔍💡🎯📌📢])\s*/);
      if (emojiMatch) {
        emoji = emojiMatch[1];
        title = title.slice(emojiMatch[0].length);
      }

      // Convert ALL-CAPS to Title Case for display
      if (/^[A-Z][A-Z &\/\-']+[A-Z]$/.test(title)) {
        title = title.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      }

      const sectionInfo = getSectionType(title);
      sections.push({
        type: 'header',
        header: { title, emoji: emoji || sectionInfo.emoji, color: sectionInfo.color }
      });
      i++;
      continue;
    }

    // Metric items (funnel stage risks)
    if (isMetricItem(line)) {
      const metrics: string[] = [];

      while (i < lines.length) {
        const metricLine = lines[i].trim();
        if (!metricLine || isStandaloneNumber(metricLine)) { i++; continue; }
        if (isSectionHeader(metricLine)) break;
        if (isActionItem(metricLine)) break;

        if (isMetricItem(metricLine)) {
          metrics.push(metricLine);
          i++;
        } else {
          // Continuation or next line detail
          if (metrics.length > 0 && !metricLine.startsWith('-')) {
            // Skip non-metric lines that aren't bullets
          }
          break;
        }
      }

      if (metrics.length > 0) {
        sections.push({ type: 'metrics', metrics });
      }
      continue;
    }

    // Action items (Action/Owner/Timeline groups)
    if (isActionItem(line)) {
      const actions: { action: string; owner: string; timeline: string; impact: string }[] = [];
      let currentAction = { action: '', owner: '', timeline: '', impact: '' };

      while (i < lines.length) {
        const actionLine = lines[i].trim();
        if (!actionLine) {
          if (currentAction.action) {
            actions.push({ ...currentAction });
            currentAction = { action: '', owner: '', timeline: '', impact: '' };
          }
          i++;
          continue;
        }
        if (isSectionHeader(actionLine)) break;

        const actionMatch = actionLine.match(/^Action:\s*(.+)$/i);
        const ownerMatch = actionLine.match(/^Owner:\s*(.+)$/i);
        const timelineMatch = actionLine.match(/^Timeline:\s*(.+)$/i);
        const impactMatch = actionLine.match(/^Expected Impact:\s*(.+)$/i);

        if (actionMatch) {
          if (currentAction.action) {
            actions.push({ ...currentAction });
          }
          currentAction = { action: actionMatch[1], owner: '', timeline: '', impact: '' };
        } else if (ownerMatch) {
          currentAction.owner = ownerMatch[1];
        } else if (timelineMatch) {
          currentAction.timeline = timelineMatch[1];
        } else if (impactMatch) {
          currentAction.impact = impactMatch[1];
        } else if (!isMetricItem(actionLine)) {
          // Unknown line, might be end of actions
          if (currentAction.action) {
            actions.push({ ...currentAction });
            currentAction = { action: '', owner: '', timeline: '', impact: '' };
          }
          break;
        }
        i++;
      }

      if (currentAction.action) {
        actions.push(currentAction);
      }

      if (actions.length > 0) {
        sections.push({ type: 'actions', actions });
      }
      continue;
    }

    // Bullet list (with nesting support)
    if (/^[-*•◦]\s/.test(line)) {
      const bullets: BulletItem[] = [];

      while (i < lines.length) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();
        if (!trimmed) { i++; continue; }
        if (isSectionHeader(trimmed) || isMetricItem(trimmed) || isActionItem(trimmed)) break;

        const indent = rawLine.length - rawLine.replace(/^\s+/, '').length;
        const bulletMatch = trimmed.match(/^[-*•◦]\s*(.+)$/);
        if (bulletMatch) {
          if (indent >= 2 && bullets.length > 0) {
            // Sub-bullet: attach to last top-level bullet
            bullets[bullets.length - 1].children.push({ text: bulletMatch[1], children: [] });
          } else {
            // Top-level bullet
            bullets.push({ text: bulletMatch[1], children: [] });
          }
          i++;
        } else {
          break;
        }
      }

      if (bullets.length > 0) {
        sections.push({ type: 'bullets', bullets });
      }
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const numbered: { num: string; text: string }[] = [];

      while (i < lines.length) {
        const numLine = lines[i].trim();
        if (!numLine) { i++; continue; }
        if (isSectionHeader(numLine) || isMetricItem(numLine) || isActionItem(numLine)) break;

        const numMatch = numLine.match(/^(\d+)\.\s*(.+)$/);
        if (numMatch) {
          numbered.push({ num: numMatch[1], text: numMatch[2] });
          i++;
        } else if (/^[-*•]\s/.test(numLine)) {
          // Bullet after numbers - break to handle separately
          break;
        } else {
          break;
        }
      }

      if (numbered.length > 0) {
        sections.push({ type: 'numbered', numbered });
      }
      continue;
    }

    // Summary box detection
    if (/^(Risk Level|Key Risk|\$ at Risk|Confidence)/i.test(line)) {
      const summaryLines: string[] = [line];
      i++;

      while (i < lines.length) {
        const sumLine = lines[i].trim();
        if (!sumLine) { i++; break; }
        if (isSectionHeader(sumLine) || isMetricItem(sumLine)) break;
        summaryLines.push(sumLine);
        i++;
      }

      sections.push({ type: 'summary-box', text: summaryLines.join('\n') });
      continue;
    }

    // Regular paragraph
    let paragraph = line;
    i++;

    while (i < lines.length) {
      const nextLine = lines[i].trim();
      if (!nextLine) { i++; break; }
      if (isSectionHeader(nextLine) || isMetricItem(nextLine) || isActionItem(nextLine) || /^[-*•]\s/.test(nextLine)) break;
      paragraph += ' ' + nextLine;
      i++;
    }

    sections.push({ type: 'paragraph', text: paragraph });
  }

  return sections;
}

// Render parsed content as JSX
function renderContent(sections: ContentSection[]): JSX.Element[] {
  return sections.map((section, idx) => {
    switch (section.type) {
      case 'header':
        return (
          <div
            key={idx}
            className="section-header"
            style={{ '--section-color': section.header!.color } as React.CSSProperties}
          >
            <span className="section-emoji">{section.header!.emoji}</span>
            <h3 className="section-title">{section.header!.title}</h3>
          </div>
        );

      case 'metrics':
        return (
          <div key={idx} className="metrics-grid">
            {section.metrics!.map((metric, mIdx) => {
              const isPOR = metric.includes('POR');
              const isHigh = /HIGH/i.test(metric);
              const isMedium = /MEDIUM/i.test(metric);

              return (
                <div
                  key={mIdx}
                  className={`metric-card ${isHigh ? 'risk-high-card' : isMedium ? 'risk-medium-card' : ''}`}
                >
                  <div
                    className="metric-content"
                    dangerouslySetInnerHTML={{ __html: formatInline(metric) }}
                  />
                </div>
              );
            })}
          </div>
        );

      case 'actions':
        return (
          <div key={idx} className="actions-list">
            {section.actions!.map((action, aIdx) => (
              <div key={aIdx} className="action-card">
                <div className="action-main" dangerouslySetInnerHTML={{ __html: formatInline(action.action) }} />
                <div className="action-meta">
                  {action.owner && <span className="meta-item"><strong>Owner:</strong> {action.owner}</span>}
                  {action.timeline && <span className="meta-item"><strong>Timeline:</strong> {action.timeline}</span>}
                </div>
                {action.impact && (
                  <div className="action-impact">
                    <span className="impact-label">Expected Impact:</span> {action.impact}
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case 'bullets':
        return (
          <ul key={idx} className="bullet-list">
            {section.bullets!.map((bullet, bIdx) => (
              <li key={bIdx}>
                <span dangerouslySetInnerHTML={{ __html: formatInline(bullet.text) }} />
                {bullet.children.length > 0 && (
                  <ul className="bullet-list-nested">
                    {bullet.children.map((child, cIdx) => (
                      <li key={cIdx} dangerouslySetInnerHTML={{ __html: formatInline(child.text) }} />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        );

      case 'numbered':
        return (
          <ol key={idx} className="numbered-list">
            {section.numbered!.map((item, nIdx) => (
              <li key={nIdx} value={parseInt(item.num)} dangerouslySetInnerHTML={{ __html: formatInline(item.text) }} />
            ))}
          </ol>
        );

      case 'summary-box':
        return (
          <div key={idx} className="summary-box">
            {section.text!.split('\n').map((line, lIdx) => (
              <div key={lIdx} className="summary-line" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
            ))}
          </div>
        );

      case 'paragraph':
        return (
          <p key={idx} className="content-para" dangerouslySetInnerHTML={{ __html: formatInline(section.text!) }} />
        );

      default:
        return null;
    }
  }).filter((el): el is JSX.Element => el !== null);
}

// Slack export format - clean plain text that looks good when pasted
// Note: Slack doesn't render mrkdwn when you paste text - it shows literal characters
function toSlackFormat(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];

  // Strip all markdown formatting for plain text
  const stripMarkdown = (text: string) => text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1')       // *italic* -> italic
    .replace(/__([^_]+)__/g, '$1')       // __bold__ -> bold
    .replace(/_([^_]+)_/g, '$1')         // _italic_ -> italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [text](url) -> text
    .replace(/`([^`]+)`/g, '$1')         // `code` -> code
    .trim();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip standalone numbers
    if (/^\d+$/.test(trimmed)) continue;

    // Main headers (### with emoji) - format as section header
    if (/^#{2,3}\s+/.test(trimmed)) {
      const title = stripMarkdown(trimmed.replace(/^#+\s*/, ''));
      output.push('');
      output.push('═'.repeat(Math.min(title.length + 4, 50)));
      output.push(`  ${title}`);
      output.push('═'.repeat(Math.min(title.length + 4, 50)));
      continue;
    }

    // Numbered items (e.g., "1. Item")
    const numMatch = trimmed.match(/^(\d+)\.\s*(.+)$/);
    if (numMatch) {
      const content = stripMarkdown(numMatch[2]);
      const parts = content.split(/\s*\|\s*/);
      if (parts.length > 1) {
        output.push('');
        output.push(`${numMatch[1]}. ${parts[0]}`);
        for (let j = 1; j < parts.length; j++) {
          output.push(`   • ${parts[j]}`);
        }
      } else {
        output.push(`${numMatch[1]}. ${content}`);
      }
      continue;
    }

    // Summary/metric lines
    if (/^(Total|Conversion|Q1 Target|MQL|SQL|SQO|CPA)/i.test(trimmed)) {
      output.push(`→ ${stripMarkdown(trimmed)}`);
      continue;
    }

    // Regular bullet points
    if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
      output.push(`  • ${stripMarkdown(trimmed.replace(/^[-*•]\s*/, ''))}`);
      continue;
    }

    // Everything else
    output.push(stripMarkdown(trimmed));
  }

  return output
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// HTML export
function toHTMLExport(markdown: string, generatedAt: string | null): string {
  const sections = parseContent(markdown);
  const html: string[] = [];

  for (const section of sections) {
    switch (section.type) {
      case 'header':
        html.push(`<h2 style="font-size:18px;font-weight:600;color:${section.header!.color};margin:24px 0 12px;padding:12px 16px;background:${section.header!.color}10;border-left:4px solid ${section.header!.color};border-radius:0 6px 6px 0;">${section.header!.emoji} ${section.header!.title}</h2>`);
        break;
      case 'metrics':
        html.push('<div style="display:flex;flex-direction:column;gap:8px;margin:12px 0;">');
        for (const metric of section.metrics!) {
          html.push(`<div style="padding:10px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;">${formatInline(metric)}</div>`);
        }
        html.push('</div>');
        break;
      case 'actions':
        html.push('<div style="display:flex;flex-direction:column;gap:12px;margin:12px 0;">');
        for (const action of section.actions!) {
          html.push(`<div style="padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
            <div style="font-weight:600;margin-bottom:8px;">${formatInline(action.action)}</div>
            <div style="font-size:12px;color:#6b7280;">${action.owner ? `<strong>Owner:</strong> ${action.owner}` : ''} ${action.timeline ? `<strong>Timeline:</strong> ${action.timeline}` : ''}</div>
            ${action.impact ? `<div style="font-size:12px;color:#059669;margin-top:6px;"><strong>Impact:</strong> ${action.impact}</div>` : ''}
          </div>`);
        }
        html.push('</div>');
        break;
      case 'bullets':
        html.push('<ul style="margin:12px 0;padding-left:20px;">');
        for (const bullet of section.bullets!) {
          html.push(`<li style="margin:6px 0;font-size:14px;">${formatInline(bullet.text)}`);
          if (bullet.children.length > 0) {
            html.push('<ul style="margin:4px 0;padding-left:16px;">');
            for (const child of bullet.children) {
              html.push(`<li style="margin:3px 0;font-size:13px;color:#6b7280;">${formatInline(child.text)}</li>`);
            }
            html.push('</ul>');
          }
          html.push('</li>');
        }
        html.push('</ul>');
        break;
      case 'summary-box':
        html.push(`<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0;">`);
        for (const line of section.text!.split('\n')) {
          html.push(`<div style="font-size:14px;margin:4px 0;">${formatInline(line)}</div>`);
        }
        html.push('</div>');
        break;
      case 'paragraph':
        html.push(`<p style="margin:12px 0;font-size:14px;line-height:1.6;">${formatInline(section.text!)}</p>`);
        break;
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Inbound Marketing Analysis</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:900px;margin:0 auto;padding:40px 20px;background:#fff;color:#1f2937;line-height:1.6;}
strong{font-weight:600;}.badge-por{background:#22c55e;color:white;padding:2px 6px;border-radius:3px;font-size:12px;font-weight:600;}
.badge-r360{background:#ef4444;color:white;padding:2px 6px;border-radius:3px;font-size:12px;font-weight:600;}
.stage-badge{background:#e0e7ff;color:#4338ca;padding:2px 6px;border-radius:3px;font-size:12px;font-weight:600;}
.risk-high{background:#fef2f2;color:#dc2626;padding:2px 6px;border-radius:3px;font-weight:600;}
.risk-medium{background:#fffbeb;color:#d97706;padding:2px 6px;border-radius:3px;font-weight:600;}
.text-green{color:#16a34a;font-weight:600;}.text-red{color:#dc2626;font-weight:600;}.text-amber{color:#d97706;font-weight:600;}</style>
</head><body>
<div style="margin-bottom:24px;border-bottom:2px solid #e5e7eb;padding-bottom:16px;"><h1 style="font-size:24px;margin:0 0 4px;">Inbound Marketing Analysis</h1>
<div style="color:#6b7280;font-size:13px;">Generated: ${generatedAt ? new Date(generatedAt).toLocaleString() : 'N/A'}</div></div>
${html.join('\n')}
</body></html>`;
}

export default function InboundAIAnalysis({ reportData, selectedProducts, selectedRegions }: InboundAIAnalysisProps) {
  const [state, setState] = useState<AnalysisState>({
    loading: false, analysis: null, error: null, generatedAt: null,
  });
  const [viewMode, setViewMode] = useState<ViewMode>('display');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const generateAnalysis = async () => {
    if (!reportData) return;
    setState({ loading: true, analysis: null, error: null, generatedAt: null });
    setViewMode('display');

    try {
      const filteredData = filterReportData(reportData, selectedProducts, selectedRegions);
      const response = await fetch('/api/ai-analysis-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportData: filteredData,
          filterContext: {
            products: selectedProducts.length === 0 ? ['POR', 'R360'] : selectedProducts,
            regions: selectedRegions.length === 0 ? ['AMER', 'EMEA', 'APAC'] : selectedRegions,
            isFiltered: selectedProducts.length > 0 || selectedRegions.length > 0,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate analysis');
      setState({ loading: false, analysis: data.analysis, error: null, generatedAt: data.generated_at });
    } catch (error: any) {
      setState({ loading: false, analysis: null, error: error.message || 'Failed to generate analysis', generatedAt: null });
    }
  };

  const clearAnalysis = () => setState({ loading: false, analysis: null, error: null, generatedAt: null });
  const filterLabel = getFilterLabel(selectedProducts, selectedRegions);

  const parsedSections = useMemo(() => {
    if (!state.analysis) return null;
    return parseContent(state.analysis);
  }, [state.analysis]);

  const handleCopySlack = async () => {
    if (!state.analysis) return;
    try {
      await navigator.clipboard.writeText(toSlackFormat(state.analysis));
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { setCopySuccess('Failed'); setTimeout(() => setCopySuccess(null), 2000); }
  };

  const handleOpenHTML = () => {
    if (!state.analysis) return;
    const html = toHTMLExport(state.analysis, state.generatedAt);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="ai-analysis-section" data-testid="inbound-ai-analysis">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-title">
          <span className="ai-icon">AI</span>
          <h2>Inbound Marketing Deep Dive</h2>
        </div>
        <div className="header-actions">
          <button onClick={generateAnalysis} disabled={state.loading || !reportData} className="btn btn-primary">
            {state.loading ? (
              <>
                <span className="spinner-small" />
                Analyzing...
              </>
            ) : (
              <>Generate Analysis</>
            )}
          </button>
          {state.analysis && <button onClick={clearAnalysis} className="btn btn-ghost">Clear</button>}
        </div>
      </div>

      {/* Content Panel */}
      <div className="content-panel">
        {/* Filter Context */}
        <div className="filter-context">
          <span className="filter-label">Analyzing:</span>
          <span className="filter-value">{filterLabel}</span>
          {state.generatedAt && (
            <span className="timestamp">
              Generated: {new Date(state.generatedAt).toLocaleString()}
            </span>
          )}
          {state.analysis && (
            <div className="view-tabs">
              <button className={`tab ${viewMode === 'display' ? 'active' : ''}`} onClick={() => setViewMode('display')}>Display</button>
              <button className={`tab ${viewMode === 'slack' ? 'active' : ''}`} onClick={() => setViewMode('slack')}>Slack</button>
              <button className={`tab ${viewMode === 'html' ? 'active' : ''}`} onClick={() => setViewMode('html')}>HTML</button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="panel-content">
          {state.error && (
            <div className="error-message">
              <span className="error-icon">!</span>
              {state.error}
            </div>
          )}

          {!state.analysis && !state.loading && !state.error && (
            <div className="placeholder">
              <div className="placeholder-icon">AI</div>
              <p className="placeholder-text">
                Click <strong>Generate Analysis</strong> to get AI-powered insights on funnel performance,
                conversion rates, and Google Ads metrics.
              </p>
              <p className="placeholder-hint">
                Use the filters above to narrow down to specific products or regions before generating.
              </p>
            </div>
          )}

          {state.loading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Analyzing inbound marketing for {filterLabel}...</p>
            </div>
          )}

          {state.analysis && viewMode === 'display' && parsedSections && (
            <div className="analysis-content">{renderContent(parsedSections)}</div>
          )}

          {state.analysis && viewMode === 'slack' && (
            <div className="export-view">
              <div className="export-header">
                <span>Slack format</span>
                <button onClick={handleCopySlack} className="btn btn-copy">{copySuccess || 'Copy'}</button>
              </div>
              <pre className="export-preview">{toSlackFormat(state.analysis)}</pre>
            </div>
          )}

          {state.analysis && viewMode === 'html' && (
            <div className="export-cta">
              <h3>Export as HTML</h3>
              <p>Open formatted report in browser for sharing or printing.</p>
              <button onClick={handleOpenHTML} className="btn btn-primary">Open in Browser</button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .ai-analysis-section {
          margin-top: 32px;
          margin-bottom: 32px;
        }

        .ai-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .ai-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ai-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          font-weight: 700;
          font-size: 0.85em;
          border-radius: 8px;
          letter-spacing: -0.5px;
        }

        .ai-header h2 {
          margin: 0;
          font-size: 1.35em;
          font-weight: 600;
          color: var(--text-primary);
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .btn {
          padding: 10px 18px;
          border: none;
          border-radius: 8px;
          font-size: 0.9em;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s ease;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-tertiary);
        }

        .btn-ghost:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .btn-copy {
          padding: 6px 14px;
          font-size: 0.85em;
          background: #2563eb;
          color: white;
          border-radius: 6px;
        }

        .btn-copy:hover {
          background: #1d4ed8;
        }

        /* Content Panel */
        .content-panel {
          background: var(--bg-secondary);
          border: 2px solid var(--border-primary);
          border-radius: 12px;
          min-height: 200px;
        }

        .filter-context {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-tertiary);
          background: var(--bg-tertiary);
          border-radius: 10px 10px 0 0;
          flex-wrap: wrap;
        }

        .filter-label {
          font-size: 0.9em;
          color: var(--text-tertiary);
        }

        .filter-value {
          font-size: 0.95em;
          font-weight: 600;
          color: var(--text-primary);
          padding: 4px 12px;
          background: var(--accent-blue);
          color: white;
          border-radius: 6px;
        }

        .timestamp {
          font-size: 0.85em;
          color: var(--text-muted);
          margin-left: auto;
        }

        .view-tabs {
          display: flex;
          gap: 4px;
          margin-left: auto;
        }

        .tab {
          padding: 6px 14px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.85em;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tab:hover {
          background: var(--bg-hover);
        }

        .tab.active {
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .panel-content {
          padding: 28px 32px;
        }

        /* Error State */
        .error-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: var(--danger-bg);
          border: 1px solid var(--danger-border);
          border-radius: 8px;
          color: var(--danger-text);
          font-size: 0.95em;
        }

        .error-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #dc2626;
          color: white;
          border-radius: 50%;
          font-weight: 700;
          font-size: 0.85em;
        }

        /* Placeholder State */
        .placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
        }

        .placeholder-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
          color: #6366f1;
          font-weight: 700;
          font-size: 1.2em;
          border-radius: 16px;
          margin-bottom: 20px;
        }

        .placeholder-text {
          font-size: 1em;
          color: var(--text-primary);
          max-width: 450px;
          line-height: 1.6;
          margin-bottom: 8px;
        }

        .placeholder-hint {
          font-size: 0.9em;
          color: var(--text-muted);
        }

        /* Loading State */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          color: var(--text-tertiary);
        }

        .loading-state p {
          font-size: 1em;
          margin-top: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--border-primary);
          border-top-color: var(--accent-blue);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          display: inline-block;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Analysis Content */
        .analysis-content {
          font-size: 0.9rem;
          line-height: 1.6;
          color: var(--text-primary);
        }

        .analysis-content :global(.section-header) {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 24px 0 16px;
          padding: 14px 18px;
          background: color-mix(in srgb, var(--section-color) 12%, transparent);
          border-left: 5px solid var(--section-color);
          border-radius: 0 8px 8px 0;
        }
        .analysis-content :global(.section-header:first-child) { margin-top: 0; }
        .analysis-content :global(.section-emoji) { font-size: 1.3rem; }
        .analysis-content :global(.section-title) {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--section-color);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Metrics Grid */
        .analysis-content :global(.metrics-grid) {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 0 0 16px;
        }

        .analysis-content :global(.metric-card) {
          padding: 10px 14px;
          background: var(--bg-primary);
          border: 1px solid var(--border-primary);
          border-radius: 6px;
          font-size: 0.85rem;
        }
        .analysis-content :global(.metric-card.risk-high-card) {
          border-left: 3px solid #dc2626;
          background: #fef2f2;
        }
        .analysis-content :global(.metric-card.risk-medium-card) {
          border-left: 3px solid #f59e0b;
          background: #fffbeb;
        }

        /* Actions List */
        .analysis-content :global(.actions-list) {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 0 0 16px;
        }
        .analysis-content :global(.action-card) {
          padding: 14px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
        }
        .analysis-content :global(.action-main) {
          font-weight: 500;
          margin-bottom: 8px;
          font-size: 0.85rem;
        }
        .analysis-content :global(.action-meta) {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .analysis-content :global(.meta-item strong) {
          color: var(--text-tertiary);
        }
        .analysis-content :global(.action-impact) {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #bbf7d0;
          font-size: 0.8rem;
          color: #059669;
        }
        .analysis-content :global(.impact-label) {
          font-weight: 600;
        }

        /* Bullet List */
        .analysis-content :global(.bullet-list) {
          margin: 0 0 16px;
          padding: 0 0 0 20px;
          list-style: none;
        }
        .analysis-content :global(.bullet-list li) {
          position: relative;
          margin-bottom: 8px;
          padding-left: 12px;
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .analysis-content :global(.bullet-list li::before) {
          content: '';
          position: absolute;
          left: 0;
          top: 8px;
          width: 5px;
          height: 5px;
          background: var(--text-tertiary);
          border-radius: 50%;
        }
        .analysis-content :global(.bullet-list-nested) {
          margin: 6px 0 4px;
          padding: 0 0 0 16px;
          list-style: none;
        }
        .analysis-content :global(.bullet-list-nested li) {
          position: relative;
          margin-bottom: 4px;
          padding-left: 12px;
          font-size: 0.82rem;
          line-height: 1.4;
          color: var(--text-secondary);
        }
        .analysis-content :global(.bullet-list-nested li::before) {
          content: '';
          position: absolute;
          left: 0;
          top: 7px;
          width: 4px;
          height: 4px;
          border: 1px solid var(--text-tertiary);
          border-radius: 50%;
          background: transparent;
        }

        /* Numbered List */
        .analysis-content :global(.numbered-list) {
          margin: 0 0 16px;
          padding: 0 0 0 24px;
          list-style: decimal;
        }
        .analysis-content :global(.numbered-list li) {
          margin-bottom: 10px;
          padding-left: 8px;
          font-size: 0.85rem;
          line-height: 1.6;
        }
        .analysis-content :global(.numbered-list li::marker) {
          color: var(--accent-blue);
          font-weight: 600;
        }

        /* Summary Box */
        .analysis-content :global(.summary-box) {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .analysis-content :global(.summary-line) {
          font-size: 0.85rem;
          margin: 4px 0;
          color: #92400e;
        }

        /* Paragraph */
        .analysis-content :global(.content-para) {
          margin: 0 0 12px;
          font-size: 0.85rem;
          line-height: 1.6;
        }

        /* Inline formatting */
        .analysis-content :global(.badge-por) {
          display: inline-block;
          padding: 1px 6px;
          background: #22c55e;
          color: white;
          border-radius: 3px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .analysis-content :global(.badge-r360) {
          display: inline-block;
          padding: 1px 6px;
          background: #ef4444;
          color: white;
          border-radius: 3px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .analysis-content :global(.stage-badge) {
          display: inline-block;
          padding: 1px 6px;
          background: #e0e7ff;
          color: #4338ca;
          border-radius: 3px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .analysis-content :global(.risk-high) {
          display: inline-block;
          padding: 1px 6px;
          background: #fef2f2;
          color: #dc2626;
          border-radius: 3px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .analysis-content :global(.risk-medium) {
          display: inline-block;
          padding: 1px 6px;
          background: #fffbeb;
          color: #d97706;
          border-radius: 3px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .analysis-content :global(.risk-low) {
          display: inline-block;
          padding: 1px 6px;
          background: #f0fdf4;
          color: #16a34a;
          border-radius: 3px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .analysis-content :global(.text-green) { color: #16a34a; font-weight: 600; }
        .analysis-content :global(.text-red) { color: #dc2626; font-weight: 600; }
        .analysis-content :global(.text-amber) { color: #d97706; font-weight: 600; }
        .analysis-content :global(strong) { font-weight: 600; color: var(--text-primary); }
        .analysis-content :global(code) {
          background: var(--bg-tertiary);
          padding: 2px 5px;
          border-radius: 3px;
          font-size: 0.85em;
          font-family: ui-monospace, monospace;
        }

        /* Export views */
        .export-view { display: flex; flex-direction: column; gap: 10px; }
        .export-header { display: flex; align-items: center; justify-content: space-between; }
        .export-header span { font-size: 0.8rem; color: var(--text-secondary); }
        .export-preview {
          background: var(--bg-primary);
          border: 1px solid var(--border-primary);
          border-radius: 6px;
          padding: 14px;
          font-family: ui-monospace, monospace;
          font-size: 0.8rem;
          line-height: 1.5;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: var(--text-primary);
          max-height: 350px;
          overflow-y: auto;
          margin: 0;
        }

        .export-cta {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 30px 20px;
        }
        .export-cta h3 { margin: 0 0 6px; font-size: 1rem; color: var(--text-primary); }
        .export-cta p { margin: 0 0 16px; font-size: 0.875rem; color: var(--text-secondary); }

        /* Responsive */
        @media (max-width: 768px) {
          .ai-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .header-actions {
            width: 100%;
          }

          .btn {
            flex: 1;
            justify-content: center;
          }

          .filter-context {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .timestamp {
            margin-left: 0;
          }

          .view-tabs {
            margin-left: 0;
            width: 100%;
          }

          .panel-content {
            padding: 20px 16px;
          }
        }
      `}</style>
    </section>
  );
}
