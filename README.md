# ReplyMate — AI Email Agent

A standalone web app where customers sign in with their own Gmail and get AI-powered email replies.

---

## What it does
- Customers sign in with Google (their own Gmail)
- The app reads their unread emails
- Claude AI generates replies in their voice
- They approve and send — or enable auto-send

---

## Setup (Step by Step)

### Step 1 — Get your API keys

**Anthropic API key (powers the AI)**
1. Go to https://console.anthropic.com
2. Click "API Keys" → "Create Key"
3. Copy and save it

**Google OAuth credentials (for Gmail login)**
1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "ReplyMate")
3. Go to "APIs & Services" → "Enabled APIs" → Enable "Gmail API"
4. Go to "OAuth consent screen" → External → fill in app name + your email
5. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
6. Application type: Web application
7. Add Authorized redirect URI: `https://yourdomain.com/auth/callback`
   (Use `http://localhost:3000/auth/callback` for local testing)
8. Copy Client ID and Client Secret

---

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
```
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APP_URL=https://yourdomain.com
SESSION_SECRET=some-long-random-string-here
```

---

### Step 3 — Install and run locally

```bash
npm install
npm start
```

Open http://localhost:3000 — you should see the landing page.

---

### Step 4 — Deploy to the internet (Railway — easiest)

1. Go to https://railway.app and sign up (free)
2. Click "New Project" → "Deploy from GitHub repo"
3. Push your code to GitHub first, then connect it
4. In Railway, go to "Variables" and add all your `.env` values
5. Railway gives you a URL like `replymate.up.railway.app`
6. Update `APP_URL` in Railway variables to that URL
7. Update Google OAuth redirect URI to `https://replymate.up.railway.app/auth/callback`

**Alternative: Render.com**
1. Go to https://render.com → New Web Service
2. Connect your GitHub repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables
6. Deploy

---

## File Structure

```
replymate/
├── server.js          ← Main backend (Express + Gmail API + Claude)
├── package.json       ← Dependencies
├── .env.example       ← Environment variable template
├── .env               ← Your real secrets (never commit this!)
└── public/
    ├── index.html     ← Landing page (what customers see first)
    └── app.html       ← The email agent dashboard
```

---

## How to sell it

Each customer:
1. Visits your URL
2. Clicks "Connect Gmail"
3. Signs in with their Google account
4. Uses the agent immediately

You charge them via Paystack/Stripe before giving them the link, or add a payment wall inside the app.

---

## Pricing suggestion

| Plan | Price | What to offer |
|------|-------|---------------|
| Starter | $49 one-time | Access to the app |
| Pro | $99/month | Access + you personally tune their settings |
| Business | $299 | Custom branding + team setup |

---

## Need help?

Customizations you can request:
- Add Stripe/Paystack payment before users can access the app
- Add a database to store user preferences permanently
- Add email scheduling (check inbox every X hours automatically)
- White-label with your own branding
