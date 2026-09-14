# Luma product roadmap

Luma is a personal attention tracker, not a calendar replacement. Each domain remains explicit internally and maps into one calm Attention feed.

## Phase 0 — Foundation

**Status: CURRENT**

Purpose: make every current feature offline, testable, recoverable, and safe to evolve.

Implemented:

- Expo, React Native, strict TypeScript, and Expo Router;
- local SQLite database with WAL, foreign keys, explicit schema versioning, and forward migrations;
- repository, domain, service, feature, and route separation;
- Zod validation for persisted structured data;
- reusable light/dark design tokens and loading, empty, error, and form UI;
- contextual notification-permission abstraction;
- development-only optional seed data;
- tests focused on date and business logic.

Technical implication: SQLite remains the source of truth. New domains receive their own models and tables instead of expanding a generic item record.

## Phase 1 — Deadlines

**Status: CURRENT**

Purpose: show exactly what is due, when it is due, and how urgently it needs attention.

Implemented:

- create, view, edit, complete/reopen, and confirmed deletion;
- UTC ISO timestamps and a default Normal urgency profile;
- centralized threshold and overdue logic;
- human-friendly remaining-time copy;
- accessible urgency symbols and colors;
- configurable 7-day, 3-day, 1-day, and due-time local rules;
- notification cancellation/reconstruction after edits, completion, deletion, and app activation.

**Status: NEXT** — add an urgency-profile management screen. Multiple-profile persistence and deadline association already exist; it was intentionally kept out of the first UI to preserve Phase 1 clarity.

Anti-snooze principle: Luma will not optimize for repeated generic snoozing. The intended choices are to complete the item, consciously reschedule/change the plan, or leave it visibly urgent. Richer escalation can build on the planner later without changing source-of-truth data.

## Phase 2 — Goals and habits

**Status: CURRENT**

Purpose: make recurring personal commitments visible alongside deadlines without merging their domain models.

Implemented:

- daily, selected-weekday, and simple weekly-frequency recurrence;
- boolean and numeric targets with separate per-local-day logs;
- quick completion and numeric progress from the Habits screen;
- local reminder times with rolling reconciliation;
- weekly completion, reliability, current/best streak, total completions, and derived 10-XP completions;
- habit obligations mapped into the Attention feed.

Reliability is visually primary. Streaks and XP are secondary and there are no levels, currency, stores, punitive loss messages, or achievement infrastructure.

## Phase 3 — People and relationship cadence

**Status: LATER**

Purpose: help users maintain meaningful contact at a chosen cadence.

Potential domains:

```text
Relationship
InteractionLog
```

Potential actions include Call, Message, WhatsApp, and We talked. Meaningful contact must primarily be user-confirmed.

Technical implications:

- optional device-contact selection with only the minimum copied data;
- deep links to communication apps;
- relationship-specific attention calculation;
- no architecture based on reading phone-call history. iOS does not generally expose it to normal third-party apps, and Android distribution restrictions make it unsuitable as a core model.

No people tables, permissions, contact imports, or interaction services exist yet.

## Phase 4 — Polish and glanceability

**Status: LATER**

Purpose: make the most important attention state available with less effort.

Potential work:

- home-screen widgets led by the most urgent item;
- urgency overview and carefully selected richer statistics;
- backup, export, and import;
- achievements only where they support reliability;
- themes and deeper accessibility testing;
- improved notification escalation.

The home-screen widget is particularly important, but no widget target or shared native storage is implemented yet. Dynamically changing the app icon will not be the primary urgency mechanism.

## Phase 5 — Accounts, friends, and sharing

**Status: DEFERRED**

Purpose: add social value only after the personal attention loop proves useful.

Possible future technology includes Supabase, PostgreSQL, Supabase Auth, row-level security, and push notifications. Possible domains include User, Friendship, Group, AvailabilityWindow, EventProposal, Participant, and Vote.

Technical implications:

- SQLite should remain important;
- server state must not force a rewrite of local domain logic;
- synchronization conflict and ownership rules require a separate design;
- Supabase plus PowerSync may be evaluated only when demonstrated sync needs justify it.

No backend client, account abstraction, network API, push token, remote schema, or sync queue exists now.

### Future sharing security requirement

Share availability, not private calendar details. Free/busy or available windows may leave the device; private event titles such as medical, interview, or therapy details should not be uploaded merely to find overlap. Availability should preferably be calculated locally.

## Phase 6 — Shared availability and group scheduling

**Status: DEFERRED**

Purpose: find overlapping time, propose an event, and let participants accept, reject, or suggest alternatives.

Potential flow:

```text
Create “Dinner next week”
Choose participants and a three-hour evening preference
Calculate ranked free/busy overlaps
Propose one window
Collect participant responses
Offer external-calendar creation only after acceptance
```

Technical implications:

- local calendar permission and adapters for device, Google, Outlook, or Apple calendars;
- privacy-preserving free/busy normalization;
- server authorization for shared proposal records;
- timezone-aware overlap and voting logic.

No calendar integration, social schema, availability engine, or group scheduling infrastructure exists yet.

## Explicit current non-goals

**Status: DEFERRED**

- backend, authentication, accounts, or cloud sync;
- Firebase, Supabase, PowerSync, or external APIs;
- social features, contacts, call logs, or calendar access;
- widgets and dynamic app icons;
- analytics, advertising, telemetry, or remote code;
- universal recurrence languages, complex notification escalation, or generalized catch-all entities.
