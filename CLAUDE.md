# CLAUDE.md — review-manager

## Quick Reference

- **What it is:** A web app for tracking **code reviews** (not product/customer reviews). Teams create review "rooms", add review items (PR title + link + assignees), track status (active/done/deleted), and ping reviewers via Google Chat. Standalone personal repo (`yahyasahaja/review-manager`) — NOT part of the LapakGaming e-commerce platform, no dependency on org services.
- **Language/runtime:** TypeScript (strict), Node 20.
- **Framework:** Next.js 16.0.3 (App Router) + React 19.
- **Styling:** Tailwind CSS 4 (glass-morphism UI).
- **Datastore:** Firebase Firestore (client SDK, real-time `onSnapshot`).
- **Auth:** Firebase Auth (Google OAuth). OAuth access token kept in `sessionStorage` for Google Chat API calls.
- **External:** Google Chat webhooks (notifications) + Chat API (fetch space members, Workspace-only).
- **Deploy:** Netlify (`@netlify/plugin-nextjs`). Firebase project hosts Firestore only.
- **Key deps:** `firebase`, `@headlessui/react`, `@heroicons/react`, `clsx`, `tailwind-merge`.

## Essential Commands

```bash
npm install          # install deps
npm run dev          # dev server at http://localhost:3000
npm run build        # production build (next build)
npm run start        # serve the production build
npm run lint         # eslint (flat config, eslint-config-next)
```

There is no test suite (no test script, no test runner configured). Type-checking runs as part of `next build`.

Firebase deploy commands (require firebase CLI + approval — see Safety):
```bash
firebase deploy --only firestore:rules     # deploy firestore.rules
firebase deploy --only firestore:indexes   # deploy firestore.indexes.json
```

## Architecture / Structure

App Router app; all source under `src/` (path alias `@/* -> src/*`). ~4k LOC.

- `src/app/` — routes & pages.
  - `page.tsx` — home: login, create/enter room.
  - `[slug]/page.tsx` — room detail; the main screen (review lists, actions). Sections: created >24h ago, stale (no update >24h), all active.
  - `api/notify/route.ts` — `POST`, sends a Google Chat message via the room webhook.
  - `api/google-chat/members/route.ts` — `POST`, fetches Chat space members (needs OAuth token + Workspace).
  - `privacy-policy/page.tsx`, `layout.tsx`, `globals.css`, `favicon.ico`.
- `src/components/` — `AddReviewForm`, `ReviewItem` (per-card actions + role logic), `RoomSettings`; `ui/` has `GlassButton`/`GlassCard`/`GlassInput` (reusable base).
- `src/context/AuthContext.tsx` — `useAuth()`: `signInWithGoogle`, `logout`, `getAccessToken` (OAuth), `getIdToken`.
- `src/lib/` — `firebase.ts` (init; `db` may be null if keys missing), `db.ts` (all Firestore ops), `googleChat.ts` (webhook + mentions), `utils.ts`.

Firestore collections: `rooms` (doc id = slug) and `reviews`. Two composite indexes on `reviews`: `(roomId, status, createdAt desc)` and `(roomId, status, updatedAt asc)`.

## Key Files

- `src/lib/db.ts` — single source of truth for data access & domain models (`Room`, `Review`). All mutations go through exported async fns: `createRoom`, `getRoom`, `getUserRooms`, `updateRoom`, `addReview`, `getReviews`, `updateReviewStatus`, `markReviewAsUpdated`, `markAsReviewed`, `markAsApproved`, `updateReviewAssignees`, `removeReviewer`.
- `src/lib/firebase.ts` — Firebase init from `NEXT_PUBLIC_FIREBASE_*` env vars.
- `firestore.rules` — auth-gated; rooms keyed by slug; rules check `allowedUserEmails` (lowercased helper array) + `createdBy`. Most fine-grained access (who can mark reviewed/approved) is enforced in app code, not rules.
- `firestore.indexes.json`, `firebase.json`, `netlify.toml`, `next.config.ts`, `eslint.config.mjs`, `env.example`.
- Docs: `README.md`, `OAUTH_SETUP.md`, `NETLIFY_DEPLOY.md`, `contexts/PROJECT_CONTEXT.md`, `contexts/DEVELOPMENT_GUIDE.md`. Note: PROJECT_CONTEXT.md slightly predates the code — trust `db.ts` (e.g. reviews now carry `reviewedBy`/`approvedBy` string arrays; rooms carry `allowedUserEmails`).

## Conventions

- **Models:** `Review.status` is `"active" | "done" | "deleted"` (soft delete via status change). `assignees[].status` is `"pending" | "reviewed"`. `markReviewAsUpdated` resets all assignees back to `pending`.
- **Retention:** `updateReviewStatus` permanently hard-deletes the oldest items once a room has >10 `done` or >10 `deleted` reviews (`manageDoneReviewsQueue` / `manageDeletedReviewsQueue`).
- **Firestore gotcha:** never write `undefined` fields — `cleanAllowedUsers` strips empty `googleChatUserId`; emails are lowercased before storage/compare.
- **Guarding:** call `checkDb()` (throws if `db` null) at the top of every db fn.
- **Error handling:** `try/catch`, `console.error`, user-facing `alert(...)` (no toast lib).
- **State:** functional components + hooks; real-time via `onSnapshot` (always return the unsubscribe in `useEffect` cleanup).
- **UI:** compose the `Glass*` primitives; merge classes with `clsx` + `tailwind-merge`.
- **API routes:** export `POST` (Web `Request`), return `NextResponse.json(...)` with proper status codes.
- **Secrets:** only `NEXT_PUBLIC_`-prefixed vars exist and they ship to the client — that is expected for Firebase web config. Update `env.example` when adding env vars. Never commit `.env.local`.

## Safety Boundaries

**Allowed without asking:** read any file; run `npm run dev` / `build` / `start` / `lint`; edit source under `src/`.

**Requires approval:**
- Dependency changes (`npm install <pkg>`, editing `package.json`/lockfile).
- Editing `firestore.rules`, `firestore.indexes.json`, and any `firebase deploy ...` (changes prod data access; index deploys are slow/irreversible).
- Editing `.env*`, `env.example` secrets, `netlify.toml`, `firebase.json`, `.firebaserc`.
- `git push` / opening PRs.
- Destructive Firestore ops or anything touching the hard-delete retention logic in `db.ts`.

For org-wide LapakGaming conventions see `/Users/wilik/repositories/lapakgaming-context/` — but note this repo is independent of that platform and most of it will not apply.
