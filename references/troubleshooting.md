# troubleshooting.md

## Session expired mid-flow

- Symptom: login-modal elements reappear or a 401 redirect occurs.
- Action: pause, run the auth sub-flow (`references/auth.md`) with a fresh `requested_after`.
- After re-auth: **re-extract the cart state from Instacart** and reconcile with `sessions.json.current.cart`. Instacart's server typically preserves the cart but don't assume — compare and fix discrepancies before continuing.

## Captcha

**Halt.** Tell the user; never auto-solve. See `auth.md` for detection.

## 2FA

Separate code field after login → repeat the auth sub-flow.

## Item not found

- Symptom: empty results.
- Action: ask the user for an alternative name, or skip and note in `session.flags.oos`.

## Out of stock

See `cart.md` — honor `preferences.substitutions`.

## No windows

- Offer: another day, another store, or pickup instead.
- Don't auto-pick.

## Rate limiting

- Symptom: 429-style UI or persistent errors.
- Action: back off with jitter (1s, 2s, 4s), cap at 3 retries.
- If still failing: stop and report.

## DOM drift

- Symptom: selector ladder exhausted.
- Action: log URL + accessible tree (via `browser` tool's accessibility snapshot), then stop. Tell the user the UI may have changed; suggest they file an issue in `@dtiemann/openclaw-instacart-browser`.

## Duplicate current session

- Symptom: `sessions.json.current` exists on a new "let's do groceries" invocation.
- If `last_updated` is within 24 hours: offer to resume.
- Else: `start_session` auto-rotates it to `recent[]` as `abandoned`.

## resend skill missing

- Symptom: plugin load fails with "host does not expose a way to call the resend skill".
- Fix: `openclaw skills install resend` (or check `~/.openclaw/openclaw.json.plugins.entries.resend.enabled`).

## Browser tool not attached

- Symptom: CDP attach errors.
- Fix: check `~/.openclaw/openclaw.json.browser.profiles.openclaw.cdpPort` (18800) and that Chrome is running with `--remote-debugging-port=18800`, or set `attachOnly: false` for the session to have the tool launch Chrome itself.
