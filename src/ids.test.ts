import { describe, it, expect } from "vitest";
import { newCartId, newSessionId } from "./ids.js";

describe("ids", () => {
  it("newCartId has local_ prefix and is unique", () => {
    const a = newCartId();
    const b = newCartId();
    expect(a.startsWith("local_")).toBe(true);
    expect(a).not.toBe(b);
  });

  it("newSessionId has sess_ prefix", () => {
    expect(newSessionId().startsWith("sess_")).toBe(true);
  });
});
