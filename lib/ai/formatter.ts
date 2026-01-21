/**
 * AI Content Formatter
 * Uses a cheap model (GPT-4o-mini) to format raw AI analysis into structured output
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const FORMATTING_MODEL = 'gpt-4o-mini'; // Cheap and fast

export type OutputFormat = 'display' | 'html' | 'slack';
export type AnalysisType = 'bookings' | 'inbound';

interface FormatResult {
  formatted: string;
  format: OutputFormat;
  tokens_used?: number;
}

const FORMAT_PROMPTS: Record<OutputFormat, string> = {
  display: `You are a formatting assistant. Convert the raw analysis into clean, readable markdown for a web dashboard.

STRICT FORMATTING RULES:
- Use emoji headers: 📈 for summary, 🌎 for regional, 🇺🇸 🇬🇧 🇦🇺 for regions, ⚠️ for risks, ✅ for actions
- Use ### for main sections, #### for subsections
- Use nested bullet points with proper indentation:
  - Top level: "- **Bold label**: value"
  - Nested: "  - Sub-item details"
- NO numbered lists (1. 2. 3.) - use bullets only
- Keep content concise - one line per point
- Use **bold** for labels and emphasis

OUTPUT FORMAT:
### 📈 EXECUTIVE SUMMARY
[2-3 sentences]

### 🌎 REGIONAL ANALYSIS

#### 🇺🇸 AMER
- **Status**: [RAG] at [X]% attainment
- **Gap**: $[amount]
- **Risks**:
  - [Risk 1]
  - [Risk 2]
- **Actions**:
  - [Action] → Owner: [Role]

[Repeat for EMEA and APAC]

### ⚠️ RISK ASSESSMENT
- **Risk Level**: [HIGH/MEDIUM/LOW]
- **$ at Risk**: [amount]
- **Top Priorities**:
  - [Priority 1]
  - [Priority 2]`,

  html: `You are a formatting assistant. Convert the raw analysis into clean semantic HTML for a report.

STRICT FORMATTING RULES:
- Use semantic HTML: <section>, <h3>, <h4>, <ul>, <li>, <strong>
- Add data attributes for styling: data-status="green|yellow|red"
- Use emoji in headings: 📈 🌎 🇺🇸 🇬🇧 🇦🇺 ⚠️ ✅
- Nest lists properly with <ul><li><ul><li></li></ul></li></ul>
- NO inline styles - use classes only
- Add class names: section-summary, section-regional, region-amer, region-emea, region-apac, section-risks

OUTPUT FORMAT:
<section class="ai-report">
  <section class="section-summary">
    <h3>📈 Executive Summary</h3>
    <p>[Summary text]</p>
  </section>

  <section class="section-regional">
    <h3>🌎 Regional Analysis</h3>

    <div class="region-amer">
      <h4>🇺🇸 AMER</h4>
      <ul>
        <li><strong>Status:</strong> <span data-status="yellow">YELLOW</span> at X%</li>
        <li><strong>Gap:</strong> $X</li>
        <li><strong>Risks:</strong>
          <ul>
            <li>[Risk item]</li>
          </ul>
        </li>
      </ul>
    </div>

    [Repeat for other regions]
  </section>

  <section class="section-risks">
    <h3>⚠️ Risk Assessment</h3>
    <ul>
      <li><strong>Risk Level:</strong> [HIGH/MEDIUM/LOW]</li>
      <li><strong>$ at Risk:</strong> [amount]</li>
    </ul>
  </section>
</section>`,

  slack: `You are a formatting assistant. Convert the raw analysis into Slack mrkdwn format.

STRICT FORMATTING RULES:
- Use Slack mrkdwn: *bold*, _italic_, \`code\`
- Use emoji: :chart_with_upwards_trend: :earth_americas: :flag-us: :flag-gb: :flag-au: :warning: :white_check_mark:
- NO markdown headers (# ## ###) - Slack doesn't support them
- Use *bold text* for section titles on their own line
- Use bullet points with • (not -)
- Keep each line under 100 chars for mobile readability
- Add blank lines between sections

OUTPUT FORMAT:
:chart_with_upwards_trend: *EXECUTIVE SUMMARY*
[2-3 sentences]

:earth_americas: *REGIONAL ANALYSIS*

:flag-us: *AMER*
• *Status:* YELLOW at X%
• *Gap:* $X
• *Risks:*
    • [Risk 1]
    • [Risk 2]
• *Actions:*
    • [Action] → Owner: [Role]

:flag-gb: *EMEA*
[Same format]

:flag-au: *APAC*
[Same format]

:warning: *RISK ASSESSMENT*
• *Risk Level:* HIGH/MEDIUM/LOW
• *$ at Risk:* [amount]
• *Top Priorities:*
    • [Priority 1]
    • [Priority 2]`
};

/**
 * Format raw AI analysis using a cheap model
 */
export async function formatAnalysis(
  rawAnalysis: string,
  format: OutputFormat,
  apiKey: string
): Promise<FormatResult> {
  const formatPrompt = FORMAT_PROMPTS[format];

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: FORMATTING_MODEL,
      messages: [
        {
          role: 'system',
          content: formatPrompt
        },
        {
          role: 'user',
          content: `Format this analysis:\n\n${rawAnalysis}`
        }
      ],
      temperature: 0.3, // Low temperature for consistent formatting
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Formatting failed: ${response.status}`);
  }

  const data = await response.json();
  const formatted = data.choices?.[0]?.message?.content || rawAnalysis;

  return {
    formatted,
    format,
    tokens_used: data.usage?.total_tokens,
  };
}

/**
 * Format analysis into multiple formats in parallel
 */
export async function formatAnalysisMultiple(
  rawAnalysis: string,
  formats: OutputFormat[],
  apiKey: string
): Promise<Record<OutputFormat, string>> {
  const results = await Promise.all(
    formats.map(format => formatAnalysis(rawAnalysis, format, apiKey))
  );

  const output: Record<string, string> = {};
  for (const result of results) {
    output[result.format] = result.formatted;
  }

  return output as Record<OutputFormat, string>;
}
