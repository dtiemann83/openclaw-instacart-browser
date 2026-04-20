# review.md

## The stop

This plugin **does not place orders**. At the review page you:

1. Extract the cart state.
2. Present it to the user.
3. Say exactly: *"Cart is ready. Review and place it yourself on Instacart."*
4. **Stop.** Do not click Place Order. Do not click any primary CTA on the review page.

## Extraction

Selector ladder:

- Container: `[data-testid="review-page"]`, `main:has-text("Review your order")`.
- Store: `[data-testid="store-name"]`.
- Fulfillment:
  - Type: `[data-testid="fulfillment-type"]` (text "Delivery" / "Pickup").
  - Window: `[data-testid="fulfillment-window"]`.
  - Address: `[data-testid="delivery-address"]` (delivery only).
- Items: `[data-testid="cart-item"]` with sub-selectors `item-name`, `item-size`, `item-qty`, `item-unit`, `item-price`.
- Totals: `[data-testid="subtotal"]`, `[data-testid="fees"]`, `[data-testid="total"]`.

The parser `src/parsers/cart-review.ts` handles this shape deterministically. If you have the page HTML, call it; otherwise drive the browser and mirror what the parser expects.

## What to say

Template:

> Cart is ready at **{store}** — **{fulfillment.type}** {fulfillment.window}{address ? " to " + address : ""}.
>
> **Items ({N}):**
> - {qty}× {name}{size ? " (" + size + ")" : ""} — ${price}
> ...
>
> Subtotal: ${subtotal}. Fees: ${fees}. Total: ${total}.
>
> **Review and place it yourself on Instacart.** I'll stop here.

## Recording

After presenting:

```
instacart_record_cart({ cart: <extracted snapshot> })
instacart_end_session({ status: "handed_off" })
```

## What NOT to do

- Never click `button:has-text("Place Order")`, `[data-testid="place-order"]`, or the primary CTA on the review page.
- If the user says "yeah go ahead place it" — decline: *"I don't place orders. You'll need to click Place Order yourself."*
- If you think you're on the review page but none of the selectors resolve, **stop and report** — don't keep clicking.
