# auth.md

## Logged-in indicator ladder

Try in order; stop at the first match:

1. `aria-label="Account menu"` — reliable.
2. `[data-testid="user-menu-trigger"]`
3. `nav button:has-text("Account")`
4. CSS: `header [data-qa="account-menu"]`

If none match after the page is loaded, treat as **not logged in**.

## Request-code selectors

1. Email field: `input[type="email"]`, `[data-testid="email-input"]`, `input[name="email"]`.
2. Continue/send code: `button:has-text("Continue")`, `[data-testid="send-code"]`.
3. Code field (after request): `input[autocomplete="one-time-code"]`, `input[inputmode="numeric"]`, `[data-testid="code-input"]`.
4. Submit: `button:has-text("Verify")`, `button[type="submit"]`, `[data-testid="verify-code"]`.

## Flow

1. Capture `requested_after = new Date().toISOString()` **before** clicking Continue.
2. Click Continue/send-code.
3. Call `instacart_resolve_login_code({ requested_after })`.
4. If `error === "timeout"`: try once more (click "resend code"), recapture `requested_after`, retry.
5. If the response returns a code, type it into the code field and submit.
6. Re-probe the logged-in indicator.

## Retry / timeout

- Default `timeout_ms` comes from plugin config (120_000). Don't exceed it.
- One resend attempt max. Then hand control back to the user: *"I couldn't get the code — want to paste it?"*

## Captcha

If any of these appear, **halt and message the user**. Do not attempt to solve.

- iframe from `hcaptcha.com`, `recaptcha.net`, `google.com/recaptcha`
- Text: "Verify you're a human", "Press and hold", "Complete the challenge"
- Any slider/puzzle element

## 2FA

If a second code field appears after login, repeat the auth sub-flow with a new `requested_after`.
