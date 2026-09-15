# Luma architecture

## Core decision

Luma is local-first. SQLite is authoritative for all domain data, the application works offline, and scheduled notifications are disposable projections of database rules. There is no backend, account, analytics SDK, advertising SDK, cloud telemetry, or remote code.

The dependency direction is:

```text
Expo Router screens
  -> feature components and hooks
    -> application services
      -> repositories + pure domain logic
        -> SQLite / operating-system notification adapter
```

React components do not calculate urgency, recurrence obligations, reliability, or notification dates.

## Modules

- `src/domain/deadlines`: validated models, urgency calculation, and time-remaining presentation.
- `src/domain/habits`: typed recurrence, obligation status, completion metrics, reliability, and streaks.
- `src/domain/attention`: maps separate domain objects into `AttentionItem` values and sorts them.
- `src/domain/notifications`: turns persisted rules and current data into future notification intents.
- `src/db/repositories`: the only normal location for SQL queries and row mapping.
- `src/services`: coordinates repositories and native capabilities.
- `app`: navigation, loading/error states, forms, and user actions.

Zustand and Redux are intentionally absent. SQLite-backed screen queries plus a small refresh context are sufficient for current application state.

## UI system

Gluestack UI v5 provides accessible, composable primitives for controls, inputs, cards, overlays, and feedback. UniWind compiles Tailwind CSS v4 utilities for native and web from `global.css`, where Luma's semantic light/dark and urgency tokens live. Route files compose those shared primitives; they do not introduce separate page-level color systems.

## Database

`SQLiteProvider` opens `luma.db`. Initialization enables WAL and foreign keys before applying numbered migrations inside exclusive transactions. `PRAGMA user_version` records the installed schema version. Migrations only move forward and never recreate user tables destructively.

Current schema (migrations 1–3):

```text
urgency_profiles
  id PK
  name
  yellow_days, orange_days, red_days
  is_default
  created_at, updated_at

deadlines
  id PK
  title, notes
  due_at
  urgency_profile_id FK -> urgency_profiles
  urgent_before_minutes
  created_at, updated_at, completed_at
  archived_at, archive_reason

deadline_notification_rules
  id PK
  deadline_id FK -> deadlines ON DELETE CASCADE
  offset_days, enabled, created_at
  UNIQUE(deadline_id, offset_days)

habits
  id PK
  title, notes
  recurrence_type, recurrence_config
  target_type, target_value, unit
  active, created_at, updated_at
  archived_at, archive_reason

habit_logs
  id PK
  habit_id FK -> habits ON DELETE CASCADE
  date, amount, previous_amount, completed
  created_at, updated_at
  UNIQUE(habit_id, date)

habit_notification_rules
  id PK
  habit_id FK -> habits ON DELETE CASCADE
  reminder_time, enabled, created_at
  UNIQUE(habit_id)

scheduled_notifications
  id PK
  source_type, source_id
  native_notification_id, fire_at, created_at

settings
  key PK
  value_json, updated_at
```

Structured JSON is parsed through Zod at repository boundaries. SQL values are parameterized. Each deadline stores its own urgency-window duration in minutes. Archived records use soft deletion so the Bin can restore them; habit logs retain the amount from before completion for the same reason.

## Date and timezone strategy

Deadline times, creation times, update times, completion times, and notification fire times are instants. They are stored as ISO 8601 UTC timestamps and converted to local time for display.

Habit history represents a user's completed civil day rather than an instant. Each log therefore stores a canonical local date string in `yyyy-MM-dd` form, captured when the user records progress. A later timezone change does not move that historical completion to yesterday or tomorrow.

Daily and weekday obligations use the current device calendar. Weekly calculations use the configured Sunday/Monday week start. `date-fns` calendar operations are used rather than adding fixed 24-hour durations, avoiding daylight-saving drift.

This policy deliberately does not attempt to infer a permanent “home timezone.” If travel-specific scheduling becomes important, it should be designed explicitly rather than changing old log dates.

## Attention Engine

`getAttentionItems(input, now)` is pure and deterministic:

1. ignore completed deadlines and inactive/completed habit obligations;
2. calculate each source object's status in its own domain;
3. map it into the small shared `AttentionItem` presentation type;
4. sort overdue red items first, then orange habit obligations, yellow urgency-window items, and green items;
5. within one tier, sort by nearest actionable time and then title.

The Attention screen calls `loadAttentionItems`; it does not query every domain independently or duplicate ranking logic.

## Notifications

Deadline reminder offsets and habit reminder times are application data. The notification planner derives concrete future intents. Reconciliation:

1. finds and cancels OS requests marked as Luma-owned;
2. clears the disposable scheduling ledger;
3. reloads active domain objects and rules from SQLite;
4. plans a rolling 14-day window;
5. schedules at most 60 notifications, leaving room under iOS's pending-notification limit;
6. stores native identifiers for inspection and cancellation.

Reconciliation runs on app activation and after relevant writes. Permission is requested only with user context after the first reminder is saved. Denial does not affect the item or any in-app feature.

Background JavaScript execution is not assumed. The next foreground reconciliation reconstructs the schedule. Device notification behavior still requires native-device testing.

The anti-snooze rule is product-level: a user completes an item, consciously changes the plan, or leaves it visibly urgent. Generic repeated snoozing is not the primary action.

## Error and privacy posture

Migrations fail visibly through the route error boundary. Screens show recoverable loading/error states, forms retain data on save errors, and moving an item to the restorable Bin requires native confirmation.

Notification payloads contain only a source type, local identifier, and route. No data leaves the device. Logs avoid printing titles, notes, or completion history.

## Why there is no backend

Current value does not require identity, sharing, or server state. A backend now would add failure modes, privacy surface, and synchronization complexity without helping the single-phone attention loop. Repository and domain separation are enough preparation; no speculative sync abstraction is present.
