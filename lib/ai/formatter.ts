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
  display: `You are a formatting assistant. Reformat the raw analysis into clean markdown with proper hierarchy.

HEADER HIERARCHY (NO BULLETS ON HEADERS):
### 📈 EXECUTIVE SUMMARY
[paragraph text, no bullets]

### 🌎 REGIONAL ANALYSIS

#### 🇺🇸 AMER
- **Status:** 🟡 YELLOW at 89%
- **Gap:** 🔴 -$97,210
- **Key Risks:**
  ◦ First risk item here
  ◦ Second risk item here
- **Root Cause:** Description here
- **Actions:**
  ◦ First action item
  ◦ Second action item

#### 🇬🇧 EMEA
[same structure]

#### 🇦🇺 APAC
[same structure]

### ⚠️ RISK ASSESSMENT
- **Q1 Outlook:** 🟡 MEDIUM risk
- **$ at Risk:** 🔴 -$250,000
- **Top Priorities:**
  ◦ Priority 1
  ◦ Priority 2
  ◦ Priority 3

CRITICAL RULES:
1. HEADERS (###, ####) must NOT have bullets - they stand alone on their own line
2. Use "-" for top-level bullets under a header
3. Use "◦" (open circle) with 2-space indent for nested sub-items
4. Executive Summary should be paragraph text, NOT bullets
5. Region names (AMER, EMEA, APAC) are #### headers, NOT bulleted items

COLOR CODING:
- Attainment >=100%: 🟢 (green)
- Attainment 80-99%: 🟡 (yellow)
- Attainment <80%: 🔴 (red)
- Negative gaps: 🔴 prefix
- Positive gaps: 🟢 prefix
- HIGH risk: 🔴, MEDIUM risk: 🟡, LOW risk: 🟢

Output the reformatted markdown only, no explanations.`,

  html: `You are a formatting assistant. Convert the raw analysis into semantic HTML.

CRITICAL: REMOVE ALL NUMBERED SECTIONS. Convert "1. EXECUTIVE SUMMARY" to "<h3>📈 Executive Summary</h3>" (no numbers).

TRANSFORMATIONS:
- "1. EXECUTIVE SUMMARY" → <h3>📈 Executive Summary</h3>
- "2. REGIONAL ANALYSIS" → <h3>🌎 Regional Analysis</h3>
- "3. GLOBAL RISK" → <h3>⚠️ Risk Assessment</h3>
- "AMER" → <h4>🇺🇸 AMER</h4>
- "EMEA" → <h4>🇬🇧 EMEA</h4>
- "APAC" → <h4>🇦🇺 APAC</h4>

HTML STRUCTURE:
<section class="ai-report">
  <section class="section-summary">
    <h3>📈 Executive Summary</h3>
    <p>[content]</p>
  </section>
  <section class="section-regional">
    <h3>🌎 Regional Analysis</h3>
    <div class="region-amer">
      <h4>🇺🇸 AMER</h4>
      <ul>
        <li><strong>Status:</strong> <span data-status="yellow">YELLOW</span> at X%</li>
        <li><strong>Risks:</strong>
          <ul><li>[risk]</li></ul>
        </li>
      </ul>
    </div>
  </section>
  <section class="section-risks">
    <h3>⚠️ Risk Assessment</h3>
    <ul><li><strong>Risk Level:</strong> HIGH/MEDIUM/LOW</li></ul>
  </section>
</section>

RULES:
- NO numbered sections (remove 1., 2., 3.)
- Convert all numbered lists to <ul><li>
- Use data-status="green|yellow|red" for status spans
- Output HTML only, no explanations`,

  slack: `You are a formatting assistant. Convert the raw analysis into Slack mrkdwn format.

CRITICAL: REMOVE ALL NUMBERED SECTIONS. Convert "1. EXECUTIVE SUMMARY" to ":chart_with_upwards_trend: *EXECUTIVE SUMMARY*" (no numbers).

TRANSFORMATIONS:
- "1. EXECUTIVE SUMMARY" → :chart_with_upwards_trend: *EXECUTIVE SUMMARY*
- "2. REGIONAL ANALYSIS" → :earth_americas: *REGIONAL ANALYSIS*
- "3. GLOBAL RISK" → :warning: *RISK ASSESSMENT*
- "AMER" → :flag-us: *AMER*
- "EMEA" → :flag-gb: *EMEA*
- "APAC" → :flag-au: *APAC*
- "ACTION ITEMS" → :white_check_mark: *ACTION ITEMS*

SLACK FORMAT:
:chart_with_upwards_trend: *EXECUTIVE SUMMARY*
[2-3 sentences]

:earth_americas: *REGIONAL ANALYSIS*

:flag-us: *AMER*
• *Status:* YELLOW at X%
• *Gap:* $X
• *Risks:*
    • [Risk 1]
• *Actions:*
    • [Action] → Owner: [Role]

:flag-gb: *EMEA*
[Same structure]

:flag-au: *APAC*
[Same structure]

:warning: *RISK ASSESSMENT*
• *Risk Level:* HIGH/MEDIUM/LOW
• *$ at Risk:* [amount]

RULES:
- NO numbered sections (1., 2., 3.) - remove them entirely
- Convert numbered lists to bullets (•)
- Use Slack emoji codes (:emoji:) not Unicode
- Keep lines under 100 chars
- Output Slack mrkdwn only, no explanations`
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
      temperature: 0.1, // Very low temperature for consistent formatting
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
