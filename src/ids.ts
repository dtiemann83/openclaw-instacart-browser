import { randomUUID } from "node:crypto";
export function newCartId(): string { return `local_${randomUUID()}`; }
export function newSessionId(): string { return `sess_${randomUUID()}`; }
