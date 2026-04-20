import { Type, type Static } from "@sinclair/typebox";
import type { InstacartConfig } from "../config.js";
import { resolveLoginCode, type ResendClient } from "../auth/login-code.js";

export const ResolveLoginCodeInput = Type.Object({
  requested_after: Type.String({ description: "ISO-8601 timestamp; codes received before this are ignored." }),
  timeout_ms: Type.Optional(Type.Number()),
});
export type ResolveLoginCodeInputT = Static<typeof ResolveLoginCodeInput>;

export interface ResolveLoginCodeDeps {
  resend: ResendClient;
  config: InstacartConfig;
}

export async function runResolveLoginCode(
  deps: ResolveLoginCodeDeps,
  input: ResolveLoginCodeInputT,
): Promise<{ code?: string; received_at?: string; error?: "timeout" | "not_found" }> {
  const cfg = deps.config.auth;
  const res = await resolveLoginCode({
    resend: deps.resend,
    requestedAfter: input.requested_after,
    senderPattern: cfg.senderPattern,
    codeRegex: cfg.codeRegex,
    timeoutMs: input.timeout_ms ?? cfg.timeoutMs,
    pollIntervalMs: cfg.pollIntervalMs,
  });
  if (res.ok) return { code: res.code, received_at: res.received_at };
  return { error: res.error };
}
