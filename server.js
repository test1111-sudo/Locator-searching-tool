const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

if (!GEMINI_API_KEY) {
  console.warn('[WARN] GEMINI_API_KEY not set — set it as an environment variable');
}

// ── CORS headers ──
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Call Gemini ──
function callGemini(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            element_summary: { type: 'string' },
            locators: {
              type: 'array',
              minItems: 5,
              maxItems: 7,
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  code: { type: 'string' },
                  quality: { type: 'string', enum: ['best', 'good', 'fragile', 'avoid'] },
                  reason: { type: 'string' }
                },
                required: ['type', 'code', 'quality', 'reason']
              }
            },
            playwright_snippet: { type: 'string' }
          },
          required: ['element_summary', 'locators', 'playwright_snippet']
        }
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(parsed.error.message || 'Gemini API request failed'));
          }

          const text = (parsed.candidates || [])
            .flatMap(candidate => (((candidate || {}).content || {}).parts || []))
            .map(part => part && part.text ? part.text : '')
            .join('')
            .trim();

          if (!text) {
            return reject(new Error('Gemini returned no text content'));
          }

          resolve(text);
        } catch (e) {
          reject(new Error('Failed to parse Gemini response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Server ──
const server = http.createServer(async (req, res) => {
  setCORS(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'online', version: '3.1.0' }));
    return;
  }

  // Locator endpoint
  if (req.method === 'POST' && req.url === '/locators') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { url, description } = JSON.parse(body);

        if (!url || !description) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'url and description are required' }));
          return;
        }

        if (!GEMINI_API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Server API key not configured — set GEMINI_API_KEY env variable' }));
          return;
        }

        const prompt = `You are a Playwright automation expert. A user wants locators for an element on a webpage.

Page URL: ${url}
Element description: "${description}"

Using your knowledge of this website and common web patterns, generate realistic and accurate Playwright locators for this element.

Respond ONLY with a valid JSON object. No markdown, no explanation, no text outside the JSON:
{
  "element_summary": "one-line description of the element",
  "locators": [
    {
      "type": "Role (getByRole)",
      "code": "page.getByRole('link', { name: 'Register' })",
      "quality": "best",
      "reason": "Why this locator is reliable"
    }
  ],
  "playwright_snippet": "const el = page.getByRole('link', { name: 'Register' });\nawait expect(el).toBeVisible();\nawait el.click();"
}

Quality must be one of: best, good, fragile, avoid.
Provide 5-7 locators sorted best to worst: getByRole, getByText, getByLabel/getByPlaceholder if relevant, CSS with id or data-testid, CSS class-based, XPath.
All codes must be valid Playwright syntax.`;

        const raw = await callGemini(prompt);
        const clean = raw.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
        const result = JSON.parse(clean);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));

      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`[OK] PW-Locator server running on port ${PORT}`);
  console.log(`[OK] API key: ${GEMINI_API_KEY ? 'configured' : 'MISSING — set GEMINI_API_KEY'}`);
  console.log(`[OK] Model: ${GEMINI_MODEL}`);
});
