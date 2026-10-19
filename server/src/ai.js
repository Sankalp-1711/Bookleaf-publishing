import { BOOKLEAF_KNOWLEDGE } from './policy.js';

const categories = ['ROYALTY', 'ISBN', 'PRINTING', 'DISTRIBUTION', 'PRODUCTION', 'GENERAL'];
const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const retryableStatuses = new Set([429, 500, 502, 503, 504]);
const retryDelays = [400, 1000];
let warnedMissingKey = false;
const fallback = (subject, description) => {
  const text = `${subject} ${description}`.toLowerCase();
  const category = /royalt|payment|payout|money|earning/.test(text) ? 'ROYALTY' : /isbn|metadata/.test(text) ? 'ISBN' : /print|binding|misprint|quality|color/.test(text) ? 'PRINTING' : /unavailable|listing|distribution|amazon|flipkart|stock/.test(text) ? 'DISTRIBUTION' : /stage|production|proof|cover|typeset|editing/.test(text) ? 'PRODUCTION' : 'GENERAL';
  const priority = /duplicate isbn|wrong isbn|not received.*royalt|6 months|defect|misprint|urgent|critical|overdue/.test(text) ? 'HIGH' : 'MEDIUM';
  const guidance = {
    ROYALTY: 'Royalties are calculated quarterly and paid within 45 days of quarter end, once the ₹1,000 minimum threshold is met. We’ll check your detailed sales and payout status before confirming the next step.',
    PRINTING: 'Our standard print turnaround is 5–7 business days after order confirmation. For a verified print-quality issue, we arrange a free reprint; photos of the affected copy can help our production team verify it.',
    DISTRIBUTION: 'Listings generally go live within 7–10 business days after publication. If a live listing is unavailable, our team can request a stock re-sync, typically within 24–48 hours.',
    ISBN: 'We treat ISBN mismatches as high priority and escalate them to our production team for verification.',
    PRODUCTION: 'A member of our team will review the production stage and follow up with the next steps.',
    GENERAL: 'A member of our team will review your query and follow up with the next steps.'
  };

  return {
    category,
    priority,
    aiUsed: false,
    draft: `Hi there,\n\nThank you for reaching out, and I’m sorry this has been a concern. We’ve received your query about “${subject}” and our team will review the details against your account and BookLeaf’s policies.\n\n${guidance[category]}\n\nWe’ll investigate and get back to you within 48 hours. If you have any relevant screenshots or photos, please reply with them so we can include them in the review.\n\nWarm regards,\nBookLeaf Author Support`
  };
};

export const isAiConfigured = () => Boolean(process.env.GEMINI_API_KEY?.trim());

function parseResult(text) {
  const data = JSON.parse(text);
  if (!categories.includes(data.category) || !priorities.includes(data.priority) || typeof data.draft !== 'string' || !data.draft.trim()) return null;
  return { category: data.category, priority: data.priority, draft: data.draft.trim(), aiUsed: true };
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function responseErrorDetails(response, apiKey) {
  try {
    const body = await response.json();
    const error = body.error;
    const details = [error?.status, error?.message].filter(Boolean).join(': ');
    return details.replaceAll(apiKey, '[redacted]').replace(/\s+/g, ' ').slice(0, 240);
  } catch {
    return '';
  }
}

export async function triage(subject, description) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn('[AI] GEMINI_API_KEY is not configured; using rule-based fallback drafts.');
      warnedMissingKey = true;
    }
    return fallback(subject, description);
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `You are a skilled, empathetic BookLeaf Publishing author-support representative. Write a fresh response for the specific author query; do not copy a template or produce generic AI filler.

Instructions:
- Read the ticket subject and message carefully. Directly answer the author's actual question and acknowledge the specific concern in a natural, warm, professional voice.
- Apply only the relevant facts from the BookLeaf policies below. Do not include unrelated policy details.
- Never claim you checked an account, sales record, payout, shipment, or production status; those facts are not provided.
- Do not invent names, dates, causes, decisions, completed actions, or guarantees. Explain what the team can verify and give a clear next step.
- Mention a 48-hour investigation timeline only when it is useful; do not add it as boilerplate.
- Keep the response concise (usually 2–4 short paragraphs), ready to send, and signed “BookLeaf Author Support”.
- Classify into exactly one category: ${categories.join(', ')}. Select exactly one priority: ${priorities.join(', ')}. Prioritize time-sensitive financial issues, significant defects, and urgent production/distribution blockers over routine requests.
- Return only a JSON object with exactly these fields: category, priority, draft. The draft must be plain text, not markdown or JSON.

BOOKLEAF POLICIES:
${BOOKLEAF_KNOWLEDGE}`
            }]
          },
          contents: [{
            role: 'user',
            parts: [{ text: `Subject: ${subject}\nQuery: ${description}` }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 650,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                category: { type: 'STRING', enum: categories },
                priority: { type: 'STRING', enum: priorities },
                draft: { type: 'STRING' }
              },
              required: ['category', 'priority', 'draft'],
              propertyOrdering: ['category', 'priority', 'draft']
            }
          }
        })
      });
    } catch (error) {
      if (attempt < retryDelays.length) {
        await delay(retryDelays[attempt]);
        continue;
      }
      console.warn(`[AI] Gemini request failed using model "${model}" (${error.name}); using fallback draft.`);
      return fallback(subject, description);
    }

    if (!response.ok) {
      if (retryableStatuses.has(response.status) && attempt < retryDelays.length) {
        await response.body?.cancel();
        await delay(retryDelays[attempt]);
        continue;
      }
      const details = await responseErrorDetails(response, apiKey);
      console.warn(`[AI] Gemini request failed with HTTP ${response.status}${details ? ` (${details})` : ''} using model "${model}"; using fallback draft.`);
      return fallback(subject, description);
    }

    try {
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
      if (!text) {
        console.warn(`[AI] Gemini returned no draft text using model "${model}"; using fallback draft.`);
        return fallback(subject, description);
      }
      const parsed = parseResult(text);
      if (!parsed) {
        console.warn(`[AI] Gemini returned an invalid structured draft using model "${model}"; using fallback draft.`);
        return fallback(subject, description);
      }
      return parsed;
    } catch (error) {
      console.warn(`[AI] Could not parse Gemini response using model "${model}" (${error.name}); using fallback draft.`);
      return fallback(subject, description);
    }
  }

  return fallback(subject, description);
}
