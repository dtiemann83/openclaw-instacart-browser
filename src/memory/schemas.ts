import { z } from "zod";

export const cartItemSchema = z.object({
  name: z.string(),
  brand: z.string().optional(),
  size: z.string().optional(),
  qty: z.number(),
  unit: z.string().optional(),
  price: z.number(),
  substituted_from: z.string().optional(),
  category: z.string().optional(),
}).strict();

export const cartSchema = z.object({
  cart_id: z.string(),
  built_at: z.string(),
  store: z.string(),
  store_id: z.string().optional(),
  fulfillment: z.object({
    type: z.enum(["delivery", "pickup"]),
    window: z.string(),
    window_start: z.string().optional(),
    window_end: z.string().optional(),
    address: z.string().optional(),
  }).strict(),
  items: z.array(cartItemSchema),
  subtotal: z.number().optional(),
  fees: z.number().optional(),
  tip: z.number().optional(),
  total: z.number().optional(),
  notes: z.string().optional(),
}).strict();

export const cartsFileSchema = z.object({ carts: z.array(cartSchema) }).strict();

export const stapleSchema = z.object({
  key: z.string(),
  display_name: z.string(),
  brand: z.string().optional(),
  size: z.string().optional(),
  typical_qty: z.number(),
  occurrences: z.number(),
  last_seen: z.string(),
  recency_rank: z.number(),
}).strict();

export const staplesFileSchema = z.object({
  staples: z.array(stapleSchema),
  computed_at: z.string(),
  normalizer_version: z.string(),
  config: z.object({
    minOccurrences: z.number().optional(),
    windowSize: z.number().optional(),
    maxAgeDays: z.number().optional(),
  }).strict(),
}).strict();

export const preferencesSchema = z.object({
  brands: z.record(z.string()),
  sizes: z.record(z.string()),
  stores: z.object({
    preferred: z.array(z.string()),
    avoid: z.array(z.string()),
  }).strict(),
  substitutions: z.object({
    allow: z.boolean(),
    ask_first: z.boolean(),
  }).strict(),
  dietary: z.object({
    restrictions: z.array(z.string()),
    notes: z.string(),
  }).strict(),
  updated_at: z.string(),
}).strict();

export const pendingOverrideSchema = z.object({
  suggested: z.string(),
  chosen: z.string(),
  at: z.string(),
}).strict();

export const historyEntrySchema = z.object({
  key: z.string(),
  field: z.enum(["brand", "size", "store"]),
  from: z.string(),
  to: z.string(),
  at: z.string(),
  reason: z.enum(["one_shot_confirm", "n_consistent_overrides", "manual"]),
}).strict();

export const preferenceOverridesSchema = z.object({
  pending: z.record(z.array(pendingOverrideSchema)),
  history: z.array(historyEntrySchema),
}).strict();

export const preferencesFileSchema = z.object({
  preferences: preferencesSchema,
  overrides: preferenceOverridesSchema,
}).strict();

export const substitutionFlagSchema = z.object({
  original: z.string(),
  offered: z.string(),
  accepted: z.boolean().optional(),
  decided_at: z.string().optional(),
}).strict();

export const sessionSchema = z.object({
  session_id: z.string(),
  started_at: z.string(),
  last_updated: z.string(),
  status: z.enum(["drafting", "reviewing", "handed_off", "abandoned"]),
  list_source: z.enum(["adhoc", "staples", "repeat", "recipes"]),
  list_source_ref: z.string().optional(),
  store: z.object({
    id: z.string().optional(),
    name: z.string(),
  }).strict().optional(),
  fulfillment: z.object({
    type: z.enum(["delivery", "pickup"]).optional(),
    window: z.string().optional(),
    window_start: z.string().optional(),
    window_end: z.string().optional(),
    address: z.string().optional(),
  }).strict().optional(),
  cart: z.array(cartItemSchema),
  flags: z.object({
    substitutions: z.array(substitutionFlagSchema).optional(),
    oos: z.array(z.string()).optional(),
  }).strict(),
  resume_hint: z.string().optional(),
}).strict();

export const sessionsFileSchema = z.object({
  current: sessionSchema.optional(),
  recent: z.array(sessionSchema),
}).strict();

export type Cart = z.infer<typeof cartSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type Staple = z.infer<typeof stapleSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type PreferenceOverrides = z.infer<typeof preferenceOverridesSchema>;
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SubstitutionFlag = z.infer<typeof substitutionFlagSchema>;
