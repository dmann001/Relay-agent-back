import {
  decodeEmailListCursor,
  encodeEmailListCursor,
} from "@/lib/server/email-pagination";

describe("email list cursor helpers", () => {
  it("round-trips a received timestamp and provider message id", () => {
    const cursor = {
      receivedAt: "2026-06-24T15:30:00.000Z",
      providerMessageId: "message-123",
    };

    expect(decodeEmailListCursor(encodeEmailListCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed or incomplete cursor values", () => {
    expect(decodeEmailListCursor(null)).toBeNull();
    expect(decodeEmailListCursor("not-base64-json")).toBeNull();
    expect(
      decodeEmailListCursor(
        Buffer.from(JSON.stringify({ receivedAt: "nope", providerMessageId: "m1" })).toString("base64url"),
      ),
    ).toBeNull();
    expect(
      decodeEmailListCursor(
        Buffer.from(JSON.stringify({ receivedAt: "2026-06-24T15:30:00.000Z" })).toString("base64url"),
      ),
    ).toBeNull();
  });
});
