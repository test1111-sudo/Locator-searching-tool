# PW-Locator // Playwright Locator Advisor

A free, no-account-needed tool that finds the best Playwright locators for any web element — ranked, explained, and with inline DevTools verification steps.

**No API key required for users.** You (the host) deploy the server once with your own key. Everyone else uses it for free with zero setup.

---

## How it works

```
User's browser  →  Your server (holds the API key)  →  Google Gemini API
```

The frontend (`index.html`) calls your backend (`server.js`). Your server holds the Gemini API key as an environment variable — users never see it and never need their own.

---

## Deploy in 5 minutes (Railway — recommended)

Railway gives you $5/month free credits — more than enough for this tool.

### Step 1 — Get a Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Open **Get API key**
4. Copy it — you'll need it in Step 3

### Step 2 — Deploy the server to Railway

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select this repo
4. Railway detects `package.json` and deploys automatically

### Step 3 — Set your API key

1. In Railway → open your project → **Variables**
2. Add variable: `GEMINI_API_KEY` = `AIza...your-key...`
3. Railway redeploys automatically

### Step 4 — Get your server URL

1. In Railway → **Settings → Networking → Generate Domain**
2. Copy the URL (e.g. `https://pw-locator.up.railway.app`)

### Step 5 — Update index.html with your server URL

Open `index.html` and find this line near the bottom:

```js
: 'https://YOUR-SERVER-URL-HERE.up.railway.app';
```

Replace it with your actual Railway URL:

```js
: 'https://pw-locator.up.railway.app';
```

Commit and push. Now share the GitHub Pages URL with anyone — they need nothing.

---

## Alternative: Render (also free)

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect this GitHub repo
3. Set **Start Command** to `node server.js`
4. Add environment variable: `GEMINI_API_KEY`
5. Deploy and copy your URL from the dashboard

> Note: Render's free tier sleeps after 15 min of inactivity. First request after sleep takes ~30s to wake up.

---

## Run locally

```bash
git clone https://github.com/test1111-sudo/Locator-searching-tool.git
cd Locator-searching-tool

export GEMINI_API_KEY=AIza...your-key...

node server.js
# [OK] PW-Locator server running on port 3000
```

Then open `index.html` in your browser — it auto-detects localhost and calls `http://localhost:3000`.

---

## API Reference

### `POST /locators`

```json
// Request
{ "url": "https://www.bbc.com/", "description": "the register button in the top nav" }

// Response
{
  "element_summary": "Register link in BBC top navigation",
  "locators": [
    {
      "type": "Role (getByRole)",
      "code": "page.getByRole('link', { name: 'Register' })",
      "quality": "best",
      "reason": "Semantic role — resilient to DOM changes"
    }
  ],
  "playwright_snippet": "const el = page.getByRole('link', { name: 'Register' });\nawait expect(el).toBeVisible();\nawait el.click();"
}
```

### `GET /health`
```json
{ "status": "online", "version": "3.2.0" }
```

---

## Locator quality tiers

| Badge | Meaning |
|---|---|
| `[RECOMMENDED]` | Semantic, resilient to DOM changes — always try this first |
| `[GOOD]` | Stable if the attribute exists — verify in DevTools |
| `[FRAGILE]` | May break on redesigns or build tool changes |
| `[AVOID]` | Last resort only — brittle and hard to maintain |
