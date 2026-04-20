import type { Staple, Preferences, Cart } from "../memory/schemas.js";

export interface ListItem {
  name: string;
  qty: number;
  brand?: string;
  size?: string;
  notes?: string;
}

export interface ListSourceResult {
  items: ListItem[];
  origin: "adhoc" | "staples" | "repeat" | "recipes";
  notImplemented?: boolean;
}

export type { Staple, Preferences, Cart };
