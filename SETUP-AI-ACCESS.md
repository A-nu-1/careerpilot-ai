# CareerPilot AI Access — setup

## Local `.env.local` (do not commit)

```
GEMINI_API_KEY=your_existing_personal_gemini_key
CAREERPILOT_OWNER_PASSWORD=choose-a-strong-unique-password
CAREERPILOT_SESSION_SECRET=generate-a-random-64-character-hex-secret
```

In PowerShell generate a session secret (one command):

```
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Restart `npm run dev`. Sign in from **AI Access** above the dashboard. Your key is never entered in the browser; a signed HttpOnly cookie lasts 7 days. The password and session secret exist only as server environment variables. Your saved CV data still lives in localStorage for that browser/origin.

## On Vercel

Configure the SAME three environment variables under Project Settings > Environment Variables; redeploy. Do not put them in `NEXT_PUBLIC_` variables. Do not commit `.env.local`. Use HTTPS (Vercel defaults).

## Visitors

Visitors may enter a Gemini API key in the AI Access panel. It remains only in JavaScript memory until refresh and is included on AI requests to our Next.js server via HTTPS; the server uses it transiently and does not intentionally log or store it. There is no visitor account system. Visitor usage may be subject to Google Gemini quotas and policies. If the visitor key is invalid, generation fails without ever using the owner key.

## Security limitations

- **Important:** This is a personal/portfolio-oriented first version, not comprehensive production hardening. Owner password login does not yet have persistent distributed brute-force protection or CAPTCHA. Before promoting the public link, add an external rate limiter/bot protection, especially for `/api/auth/login` and expensive AI routes (also using BYOK). Do not claim that IP or in-memory limits suffice on serverless platforms.
- Cookie is signed and HttpOnly, expires in 7 days; logging out deletes it in the browser, but the server does not maintain a session revocation list. Rotating `CAREERPILOT_SESSION_SECRET` invalidates all cookies.
- No CV records are uploaded to CareerPilot storage; their content is sent to Google Gemini only on AI requests. Browser localStorage is not encrypted and isn't automatically synchronized across `localhost` and Vercel URLs.
- Browser extensions and injected scripts can still read a visitor key while present in JS memory. Users should avoid entering sensitive data into untrusted websites.
- Our AI routes implement validation and simple payload checks but distributed AI cost-limits/rate limits should be added before a public demo launch.
- Never use a server key merely because visitor key is missing. `resolveAiKey` enforces this.

## Checks

1. `npm run lint` and `npm run build`.
2. While signed out and no visitor key entered, calling any AI action should show a sign-in/BYOK error.
3. Sign in and test analyse, prepare, and agent. Refresh: remains signed in.
4. Sign out, enter a visitor key, test all three actions. Refresh: visitor key is forgotten.
5. Sign out and verify no visitor key: calls fail without spending your quota.
6. Ensure `.env.local` is not added to git.
