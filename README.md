# @dtiemann/openclaw-instacart-browser

OpenClaw plugin that builds Instacart carts conversationally and **stops at the review screen** — humans place the orders.

## Install

```
openclaw plugins install ~/Desktop/Repos/instacart-browser
```

Or add to `~/.openclaw/openclaw.json`:

```jsonc
{
  "plugins": {
    "entries": { "instacart-browser": { "enabled": true } },
    "load": { "paths": ["/Users/<you>/Desktop/Repos/instacart-browser"] }
  }
}
```

Requires the `resend` skill and the built-in `browser` tool.

## Config

```jsonc
{
  "plugins": {
    "entries": {
      "instacart-browser": {
        "enabled": true,
        "config": {
          "dataDir": "~/.openclaw/workspace/instacart-browser",
          "profile": "openclaw",
          "loginEmail": "chef@tiemannfamily.us",
          "staples": { "minOccurrences": 3, "windowSize": 5 }
        }
      }
    }
  }
}
```

See `DESIGN.md` for the full schema.

## Tools

`instacart.resolve_login_code`, `instacart.read_memory`, `instacart.write_memory`, `instacart.record_cart`, `instacart.rank_stores`, `instacart.detect_staples`, `instacart.update_preference`, `instacart.open_list_source`, `instacart.start_session`, `instacart.update_session`, `instacart.end_session`.

## What it does NOT do

- Place orders.
- Manage payment methods.
- Handle marketing email.
- Support per-person preference profiles.

## Dev

```
npm install
npm test
npm run typecheck
```

See `PLAN.md` for the implementation plan and `DESIGN.md` for the architecture.
