# Sync & Style — Product Notes

## Problem statement
> From the GitHub repo `ahmadsuhail420-web/syncandstyle`, improve the non-index pages so they match the index page's design language. Specifically the user flagged **Login** and **Dashboard** as pages they were unhappy with. User also asked to add a **Google login** option. Final output will be pushed to GitHub.

## Architecture (unchanged)
- Static site served from `public/` on Vercel
- Supabase for auth & data (`/api/config` exposes the anon key)
- Razorpay on `/api/create-razorpay-order` + `/api/verify-razorpay-payment`
- Notion mirror for RSVPs (`/api/submit-rsvp`)
- Local preview: tiny Express server at `/app/frontend/serve-static.js` replicating Vercel rewrites and stubbing `/api/config`.

## Design system (new)
New shared assets under `public/css/`:
- `shared.css` — CSS variables (ivory / rose-deep / gold), `ss-navbar`, `ss-card`, `ss-btn-*`, `ss-input`, `ss-label`, `ss-title`, `ss-gold-rule`, footer, reveal animations, etc.
- `shared.js` — injects the dark unified footer into any page with `<div id="ss-footer-slot"></div>`, + IntersectionObserver reveal.

Fonts: **Cormorant Garamond (display)** · **DM Sans (body)** · **Cinzel (eyebrows)** — matching `index.html`.

## What's been implemented (Jan 2026)
### Pages fully redesigned to match `index.html`:
- **login.html** — split-screen layout (form on left, quote/stats aside on right), elegant serif titles, new inputs/buttons, inline errors, mobile-stacked layout.
- **dashboard.html** — greet header with eyebrow + italic name, pill-tab navigator, card grid for templates (empty-state + skeletons), styled tables for RSVPs and guest invitations, toast system, add-guest form.
- **contact-us.html** — hero + two info cards (email, response time) + "help band" CTA card.
- **terms-and-conditions.html**, **privacy-policy.html**, **cancellation-and-refund.html**, **shipping-and-exchange.html** — unified policy layout with "last updated" pill, gold rule and ivory content card.
- **templates.html** — navbar, header, fonts refreshed. Gallery cards left intact (already on-brand). Old footer removed in favour of shared dark footer.

### New integration:
- **Google login** added to `login.html` (both Sign-in and Sign-up panels). Uses Supabase's native `supabase.auth.signInWithOAuth({ provider: 'google' })`. Handles `redirectTo` so after Google returns the user lands back on `/dashboard` (or the `?redirect=` query param).

### Setup required on the user side (before Google login works in production):
1. **Supabase Dashboard** → Authentication → Providers → enable **Google** and paste a Google OAuth `Client ID` + `Client Secret`.
2. **Google Cloud Console** → OAuth consent screen + Credentials → create a **Web application** OAuth client with authorized redirect URI:
   `https://<YOUR-SUPABASE-PROJECT>.supabase.co/auth/v1/callback`
3. Add `https://syncandstyle.com` (and the Vercel preview URLs) to Supabase → Authentication → URL Configuration → Redirect URLs.

### Not touched (intentional):
- `payment.html` — already uses the same Cormorant + DM Sans + ivory/rose palette; no visual drift.
- `admin-dashboard.html` — admin-only internal tool (2153 lines), out of scope for "match index".
- `wedding/*` and `edit/*` templates — these are the actual invitation templates, unrelated to site chrome.

## Next action items
1. User runs the 3-step Google OAuth setup above in Supabase + Google Cloud, then tests `Continue with Google` on `/login`.
2. User clicks the **Save to GitHub** button in the chat input to push the changes back to `ahmadsuhail420-web/syncandstyle`.

## Prioritised backlog / future
- P1: Restyle `admin-dashboard.html` if the team wants admin UI to match.
- P2: Add a subtle mobile hamburger menu to `ss-navbar` so long nav lists collapse nicely below 480px.
- P2: Add a simple contact form (name + email + message) on `contact-us.html` that posts to `/api/submit-rsvp` or a new `/api/contact` endpoint.
