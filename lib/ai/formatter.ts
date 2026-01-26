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
  display: `You are a formatting assistant. Your ONLY job is to reformat the user's raw analysis text into clean markdown. PRESERVE ALL CONTENT from the input - do not summarize, shorten, remove, or invent any data. Every number, percentage, dollar amount, and observation from the input MUST appear in your output. NEVER output placeholder text.

FORMAT RULES:
1. Each major section from the input becomes a ### header with an appropriate emoji
2. Sub-sections or regional breakdowns become #### headers
3. Use "-" for top-level bullet points
4. Use "◦" with 2-space indent for nested sub-items
5. Bold key labels: **Status:**, **Gap:**, **Risk:**, etc.
6. Executive Summary should be paragraph text, not bullets
7. HEADERS (### and ####) must NOT have bullet prefixes

COLOR CODING (add emoji prefixes based on values in the text):
- Attainment >=100%: prefix with 🟢
- Attainment 80-99%: prefix with 🟡
- Attainment <80%: prefix with 🔴
- Negative gaps/shortfalls: prefix with 🔴
- Positive surplus: prefix with 🟢
- HIGH risk: 🔴, MEDIUM risk: 🟡, LOW risk: 🟢

SECTION EMOJIS (use these for ### headers based on content):
- Executive/Summary: 📈
- Lead/Volume/MQL: 📊
- Funnel/Conversion: 🔄
- Velocity/Stall: ⏱️
- Channel/Campaign: 📣
- Google Ads: 💰
- Revenue/Attribution: 💵
- Pipeline/Risk: ⚠️
- Win/Loss: 📉
- Predictive/Forecast: 🔮
- Recommendations/Actions: ✅
- Regional headers (AMER/EMEA/APAC): use 🇺🇸/🇬🇧/🇦🇺

CRITICAL: Output ONLY the reformatted markdown from the input text. Never invent data or use placeholder values. If the input has 9 sections, output 9 sections. Preserve ALL detail.`,

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
      max_tokens: 4096,
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
