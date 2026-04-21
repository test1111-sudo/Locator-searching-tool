const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

if (!ANTHROPIC_API_KEY) {
  console.warn('[WARN] ANTHROPIC_API_KEY not set — set it as an environment variable');
}

// ── CORS headers ──
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Call Anthropic ──
function callAnthropic(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = parsed.content.map(b => b.text || '').join('');
          resolve(text);
        } catch (e) {
          reject(new Error('Failed to parse Anthropic response'));
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

        if (!ANTHROPIC_API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Server API key not configured — set ANTHROPIC_API_KEY env variable' }));
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

        const raw = await callAnthropic(prompt);
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
  console.log(`[OK] API key: ${ANTHROPIC_API_KEY ? 'configured' : 'MISSING — set ANTHROPIC_API_KEY'}`);
});
