# SendPulse Business Contact Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a person who already exists in the Irina Telegram bot writes to the linked Telegram Business account, copy all custom variables and all tags to the new Business contact exactly once.

**Architecture:** A disabled-by-default Next.js webhook route delegates to a testable sync module. The sync module reads the Business destination contact, resolves the ordinary Irina subscriber with SendPulse `GET /telegram/contacts/getByTelegramId` without `business_connection_id`, copies custom variables and tags, then writes `Business_sync=done`. A small REST client handles SendPulse OAuth and Telegram API calls.

**Tech Stack:** Next.js 16, Node.js built-in `fetch`, Node.js built-in test runner, SendPulse Telegram REST API.

**Spec:** `docs/superpowers/specs/2026-08-18-sendpulse-business-sync-design.md`

## Global Constraints

- Work only on `feature/sendpulse-business-sync`.
- Do not deploy to Vercel.
- Do not activate a SendPulse webhook.
- Feature is inert unless `SENDPULSE_BUSINESS_SYNC_ENABLED === "true"`.
- Irina SendPulse bot ID is `6671465ac84ab24b4702fa25` by default but remains configurable.
- Never log OAuth tokens, client secrets, webhook secrets, or full variable values.
- Only user/custom variables are copied; system contact fields are never synthesized as variables.

---

### Task 1: Pure sync logic

**Files:**
- Create: `patches/sendpulse-business-sync/sync.mjs`
- Create: `tests/sendpulse-business-sync.test.mjs`

**Interfaces:**
- Consumes fake client methods `getContact(id)`, `getContactByTelegramId(botId, telegramId)`, `setVariables(contactId, variables)`, `setTags(contactId, tags)`.
- Produces `processBusinessSyncEvent(event, options)` and helpers for event filtering and variable normalization.

- [ ] Write tests for ignored service/title/bot events, disabled feature, already-synced contacts, normal-bot contacts, missing source, successful variable/tag copy, and marker ordering.
- [ ] Run `node --test tests/sendpulse-business-sync.test.mjs` and confirm it fails before implementation.
- [ ] Implement minimal pure sync logic.
- [ ] Re-run the tests and confirm all pass.

### Task 2: SendPulse REST client

**Files:**
- Create: `patches/sendpulse-business-sync/client.mjs`
- Extend: `tests/sendpulse-business-sync.test.mjs`

**Interfaces:**
- Produces `createSendPulseClient({ clientId, clientSecret, fetchImpl })`.
- Client methods: `getContact(id)`, `getContactByTelegramId(botId, telegramId)`, `setVariables(contactId, variables)`, `setTags(contactId, tags)`.

- [ ] Add mocked-fetch tests for OAuth caching, exact Telegram endpoint/query parameters, `setVariable` body, and `setTag` body.
- [ ] Implement OAuth token caching until 60 seconds before expiration.
- [ ] Implement SendPulse request wrapper with structured errors and no secret leakage.
- [ ] Run all tests.

### Task 3: Secure webhook route

**Files:**
- Create: `patches/sendpulse-business-sync-route.js`
- Extend: `tests/sendpulse-business-sync.test.mjs`

**Interfaces:**
- Route target: `app/api/sendpulse/business-sync/route.js`.
- POST accepts SendPulse webhook JSON array/object and query parameter `key`.

- [ ] Add tests for payload normalization and secret comparison helper.
- [ ] Implement POST route with `runtime = 'nodejs'`, timing-safe secret check, JSON validation, feature flag, Irina bot configuration, and processing of all webhook array entries.
- [ ] Return 401 for bad secret, 400 for malformed payload, 200 for ignored/successful events, 500 for SendPulse API failures.

### Task 4: Build integration and verification

**Files:**
- Modify: `build.cjs`
- Modify: `package.json`

**Interfaces:**
- `build.cjs` copies the client, sync module, and route into the extracted Next.js production source before `next build`.
- `package.json` exposes `npm test` using Node's built-in test runner.

- [ ] Add copy steps to `build.cjs` without touching news/VK logic.
- [ ] Add `"test": "node --test tests/*.test.mjs"` to `package.json`.
- [ ] Run `npm test` locally against the branch files.
- [ ] Reconstruct the build workspace locally from the repository source archive and run the build if possible without credentials.
- [ ] Review branch diff against `main` and confirm there are no production/deployment changes.
