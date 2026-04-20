export interface ResendInboundSummary {
  id: string;
  from: string;
  receivedAt: string;
}
export interface ResendInboundFull extends ResendInboundSummary {
  text: string;
}
export interface ResendClient {
  list: () => Promise<ResendInboundSummary[]>;
  get: (id: string) => Promise<ResendInboundFull>;
}

export interface ResolveInput {
  resend: ResendClient;
  requestedAfter: string;        // ISO
  senderPattern: string;         // regex
  codeRegex: string;             // regex with first capture = code
  timeoutMs: number;
  pollIntervalMs: number;
  now?: () => number;
}

export type ResolveResult =
  | { ok: true;  code: string;  received_at: string }
  | { ok: false; error: "timeout" | "not_found" };

export async function resolveLoginCode(input: ResolveInput): Promise<ResolveResult> {
  const now = input.now ?? (() => Date.now());
  const deadline = now() + input.timeoutMs;
  const senderRe = new RegExp(input.senderPattern);
  const codeRe = new RegExp(input.codeRegex);
  const afterMs = Date.parse(input.requestedAfter);
  const seen = new Set<string>();

  while (now() < deadline) {
    const list = await input.resend.list();
    const candidates = list
      .filter((m) => !seen.has(m.id))
      .filter((m) => Date.parse(m.receivedAt) >= afterMs)
      .filter((m) => senderRe.test(m.from));

    for (const summary of candidates) {
      seen.add(summary.id);
      const full = await input.resend.get(summary.id);
      const match = full.text.match(codeRe);
      if (match && match[1]) {
        return { ok: true, code: match[1], received_at: full.receivedAt };
      }
    }

    await sleep(input.pollIntervalMs);
  }
  return { ok: false, error: "timeout" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
