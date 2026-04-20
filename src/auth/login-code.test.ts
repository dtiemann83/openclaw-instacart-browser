import { describe, it, expect, vi } from "vitest";
import { resolveLoginCode } from "./login-code.js";

type InboundMsg = { id: string; from: string; receivedAt: string; text: string };

function mockResend(messages: InboundMsg[]) {
  return {
    list: vi.fn(async () => messages.map((m) => ({ id: m.id, from: m.from, receivedAt: m.receivedAt }))),
    get: vi.fn(async (id: string) => {
      const m = messages.find((x) => x.id === id)!;
      return { id: m.id, from: m.from, receivedAt: m.receivedAt, text: m.text };
    }),
  };
}

describe("resolveLoginCode", () => {
  it("extracts 6-digit code matching senderPattern after requested_after", async () => {
    const resend = mockResend([
      { id: "m1", from: "auth@instacart.com", receivedAt: "2026-04-20T00:00:05Z", text: "Your code is 123456." },
    ]);
    const res = await resolveLoginCode({
      resend,
      requestedAfter: "2026-04-20T00:00:00Z",
      senderPattern: ".*@instacart\\.com$",
      codeRegex: "\\b(\\d{6})\\b",
      timeoutMs: 1000,
      pollIntervalMs: 10,
      now: () => Date.now(),
    });
    expect(res).toEqual({ ok: true, code: "123456", received_at: "2026-04-20T00:00:05Z" });
  });

  it("ignores mail from before requested_after", async () => {
    const resend = mockResend([
      { id: "m1", from: "auth@instacart.com", receivedAt: "2026-04-19T00:00:00Z", text: "Code 999999" },
    ]);
    const res = await resolveLoginCode({
      resend,
      requestedAfter: "2026-04-20T00:00:00Z",
      senderPattern: ".*@instacart\\.com$",
      codeRegex: "\\b(\\d{6})\\b",
      timeoutMs: 100,
      pollIntervalMs: 10,
      now: () => Date.now(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("timeout");
  });

  it("ignores mail from wrong sender", async () => {
    const resend = mockResend([
      { id: "m1", from: "spam@nope.com", receivedAt: "2026-04-20T00:00:05Z", text: "Code 123456" },
    ]);
    const res = await resolveLoginCode({
      resend,
      requestedAfter: "2026-04-20T00:00:00Z",
      senderPattern: ".*@instacart\\.com$",
      codeRegex: "\\b(\\d{6})\\b",
      timeoutMs: 100,
      pollIntervalMs: 10,
      now: () => Date.now(),
    });
    expect(res.ok).toBe(false);
  });

  it("never logs the code", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const resend = mockResend([
      { id: "m1", from: "auth@instacart.com", receivedAt: "2026-04-20T00:00:05Z", text: "Your code is 777777." },
    ]);
    await resolveLoginCode({
      resend,
      requestedAfter: "2026-04-20T00:00:00Z",
      senderPattern: ".*@instacart\\.com$",
      codeRegex: "\\b(\\d{6})\\b",
      timeoutMs: 1000,
      pollIntervalMs: 10,
      now: () => Date.now(),
    });
    for (const call of [...spy.mock.calls, ...errSpy.mock.calls]) {
      expect(JSON.stringify(call)).not.toContain("777777");
    }
    spy.mockRestore();
    errSpy.mockRestore();
  });
});
