# stores.md

## Enumerating retailers at the delivery address

1. Navigate to `https://www.instacart.com/store` (or follow the "Change address" affordance from the home page).
2. Extract the list: `[data-testid="retailer-card"]`, fallback `[class*="retailer"]` or aria-role=link with "Shop at" text.
3. For each card, capture:
   - `id`: the href segment, e.g. `/store/harris-teeter/storefront`
   - `name`: card title
   - `distanceMi`: numeric prefix of distance line, fallback undefined
   - `windows`: from card's "Delivery by …" microcopy (may be empty)

## Windows at the retailer level

- Open retailer storefront → "Change delivery" / "Change pickup" modal.
- List `[data-testid="delivery-window"]` entries; each has a date + time range.
- Extract as strings (`"Sat, Apr 18, 10:00 AM – 12:00 PM"`).

## Address-picker quirks

- Address autocomplete sometimes debounces; wait ~500ms after typing.
- "Use current location" requires OS permission — skip it and type the saved address.
- If the Instacart account has multiple addresses, prefer the one matching configured delivery (not in config yet — ask user once and stash as a preference override with `reason: "manual"`).

## Calling `instacart_rank_stores`

Pass the extracted candidates + current list keys (if known) + user preferences. Example:

```json
{
  "candidates": [
    { "id": "harris-teeter", "name": "Harris Teeter - Wake Forest", "distanceMi": 1.4, "windows": ["Sat 10–12"], "carries": ["milk","eggs"] },
    { "id": "publix", "name": "Publix - Wake Forest", "distanceMi": 2.8, "windows": ["Sat 12–2"] }
  ],
  "list": ["milk","eggs","bread"]
}
```

The tool returns `{ ranked, rationale }`. Present top 3 to the user with rationales.
