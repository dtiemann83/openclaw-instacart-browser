# instacart-browser — Design

**Date:** 2026-04-20
**Status:** Design draft, pre-implementation.
**Scope:** Standalone OpenClaw plugin that builds an Instacart cart on behalf of the household. **Never places orders** — humans do that.

---

## 1. What this plugin does

`instacart-browser` is an OpenClaw plugin that lets the household chef say things like "Let's do groceries," "Do the usuals," "Repeat last week's order but skip the ice cream," or "Add milk, eggs, and bananas," and have the assistant drive a browser to build an Instacart cart end-to-end — authenticate, pick a store, add items, schedule a delivery/pickup window, and stop at the review screen so a human can place the order.

Explicit non-goals:

- **No order placement.** The plugin has no code path, tool, or instruction that clicks "Place Order."
- **No payment management.** We do not add, change, or read payment methods.
- **No marketing email handling.** The resend integration is inbound-login-codes-only.
- **No per-person profiles.** Preferences are household-scoped for now.
- **No meal planning.** Extensibility hook only; stubbed.

---

## 2. Platform primitives used

| Primitive | Used for | Notes |
|---|---|---|
| Built-in `browser` tool (CDP-attached) | All DOM interaction on instacart.com | Docs: `openclaw/docs/tools/browser.md`. The user's `~/.openclaw/openclaw.json` already declares an `openclaw` browser profile with persistent user-data at `~/.openclaw/browser-data/openclaw/` attached via CDP port 18800 (`attachOnly: true`). Instacart cookies persist there across sessions; no custom cookie code needed. |
| Existing `resend` skill | Polling inbound login-code emails | Uses `resend.emails.receiving.list()` / `.get()`. The configured `loginEmail` is expected to be routed through Resend inbound. |
| OpenClaw plugin manifest | Manifest-driven install, config schema, dependency declaration | `openclaw.plugin.json` at repo root. Mirrors the layout of the user's existing `imessage-photon` plugin. |
| OpenClaw SKILL.md format | Agent-facing instructions for *when* and *how* to drive the flow | Front-matter + markdown body, with references under `references/`. |
| Plugin data directory | Persistent JSON (`carts.json`, `staples.json`, `preferences.json`, `sessions.json`) | Location is config-driven, default `~/.openclaw/workspace/instacart-browser/`. |

---

## 3. Plugin manifest shape (`openclaw.plugin.json`)

```json
{
  "id": "instacart-browser",
  "requires": {
    "skills": ["resend"],
    "tools": ["browser"]
  },
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "dataDir": {
        "type": "string",
        "description": "Where to store carts/staples/preferences/sessions JSON.",
        "default": "~/.openclaw/workspace/instacart-browser"
      },
      "profile": {
        "type": "string",
        "description": "Browser profile to attach to.",
        "default": "openclaw"
      },
      "loginEmail": {
        "type": "string",
        "description": "Instacart account email (passwordless)."
      },
      "auth": {
        "type": "object",
        "properties": {
          "senderPattern": { "type": "string", "default": ".*@instacart\\.com$" },
          "codeRegex":    { "type": "string", "default": "\\b(\\d{6})\\b" },
          "timeoutMs":    { "type": "number", "default": 120000 },
          "pollIntervalMs": { "type": "number", "default": 3000 }
        }
      },
      "staples": {
        "type": "object",
        "properties": {
          "minOccurrences": { "type": "number", "default": 3 },
          "windowSize":     { "type": "number", "default": 5 },
          "maxAgeDays":     { "type": "number" }
        }
      },
      "ranking": {
        "type": "object",
        "description": "Weights for rank_stores.",
        "properties": {
          "proximity":  { "type": "number", "default": 0.25 },
          "history":    { "type": "number", "default": 0.35 },
          "listMatch":  { "type": "number", "default": 0.30 },
          "windowFit":  { "type": "number", "default": 0.10 }
        }
      }
    }
  }
}
```

Config precedence and defaults match the user's existing plugin conventions.

---

## 4. Boundaries — who owns what

| Layer | Owns | Does **not** own |
|---|---|---|
| `SKILL.md` + `references/*.md` | When/how to call the `browser` tool, selector ladders, conversational flow, stop-at-review policy, error messaging | Any TypeScript logic |
| Plugin TS tools | Memory I/O, ranking math, preference evolution, login-code polling, staples detection, list-source plumbing | Any DOM interaction |
| Built-in `browser` tool | All CDP/DOM work on instacart.com | Instacart-specific knowledge |
| `resend` skill | `resend.emails.receiving.list/get` calls | Anything Instacart-specific |

---

## 5. File layout

```
~/Desktop/Repos/instacart-browser/
├── openclaw.plugin.json
├── package.json                # @dtiemann/openclaw-instacart-browser
├── tsconfig.json
├── vitest.config.ts
├── index.ts                    # plugin entrypoint — registers skill + tools
├── DESIGN.md                   # this file
├── README.md
├── SKILL.md                    # agent-facing
├── references/
│   ├── auth.md
│   ├── stores.md
│   ├── cart.md
│   ├── fulfillment.md
│   ├── review.md               # "stop here — humans place"
│   └── troubleshooting.md
├── src/
│   ├── config.ts               # zod schema mirroring configSchema
│   ├── memory/
│   │   ├── index.ts            # MemoryStore facade (atomic RW, corrupt-quarantine)
│   │   ├── carts.ts
│   │   ├── staples.ts
│   │   ├── preferences.ts
│   │   └── sessions.ts
│   ├── recommendations/
│   │   ├── staples.ts          # detect_staples + normalizer
│   │   └── stores.ts           # rank_stores
│   ├── listsource/
│   │   ├── types.ts            # ListSource interface
│   │   ├── adhoc.ts
│   │   ├── staples.ts
│   │   ├── repeat.ts
│   │   └── recipes.ts          # STUB — future
│   ├── auth/
│   │   └── login-code.ts       # poll resend inbound; extract code
│   ├── preferences/
│   │   └── evolve.ts           # override tracking + promotion rules
│   ├── parsers/
│   │   └── cart-review.ts      # DOM → Cart snapshot; fixture-tested
│   └── tools/                  # agent-callable tool handlers
│       ├── resolve_login_code.ts
│       ├── read_memory.ts
│       ├── write_memory.ts
│       ├── record_cart.ts
│       ├── rank_stores.ts
│       ├── detect_staples.ts
│       ├── update_preference.ts
│       ├── open_list_source.ts
│       ├── start_session.ts
│       ├── update_session.ts
│       └── end_session.ts
└── test/
    ├── fixtures/
    │   ├── carts.sample.json
    │   └── cart-review.html
    ├── memory-io.test.ts
    ├── staples.test.ts
    ├── stores-rank.test.ts
    ├── preferences-evolve.test.ts
    ├── login-code.test.ts
    ├── list-source.test.ts
    ├── cart-parser.test.ts
    └── tools.test.ts
```

---

## 6. Data model

All files live at `<dataDir>/`. Every file is JSON, written atomically (write-temp + rename), validated on read with zod.

### `carts.json` — append-only history of built (not necessarily placed) carts

```ts
Cart = {
  cart_id: string            // "local_<uuid>" — always local; Instacart order id not captured
  built_at: string           // ISO-8601 UTC, at review-page handoff
  store: string              // "Harris Teeter - Wake Forest"
  store_id?: string
  fulfillment: {
    type: "delivery" | "pickup"
    window: string           // preserved as shown: "2026-04-19 10:00-12:00"
    window_start?: string    // ISO if parseable
    window_end?: string
    address?: string         // delivery only
  }
  items: CartItem[]
  subtotal?: number          // optional — only if visible at review
  fees?: number
  tip?: number
  total?: number
  notes?: string
}

CartItem = {
  name: string
  brand?: string
  size?: string
  qty: number
  unit?: string
  price: number
  substituted_from?: string
  category?: string
}
```

File wrapper: `{ carts: Cart[] }`.

### `staples.json` — derived; rewritten on each recorded cart

```ts
Staple = {
  key: string                // normalized item key (e.g., "milk")
  display_name: string
  brand?: string
  size?: string
  typical_qty: number
  occurrences: number
  last_seen: string
  recency_rank: number       // 0..1
}

// File: { staples: Staple[], computed_at: string, normalizer_version: string, config: {...} }
```

Normalizer is stable, versioned. On version bump, staples are recomputed from raw `carts.json`.

### `preferences.json` — evolving

```ts
Preferences = {
  brands: Record<string, string>           // item_key -> brand
  sizes:  Record<string, string>           // item_key -> size
  stores: { preferred: string[]; avoid: string[] }
  substitutions: { allow: boolean; ask_first: boolean }
  dietary: { restrictions: string[]; notes: string }
  updated_at: string
}

PreferenceOverrides = {
  pending: Record<string, { suggested: string; chosen: string; at: string }[]>
  history: Array<{
    key: string
    field: "brand" | "size" | "store"
    from: string
    to: string
    at: string
    reason: "one_shot_confirm" | "n_consistent_overrides" | "manual"
  }>
}
```

Evolution rule: on override, record to `pending[item_key]`. Promote when N consecutive overrides agree on the same alternative (default N=2), or on explicit user confirmation. `history` is append-only for auditability / undo.

Both `Preferences` and `PreferenceOverrides` live in the same `preferences.json` file under top-level keys `preferences` and `overrides` respectively, so the zod wrapper is `{ preferences: Preferences, overrides: PreferenceOverrides }`.

The `update_preference` tool's `reason` input accepts one of: `"pending"` (record to `pending[]` only, no promotion), `"one_shot_confirm"` (promote now; user explicitly confirmed), `"manual"` (promote now; user directly stated a preference). The `history` entry's `reason` is one of `"one_shot_confirm" | "n_consistent_overrides" | "manual"` — `"pending"` never appears in history because nothing was persisted beyond the `pending[]` buffer.

### `sessions.json` — resumable in-progress cart

```ts
SubstitutionFlag = {
  original: string            // original item name
  offered: string             // Instacart's suggested sub
  accepted?: boolean          // null = user hasn't decided
  decided_at?: string
}

Session = {
  session_id: string
  started_at: string
  last_updated: string
  status: "drafting" | "reviewing" | "handed_off" | "abandoned"
  list_source: "adhoc" | "staples" | "repeat" | "recipes"
  list_source_ref?: string
  store?: { id?: string; name: string }
  fulfillment?: Partial<Cart["fulfillment"]>
  cart: CartItem[]
  flags: { substitutions?: SubstitutionFlag[]; oos?: string[] }
  resume_hint?: string
}

// File: { current?: Session; recent: Session[] }
```

Resume threshold: `current` is offered for resume when `last_updated` is within **24 hours**; otherwise it is rotated into `recent[]` as `abandoned` on the next invocation.

`recent[]` retains the last ~10 completed/abandoned sessions for "resume" and "repeat last cart" support.

### Atomicity & safety

- All writes: read → mutate → write temp → rename. No partial writes.
- On zod-validation failure: rename to `<name>.corrupt.<timestamp>.json`, write a fresh default, log loudly. Never crash the plugin.
- Login codes are **never** persisted to disk. Session cookies live only in the browser profile directory managed by the `browser` tool.
- Data-dir permissioning: `0700` on creation.

---

## 7. Tool surface

Each tool has zod-validated input/output. The agent calls tools; tools never touch the browser.

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `instacart.resolve_login_code` | `{ requested_after: ISO, timeout_ms? }` | `{ code, received_at }` or `{ error: "timeout" \| "not_found" }` | Polls resend inbound matching `auth.senderPattern`, extracts first match of `auth.codeRegex` from plaintext, only accepts mail received after `requested_after`. Never logs the code. |
| `instacart.read_memory` | `{ kind: "carts"\|"staples"\|"preferences"\|"sessions" }` | `{ data }` | Validated read. |
| `instacart.write_memory` | `{ kind, data, merge?: boolean }` | `{ ok: true }` | Atomic write. Preferences merge by default. |
| `instacart.record_cart` | `{ cart: Cart }` | `{ ok: true, staples_recomputed: boolean }` | Append to `carts.json`, then recompute `staples.json`. |
| `instacart.rank_stores` | `{ candidates, list?, prefs? }` | `{ ranked, rationale }` | Weighted scoring (weights from config). |
| `instacart.detect_staples` | `{ force?: boolean }` | `{ staples, changed: boolean }` | Recompute from carts + current normalizer version. |
| `instacart.update_preference` | `{ field, key, from?, to, reason }` | `{ ok, promoted }` | Record pending override or promote per evolution rule. |
| `instacart.open_list_source` | `{ kind, args? }` | `{ items, origin }` | Delegate to listsource; for `adhoc`, applies preferences; for `repeat`, loads a cart by `cart_id` or `"last"`. |
| `instacart.start_session` | `{ list_source, list_source_ref? }` | `{ session_id }` | Create `sessions.json.current`. |
| `instacart.update_session` | `{ patch }` | `{ ok }` | Merge patch into `current`. |
| `instacart.end_session` | `{ status: "handed_off" \| "abandoned" }` | `{ ok }` | Rotate `current` into `recent[]`, clear `current`. |

**Intentionally NOT tools:** `add_item`, `set_fulfillment`, `list_windows`, `place_order`. Those are browser actions performed by the agent, guided by SKILL.md. `place_order` in particular has no tool AND no instruction in SKILL.md.

---

## 8. SKILL.md structure

### Front-matter

```yaml
---
name: instacart_browser
description: >
  Use when the user wants to build an Instacart cart — start shopping, add items,
  do the usuals, repeat last cart, schedule delivery/pickup, review the cart.
  Handles passwordless login via the resend skill; persists carts/staples/preferences;
  stops at the review screen — does NOT place the order (humans do).
metadata:
  openclaw:
    os: ["darwin", "linux"]
    requires:
      skills: ["resend"]
      tools: ["browser"]
inputs:
  - name: INSTACART_EMAIL
    description: Login email for Instacart (passwordless). Defaults to plugin config.
    required: false
references:
  - auth.md
  - stores.md
  - cart.md
  - fulfillment.md
  - review.md
  - troubleshooting.md
---
```

### Body outline

The SKILL.md body is deliberately terse — detail goes in `references/*.md`.

1. **Decide the list source** — `adhoc` / `staples` / `repeat`. Call `instacart.open_list_source`.
2. **Session probe.** Navigate to `instacart.com`; check logged-in indicator. If not → `auth.md`.
3. **Auth flow** — record `requested_after`, request code, call `instacart.resolve_login_code`, submit.
4. **Store selection** — if user asked to compare, call `instacart.rank_stores`. Otherwise use last-used store.
5. **Cart building** — for each item, search + apply preferences; on override, call `instacart.update_preference`. Persist via `instacart.update_session`.
6. **Fulfillment** — set type, pick window. See `fulfillment.md`.
7. **Review — stop here.** Extract cart state. Present to user. Say: *"Cart is ready. Review and place it yourself on Instacart."* **Never** click Place Order.
8. **Record** — call `instacart.record_cart`, then `instacart.end_session({ status: "handed_off" })`.

### References

- **`auth.md`** — selector ladders for email/code/submit; aria-label → data-testid → text → CSS priority; retry/timeout policy; captcha halts the flow.
- **`stores.md`** — enumerate retailers at the delivery address; extract windows; Instacart address-picker quirks.
- **`cart.md`** — search-result disambiguation (exact brand > exact size > highest availability); OOS/substitution handling per preferences; DOM → cart extraction rules.
- **`fulfillment.md`** — delivery vs pickup selection; window picker; how windows are labeled in the DOM.
- **`review.md`** — **the stop.** Exactly what to surface, exactly what to say, what not to click.
- **`troubleshooting.md`** — session-expired, item-not-found, no-windows, rate-limit, DOM-drift, captcha, resend-skill-missing.

---

## 9. Flows & state machine

### Session lifecycle

```
(no session) ──▶ probing ──logged-in──▶ drafting ──review──▶ reviewing
                    │                                           │
                    └─not-logged-in─▶ authenticating ──ok──▶ drafting
                                                                │
                                           handed_off ◀─user confirms
Any state: session-expired → authenticating → resume to prior.
Any state: user abandons → abandoned (rotated into recent[]).
```

### Six flows

1. **"Let's do groceries."** Read sessions (offer resume if recent); probe; auth if needed; offer last-used store vs compare.
2. **Auth.** Record `requested_after`; request code; `resolve_login_code`; submit; re-probe. Captcha → halt. Timeout → retry or hand to user.
3. **"Do the usuals."** `open_list_source({ kind: "staples" })` → loop add-item → fulfillment → review.
4. **"Repeat last cart, skip X."** `open_list_source({ kind: "repeat", args: { cart_id: "last" } })` → filter → same loop.
5. **Ad-hoc.** `open_list_source({ kind: "adhoc", args: { items } })` applies preferences → loop add → "anything else?" → fulfillment → review.
6. **Fulfillment → review → hand off.** Set fulfillment, pick window; extract cart snapshot; present; say "I'll stop here." Record cart. End session.

### Error matrix

| Condition | Detected via | Action |
|---|---|---|
| Session expired | Login elements reappear | Pause state; re-auth; verify server-side cart (Instacart typically preserves the cart, but don't assume — re-extract cart state after re-auth and reconcile with `sessions.json.current.cart`). |
| Captcha | Known captcha iframes/text | **Halt.** Tell user. Never auto-solve. |
| 2FA | Separate code field post-login | Same auth sub-flow; new `requested_after`. |
| Item not found | Empty results | Ask for alt name / skip. |
| OOS on add | UI flag | Honor `preferences.substitutions`; auto-sub or ask. |
| No windows | Empty window list | Offer pickup / other day / other store. |
| Rate limiting | 429-style UI | Back off with jitter; cap 3 retries; stop and report. |
| DOM drift | Selector ladder exhausted | Log URL + accessible tree; stop; tell user UI may have changed. |
| Duplicate session | `current` exists on new invocation | Offer resume vs abandon. |
| resend skill missing | `requires.skills` fails at load | Clear error at plugin load, not at auth time. |

No "payment failure" row — we never submit.

---

## 10. Testing

| Test | Type | What it proves |
|---|---|---|
| `memory-io.test.ts` | Unit | Atomic write; zod validation; corrupt-file quarantine; append semantics. |
| `staples.test.ts` | Unit, fixture | Normalizer key stability; threshold obedience; recency rank. |
| `stores-rank.test.ts` | Unit | Weighted ranking; tie-breaking; empty-history fallback. |
| `preferences-evolve.test.ts` | Unit | Pending-override recording; N-consistent auto-promote; one-shot promote; history append. |
| `login-code.test.ts` | Unit, mocked | Correct resend filter; extraction; timeout; never logs code. |
| `list-source.test.ts` | Unit | Adhoc applies prefs; staples pulls current; repeat loads cart; recipes returns NotImplemented. |
| `cart-parser.test.ts` | **Fixture** | Review-page DOM → Cart shape from saved Instacart HTML snapshot. Canary for DOM drift. |
| `tools.test.ts` | Integration | Each tool's zod contracts; memory side-effects; idempotency. |

Coverage bar: 70% lines/branches/statements on `src/`. No live-browser tests — out of scope.

---

## 11. Security & privacy

- **Login codes:** held in memory only for the duration of the auth flow. Never written to disk. Never logged. Tests verify they don't leak into log lines.
- **Session cookies:** only via the browser profile dir (managed by the `browser` tool). No cookie code in this plugin.
- **No Place Order path.** Structural, not flag-based.
- **Logging:** every tool call emits `{ tool, input_keys, duration_ms, outcome }`. No input *values* for `resolve_login_code`; no item prices or totals unless debug-level and explicitly enabled.
- **Data-dir permissions:** `0700` on creation. Contains household shopping history — treat as personal data.
- **No secrets in code.** `loginEmail` is config; Resend API key stays under the existing `resend` skill's env.

---

## 12. Extensibility hooks

- **`listsource/recipes.ts`** — stub today; tomorrow returns items from a meal plan. Same `ListSource` interface, same downstream pipeline.
- **`rank_stores` weights** — config, not code.
- **Staples thresholds** — config (`minOccurrences`, `windowSize`, `maxAgeDays`).
- **Browser profile** — config (`profile`); flip to a dedicated profile later without a code change.
- **Resend filter/regex** — config (`auth.senderPattern`, `auth.codeRegex`); survives Instacart changing sender domain.
- **Per-person preferences** — deferred. When needed, add a `people` map to `preferences.json`; callers already go through the preferences facade, so the change is additive.

---

## 13. Non-goals (re-stated, load-bearing)

- Placing orders.
- Managing payment methods.
- Marketing email.
- Per-person preference profiles.
- Meal planning (hook only).
- End-to-end live-browser tests.

---

## 14. Open risks

1. **Instacart DOM drift.** Biggest tax. Mitigated by selector ladders, explicit failure logging, and the cart-parser fixture canary.
2. **Resend filter reliability.** Sender/subject changes break extraction. Mitigated by keeping filter + regex in config.
3. **Cart-snapshot-vs-placed-order imprecision.** User may edit before placing. Staples thresholds absorb noise.
4. **Sessions concurrency.** Last-write-wins. Add a lockfile only if it bites.
5. **Resend polling cost.** Negligible at household scale (~160 API calls/month).
6. **Captcha escalation.** No programmatic fallback; halt.
7. **Normalizer drift.** Versioned; bump triggers recompute from raw carts.
8. **Resend skill coupling.** Surfaced at plugin load via `requires.skills`.
