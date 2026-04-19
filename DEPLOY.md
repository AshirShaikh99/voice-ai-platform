# Deployment guide — Netlify

Production checklist for taking this repo live. Follow top to bottom.

## 1. Pre-flight (local)

```bash
# Make sure everything builds and typechecks.
npx tsc --noEmit
npm run build
```

If `npm run build` succeeds locally you're clear to deploy.

## 2. Netlify: connect the repo

1. Push this repo to GitHub if you haven't already.
2. In Netlify: **Add new site → Import from Git → pick this repo.**
3. Build settings (Netlify auto-detects Next.js, but verify):
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
4. **Don't deploy yet** — set env vars first (step 3).

Netlify's built-in Next.js Runtime handles SSR, middleware (your `proxy.ts`), and route handlers automatically. No adapter config is needed.

## 3. Environment variables (Netlify → Site settings → Environment variables)

**Required for the app to boot:**

| Variable | Where to get it | Notes |
|---|---|---|
| `DATABASE_URL` | Neon dashboard → Connection Details | Use the **pooled** connection string |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys → Production | Switch Clerk to **production mode** before copying |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same Clerk page | Starts with `pk_live_…` in prod |
| `ULTRAVOX_API_KEY` | app.ultravox.ai → API Keys | |
| `PUBLIC_APP_URL` | Your Netlify URL | e.g. `https://voice.yourdomain.com` — **no trailing slash** |

**Required for webhooks and telephony:**

| Variable | Purpose |
|---|---|
| `ULTRAVOX_WEBHOOK_SECRET` | Set in Ultravox dashboard when you register your webhook (step 5). |
| `APP_ENCRYPTION_KEY` | Encrypts Twilio auth tokens at rest. Generate once: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

**Clerk URL overrides (usually not needed, but set these if sign-in redirects break):**

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

## 4. First deploy

1. Click **Deploy site** in Netlify.
2. Watch the build log. Typical failures:
   - Missing env var → bail, set it, retrigger.
   - `prisma generate` not running → Netlify runs `postinstall` automatically if your `package.json` has it. This repo doesn't — if your deploy errors with "Prisma Client not generated", add a build command override: `npx prisma generate && npm run build`.
3. After first successful deploy, visit the site, sign in, create a test agent, and start a browser test call. Confirm the call runs end-to-end.

## 5. Wire the webhooks (after deploy)

Your Netlify URL is now public. Point the external services at it.

### 5a. Ultravox → your webhook receiver

- Ultravox dashboard → Webhooks → Add endpoint
- URL: `https://YOUR_NETLIFY_URL/api/webhooks/ultravox`
- Events: `call.ended`, `call.billed`
- Copy the signing secret Ultravox gives you → paste into Netlify env as `ULTRAVOX_WEBHOOK_SECRET` → redeploy.

### 5b. Twilio → inbound voice webhooks

The app auto-registers Twilio voice webhooks **when you assign an agent to a number** in the Phone page. For that to work, `PUBLIC_APP_URL` must be set in Netlify env.

To verify: go to Twilio Console → Phone Numbers → pick a number. `Voice Configuration → A call comes in → Webhook` should show `https://YOUR_NETLIFY_URL/api/twilio/voice` after you assign an agent.

If it doesn't:
- Check that `PUBLIC_APP_URL` is set and has no trailing slash.
- Re-save the number's agent assignment to retrigger the Twilio API call.
- You can also set the webhook manually in the Twilio console as a fallback.

## 6. Post-deploy smoke tests

Run these in order. If any fail, don't call it shipped.

| Test | How | Expected |
|---|---|---|
| Sign in | Open site, sign in with Clerk | Lands on dashboard |
| Create agent | Agents → New | Agent published to Ultravox; draft visible |
| Browser test call | Open agent → Start test call | You hear the opening line; transcript captures turns |
| Summary auto-fills | End test call, wait 10s, refresh call review page | Summary appears without clicking "Check for summary" |
| Recording plays | Click the audio player on the call review page | Audio streams |
| Outbound phone call | Phone page → enter credentials → Import numbers → Dial your own number | Phone rings, agent talks |
| Inbound phone call | Assign an agent to a number, then call that number from your phone | Agent answers and converses |
| Knowledge base | Create KB → upload a PDF → attach to agent → ask agent a question from the PDF | Agent answers using the doc |
| Campaign | Create campaign → upload 2-row CSV → Start | Both numbers get dialed, targets mark COMPLETED when hung up |
| Outbound webhook | Register a webhook endpoint (e.g. webhook.site) → trigger a call | Your endpoint receives a signed POST within seconds |

## 7. Custom domain

- Netlify → Domain settings → Add custom domain
- Point DNS to Netlify
- After DNS propagates, **update `PUBLIC_APP_URL`** to the custom domain and redeploy
- Update Ultravox webhook URL to use the new domain
- Re-save inbound number agent assignments so Twilio voiceUrls update

## 8. Ongoing

- **Clerk dev vs prod keys:** when you switch Clerk from dev to prod mode, **existing users don't carry over**. Plan for that before demoing to clients.
- **Neon cold starts:** the free tier auto-sleeps idle compute. First request after idle can take 3-10s. Consider Neon's Autoscale Pro for consistent performance.
- **Twilio trial accounts** only call verified numbers. Upgrade to a paid Twilio account before real outbound.
- **Ultravox tier:** the Pay-As-You-Go tier caps at 5 concurrent calls. Upgrade to Pro ($100/mo) for unlimited concurrency before running big campaigns.

## 9. Reverting

If a deploy breaks prod, in Netlify → Deploys → pick a previous successful build → **Publish deploy**. Rollback is instant.
