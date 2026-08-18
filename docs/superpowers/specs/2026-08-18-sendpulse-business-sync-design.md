# SendPulse Telegram Business Contact Sync Design

## Goal

When a person who already exists as a normal subscriber of the Telegram bot **Ирина LH ⚡️ Арбитраж трафика** sends the first private message to the linked Telegram Business account, automatically copy all custom SendPulse variables and all tags from the original bot subscriber contact into the newly created Telegram Business contact.

The copy runs once per Business contact. Later changes to the original subscriber are not synchronized.

## Scope

Included:
- Receive SendPulse global chatbot webhook events.
- Process only Telegram `incoming_message` events for the Irina bot.
- Resolve the newly created Business contact.
- Match it to the original Irina subscriber by Telegram user ID.
- Copy every writable custom variable that exists on the source contact.
- Copy every source tag.
- Mark the destination Business contact as already synchronized.
- Log success, skips, and failures without logging secrets or full sensitive variable values.
- Keep the module isolated from news publishing, VK publishing, and current content cron logic.

Not included:
- Continuous two-way synchronization.
- Copying system fields such as SendPulse contact ID, Telegram ID, username, bot ID, or Business account identifiers.
- Creating or initiating the Telegram Business chat before the person messages first.
- Meta Ads analysis. That is a separate subsystem and will be designed separately.

## Confirmed Product Behavior

SendPulse Telegram Business creates a new chatbot audience contact when a person writes to the connected personal Telegram account, even if the same person is already an existing chatbot subscriber.

SendPulse global chatbot webhooks support the `incoming_message` event and include the SendPulse bot object plus the current contact ID, variables, and tags.

The Telegram chatbot API exposes contact lookup/read operations, lookup by Telegram ID, variable assignment, and tag assignment.

## Architecture

Add a self-contained module under `lib/sendpulse-business-sync/` and a single Next.js route under `app/api/sendpulse/business-sync/route.js`.

The route performs only webhook validation, payload parsing, and HTTP response handling. Business logic lives in the library module so it can be unit-tested without running Next.js.

The SendPulse client is a small wrapper around the official REST API. It obtains and caches OAuth access tokens in process memory until shortly before expiry. Credentials are read from environment variables and are never hardcoded.

## Data Flow

1. SendPulse sends a global webhook to `/api/sendpulse/business-sync`.
2. The route validates a dedicated webhook secret supplied in the webhook URL query parameter.
3. The route accepts only webhook entries where:
   - `service === "telegram"`
   - `title === "incoming_message"`
   - `bot.id` matches the configured Irina SendPulse bot ID.
4. For each accepted entry, read the destination SendPulse contact using `contact.id` from the webhook.
5. Resolve the Telegram user ID from the destination contact payload.
6. Query SendPulse by Telegram ID to obtain contacts belonging to the same Telegram user.
7. Select:
   - destination = the webhook contact ID;
   - source = another contact belonging to the same Irina bot that is not the destination Business contact.
8. If no unambiguous source is found, skip without writing and log the reason.
9. If the destination already has the sync marker, return an idempotent skip.
10. Fetch the full source contact.
11. Copy all source custom variables to the destination, excluding protected/system fields and the internal sync marker.
12. Copy all source tags to the destination.
13. Write the internal sync marker only after all variable and tag writes complete successfully.
14. Return HTTP 200 to SendPulse. Individual item failures are reported in structured server logs.

## Contact Matching Rules

Primary key: Telegram user ID.

Never match by display name or username because either can change or collide.

The webhook contact ID always identifies the destination Business contact for the current event.

The source must be a different SendPulse contact ID associated with the same Telegram user and the Irina bot.

If the Telegram lookup returns more than one possible non-destination source and the API response does not expose enough metadata to choose the ordinary bot subscriber safely, the sync must stop with `ambiguous_source` rather than copying from an arbitrary contact.

This safe-fail behavior protects against silently copying the wrong lead data.

## Variables

Copy every writable custom variable present on the source contact.

Do not copy SendPulse/Telegram system identifiers. The copy routine will work only from the API's custom `variables` object/list and will not synthesize fields from other contact properties.

SendPulse ignores writes to variables that do not exist for the destination bot. Because the Business contact belongs to the same Irina bot, the destination should share the same bot variable definitions. Any rejected variable is treated as an item failure and prevents the final sync marker from being written.

Internal idempotency variable:
- Name: `Business_sync`
- Successful value: `done`

`Business_sync` must exist in the Irina bot's variable definitions before production activation. It is not copied from the source contact.

## Tags

Copy every tag assigned to the source contact.

Duplicate tag assignment must be treated as harmless/idempotent.

The internal `Business_sync` marker is a variable, not a tag, so it does not pollute the user's tag list.

## Idempotency

Before copying, inspect destination variable `Business_sync`.

If it equals `done`, skip all writes and return success.

Write `Business_sync=done` only after every intended variable and tag operation succeeds. If a partial failure occurs, a later webhook event may retry the whole operation. Re-applying existing variable values and tags is expected to be safe.

## Security

Environment variables:
- `SENDPULSE_CLIENT_ID`
- `SENDPULSE_CLIENT_SECRET`
- `SENDPULSE_IRINA_BOT_ID` = `6671465ac84ab24b4702fa25`
- `SENDPULSE_BUSINESS_WEBHOOK_SECRET`
- `SENDPULSE_BUSINESS_SYNC_ENABLED` default `false`

The feature must remain inert unless `SENDPULSE_BUSINESS_SYNC_ENABLED === "true"`.

The webhook URL will contain a secret query parameter generated for this integration. The handler compares it using timing-safe comparison where practical.

Never log OAuth tokens, client secrets, webhook secrets, or full contact variable values.

## Failure Handling

Return 200 for:
- unsupported webhook events;
- events for another bot;
- already synchronized contacts;
- no safe source match.

Return 401 for an invalid webhook secret.

Return 400 for malformed JSON or structurally invalid webhook payloads.

For temporary SendPulse API failures, return 500 so the event can be retried if SendPulse retries delivery. The handler itself does not implement an independent background retry queue in v1.

Partial copy failures do not write `Business_sync=done`.

## Logging

Structured log events:
- `business_sync_disabled`
- `business_sync_ignored_event`
- `business_sync_already_done`
- `business_sync_no_source`
- `business_sync_ambiguous_source`
- `business_sync_success`
- `business_sync_failure`

Success logs include only contact IDs, count of copied variables, count of copied tags, and Telegram ID in masked form.

## Files

Create:
- `lib/sendpulse-business-sync/client.js` — OAuth and SendPulse Telegram API requests.
- `lib/sendpulse-business-sync/sync.js` — event filtering, contact matching, copy logic, idempotency.
- `app/api/sendpulse/business-sync/route.js` — secure webhook endpoint.
- `tests/sendpulse-business-sync.test.mjs` — unit tests using a fake SendPulse client.

Modify:
- `build.cjs` — copy the new source files/routes into the extracted production source during build, following the repository's existing patch-based build pattern.
- `package.json` — add a test script using Node's built-in test runner; no new runtime dependency is required.

## Test Cases

1. Ignores a non-Telegram webhook.
2. Ignores a non-`incoming_message` webhook.
3. Ignores a webhook for another bot.
4. Rejects an invalid webhook secret.
5. Skips when sync is disabled.
6. Skips a destination already marked `Business_sync=done`.
7. Finds the original contact by Telegram ID and copies every custom variable.
8. Copies every source tag.
9. Does not copy system fields.
10. Writes `Business_sync=done` only after variable and tag copies complete.
11. Does not write the marker after a variable failure.
12. Does not write the marker after a tag failure.
13. Safely skips when no source exists.
14. Safely skips when multiple source contacts are ambiguous.
15. Handles SendPulse webhook payloads delivered as an array.

## Deployment and Activation

Development is performed only on branch `feature/sendpulse-business-sync`.

No Vercel deployment is part of implementation or testing.

After code and tests are complete:
1. Review the diff.
2. Ensure `Business_sync` exists in Irina's SendPulse variable definitions.
3. Prepare required Vercel environment variables.
4. Prepare the SendPulse global webhook URL but do not activate it yet.
5. Ask the user `Деплоим?`.
6. Only after explicit approval, merge/deploy as one combined deployment.
7. After production health verification, enable the SendPulse webhook and feature flag.

## Success Criteria

A real existing Irina subscriber writes to the Telegram Business account for the first time. The new Business contact receives the same custom variables and tags as the original Irina contact. Subsequent messages do not repeat the copy after `Business_sync=done`. Existing news/VK publication behavior remains unchanged.
