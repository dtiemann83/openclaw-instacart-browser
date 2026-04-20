# cart.md

## Search

1. Search input: `[data-testid="search-input"]`, fallback `input[placeholder*="Search"]`.
2. Submit with Enter or button `[data-testid="search-submit"]`.

## Disambiguation

Preference order when choosing a search result:

1. **Exact brand match** against `preferences.brands[key]`.
2. **Exact size match** against `preferences.sizes[key]`.
3. **Highest availability** — skip "Out of stock" cards.
4. Fallback: the first result that matches the normalized item name.

If none match well, ask the user instead of guessing.

## Adding

1. Add button: `[data-testid="add-item"]`, `button:has-text("Add")`, `button[aria-label*="Add"]`.
2. Qty stepper: `[data-testid="qty-increase"]` / `[data-testid="qty-decrease"]`.
3. After adding, confirm the cart icon increments (or poll `[data-testid="cart-count"]`).

## OOS / substitutions

If the card shows an OOS indicator or offers a substitution:

- If `preferences.substitutions.allow === false`: skip the item; note it in `session.flags.oos`.
- If `allow === true && ask_first === true`: ask the user about the offered sub.
- If `allow === true && ask_first === false`: accept the offered sub; record in `session.flags.substitutions`.

## Preference overrides

When the user picks something different from the preference:

```
instacart.update_preference({
  field: "brand",
  key: "<normalized item key>",
  from: "<previous pref>",
  to: "<new choice>",
  reason: "pending" | "one_shot_confirm" | "manual"
})
```

- `"pending"` — record to the streak buffer; the tool auto-promotes after 2 agreeing overrides.
- `"one_shot_confirm"` — user confirmed "remember this" inline.
- `"manual"` — user directly stated a preference, not in response to a cart action.

## Extracting cart state (mid-flow)

- Cart tray: `[data-testid="cart-tray"]` / `[aria-label="Cart"]`.
- Item rows: `[data-testid="cart-item"]`.
- Per row: name, qty, unit price, line total, size, substitution hint.

Prefer the review page for the final snapshot (see `review.md`); mid-flow extraction is only for progress updates.
