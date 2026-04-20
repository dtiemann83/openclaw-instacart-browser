# fulfillment.md

## Choosing delivery vs pickup

1. Navigate to the fulfillment modal: "Checkout" → "Change delivery" / "Change pickup".
2. Toggle: `[data-testid="fulfillment-toggle"]`, fallback tabs with text "Delivery" / "Pickup".

## Picking a window

- Window list: `[data-testid="delivery-window"]` (delivery) or `[data-testid="pickup-window"]` (pickup).
- Each window exposes: date line + time range line.
- Preserve the shown format when recording (`"Sat, Apr 18, 10:00 AM – 12:00 PM"`).

## Record in session

After confirming a window:

```
instacart_update_session({
  patch: {
    fulfillment: {
      type: "delivery" | "pickup",
      window: "<as-shown>",
      window_start: "<ISO if parseable>",
      window_end: "<ISO if parseable>",
      address: "<only for delivery>"
    }
  }
})
```

## No windows

- If the list is empty, offer: another day, a different store, or pickup instead.
- Don't auto-pick — ask the user.
