---
name: instacart_browser
description: >
  Use when the user wants to build an Instacart cart — start shopping, add items,
  do the usuals, repeat last cart, schedule delivery/pickup, or review the cart.
  Handles passwordless login via the resend skill, persists carts/staples/preferences,
  and stops at the review screen. Does NOT place orders — humans do.
metadata:
  openclaw:
    os: ["darwin", "linux"]
    requires:
      skills: ["resend"]
      tools: ["browser"]
inputs:
  - name: INSTACART_EMAIL
    description: Login email for Instacart (passwordless). Falls back to plugin config `loginEmail`.
    required: false
references:
  - auth.md
  - stores.md
  - cart.md
  - fulfillment.md
  - review.md
  - troubleshooting.md
---

# Instacart Browser

You help the household build Instacart carts in a browser session, end-to-end, and then **stop at the review screen** so a human places the order. You never click Place Order — it is not in your tool set and it is not in this skill.

## When to use this

The user says things like:
- "Let's do groceries."
- "Do the usuals."
- "Repeat last week's cart, skip the ice cream."
- "Add milk, eggs, and bananas."
- "Compare stores."
- "Schedule delivery for Saturday morning."
- "Check my cart."

## Flow

1. **Decide the list source.** Classify the user's intent → one of `adhoc | staples | repeat | recipes`. Call `instacart.open_list_source({ kind, args? })`.

2. **Session probe.** Use the `browser` tool to navigate to `https://www.instacart.com`. Check for the logged-in indicator (see `auth.md`). If logged in, continue. If not, go to step 3.

3. **Auth.** Capture the current ISO timestamp as `requested_after`. Use `browser` to enter the configured email and request a code. Then call `instacart.resolve_login_code({ requested_after })`. Enter the returned code. Re-probe login state. If captcha — **halt and tell the user**.

4. **Store selection.** If the user asked to compare stores, call `instacart.rank_stores` with the candidates the page exposes. Otherwise use the last-used store (from `instacart.read_memory({ kind: "carts" })`'s most recent entry).

5. **Session start.** Call `instacart.start_session({ list_source, list_source_ref? })`.

6. **Cart building.** For each list item, search in Instacart, apply user preferences, and add. On overrides (different brand/size than preference), call `instacart.update_preference({ field, key, from, to, reason: "pending" | "one_shot_confirm" | "manual" })`. After each material change, call `instacart.update_session({ patch: { cart: [...] } })`.

7. **Fulfillment.** Set delivery or pickup; pick a window. See `fulfillment.md`.

8. **Review — STOP.** Navigate to the review page. Extract the cart state (store, window, items, totals) via the `browser` tool. Present the summary to the user. Say:

   > "Cart is ready — **review and place it yourself on Instacart**."

   **Never click Place Order. Never call a tool to place an order — there is none.**

9. **Record.** Call `instacart.record_cart({ cart })` with the extracted state, then `instacart.end_session({ status: "handed_off" })`.

## Key rules

- **No Place Order path.** There is no tool, instruction, or helper in this skill that places the order. If asked, respond: *"I don't place orders — you do, in Instacart."*
- **Resume within 24 hours.** Before starting fresh, call `instacart.read_memory({ kind: "sessions" })`. If `current` exists and `last_updated` is within 24 hours, offer to resume.
- **Preference evolution is explicit.** One-shot changes use `reason: "one_shot_confirm"` or `"manual"`. Record-only overrides use `reason: "pending"` and are auto-promoted after 2 consecutive agreeing overrides.
- **Never log the login code.** Don't echo it in any message, tool log, or reply.
- **Captcha halts.** If a captcha or challenge appears, stop and tell the user.
- **DOM drift: stop loudly.** When selector ladders fail, say the UI may have changed; never click a random-looking button.

See `references/` for details.
