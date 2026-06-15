# 24/7 Leadership AI — Agent Hub

An internal, login-only AI agent hub for the 24/7 Education team. Team members
sign in and reach a set of AI agents gated by their role and clearance, chat
with them (with dictation and read-aloud), upload documents, and route uploads
and corrections through a human-led **knowledge review** queue.

> Human Led, AI Facilitated.

Built from the `Agent Hub` design prototype as **React + Vite + Supabase**.

## Screens

- **Login** — gated entry (email/password + Google SSO), anchored by the mission
  line "Learn, Create, and Change the World!"
- **Directory** — Rebecca-AI as the flagship, specialist agents you're cleared
  for, and a greyed "Expanding Access" row for agents that are locked or coming soon.
- **Chat** — per-agent threads with a recent-conversation sidebar, clearance
  badge, copy / flag-or-correct / listen actions, file attachments, and dictation.
- **Knowledge review** — the governance queue where uploaded documents and
  flagged corrections wait for a reviewer to Approve or Decline.

## Stack

| Concern | Tech |
| --- | --- |
| UI | React 18 + Vite |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Data | Supabase Postgres (`profiles`, `agents`, `conversations`, `messages`, `attachments`, `review_items`) |
| Access control | Row Level Security — the clearance model is enforced in the database, not just the UI |
| Uploads | Supabase Storage (private `uploads` bucket, foldered per user) |
| TTS / STT | Browser `SpeechSynthesis` + `SpeechRecognition` (real, no external service) |
| Agent replies | **Stubbed** — see `src/lib/agentReply.js` |

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Environment is preconfigured in `.env` (Supabase URL + publishable key). These
are client-side keys designed to ship in the browser; the security boundary is
Row Level Security, not key secrecy. For a fresh Supabase project, copy
`.env.example` and fill in your own values.

```bash
npm run build    # production build to dist/
npm run preview  # serve the production build
```

## Database

The schema lives in `supabase/migrations/` and is already applied to the linked
project. Re-apply to a new project with the Supabase CLI (`supabase db push`) or
by running the SQL files in order in the SQL Editor.

### Clearance model

Each member has a `clearances` array; each agent has a `required_clearance`
(`all` = open). A member can access an agent when the agent is `active` and its
clearance is `all` or present in the member's `clearances`. This is enforced by
the `conversations` insert policy via `user_can_access_agent()`, so the gate
holds even outside the UI.

> **Demo default:** new signups are granted `['leadership','build','academic']`
> clearance and reviewer access (see `handle_new_user`) so the hub is fully
> explorable out of the box. Tighten this for a real rollout — assign clearances
> per role during onboarding.

## Wiring real agent responses

`src/lib/agentReply.js` returns on-brand placeholders today. For production,
route the call through a Supabase Edge Function (or your backend) that
authenticates the member, retrieves only the knowledge their clearance allows,
calls the Claude API server-side (recommended: `claude-opus-4-8`, or
`claude-sonnet-4-6` for lower cost), and returns the grounded answer. The keys
must never live in the browser bundle.

## Notes / next steps

- **Google SSO** requires enabling the Google provider in Supabase Auth and
  adding this origin to the allowed redirect URLs.
- **Email confirmation** is on by default; password sign-ups must confirm via
  email before the session activates.
- Dictation uses the Web Speech API (best support in Chrome/Edge); the mic
  control hides itself where the API is unavailable.
