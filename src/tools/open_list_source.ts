import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import { openAdhoc } from "../listsource/adhoc.js";
import { openStaples } from "../listsource/staples.js";
import { openRepeat } from "../listsource/repeat.js";
import { openRecipes } from "../listsource/recipes.js";
import type { ListSourceResult } from "../listsource/types.js";

export const OpenListSourceInput = Type.Object({
  kind: Type.Union([
    Type.Literal("adhoc"),
    Type.Literal("staples"),
    Type.Literal("repeat"),
    Type.Literal("recipes"),
  ]),
  args: Type.Optional(Type.Object({
    items: Type.Optional(Type.Array(Type.Object({
      name: Type.String(),
      qty: Type.Optional(Type.Number()),
    }))),
    cart_id: Type.Optional(Type.String()),
  })),
});
export type OpenListSourceInputT = Static<typeof OpenListSourceInput>;

export async function runOpenListSource(
  deps: { store: MemoryStore },
  input: OpenListSourceInputT,
): Promise<ListSourceResult> {
  switch (input.kind) {
    case "adhoc": {
      const prefs = (await deps.store.readPreferences()).preferences;
      return openAdhoc({ items: input.args?.items ?? [], prefs });
    }
    case "staples": {
      const staplesFile = await deps.store.readStaples();
      return openStaples({ staples: staplesFile.staples });
    }
    case "repeat": {
      const carts = (await deps.store.readCarts()).carts;
      return openRepeat({ carts, ref: { cart_id: input.args?.cart_id ?? "last" } });
    }
    case "recipes":
      return openRecipes({ args: input.args ?? {} });
  }
}
