import {
  createOAuthState,
  decryptSecret,
  decryptSecretOrPassthrough,
  encryptSecret,
  parseOAuthState,
} from "@/lib/server/crypto";

describe("server-side secret encryption", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, TOKEN_ENCRYPTION_KEY: "test-key-with-enough-entropy" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("round-trips encrypted secrets with randomized ciphertext", () => {
    const first = encryptSecret("gmail-access-token");
    const second = encryptSecret("gmail-access-token");

    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("gmail-access-token");
    expect(decryptSecret(second)).toBe("gmail-access-token");
  });

  it("rejects malformed and tampered ciphertext", () => {
    expect(() => decryptSecret("plaintext")).toThrow("Invalid encrypted payload");

    const encrypted = encryptSecret("secret");
    const tampered = `${encrypted.slice(0, -2)}aa`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("supports legacy plaintext values", () => {
    expect(decryptSecretOrPassthrough("legacy-token")).toBe("legacy-token");
    expect(decryptSecretOrPassthrough(encryptSecret("encrypted-token"))).toBe(
      "encrypted-token",
    );
  });

  it("binds OAuth state to a user and rejects expired state", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    const state = createOAuthState("user-123");

    expect(parseOAuthState(state)).toEqual({ userId: "user-123" });

    now.mockReturnValue(1_000_000 + 16 * 60 * 1000);
    expect(() => parseOAuthState(state)).toThrow("OAuth state expired or invalid");
    now.mockRestore();
  });

  it("round-trips complete OAuth context and rejects a missing user", () => {
    const state = createOAuthState("user-123", {
      purpose: "calendar",
      accountId: "account-1",
      provider: "outlook",
    });
    expect(parseOAuthState(state)).toMatchObject({
      userId: "user-123",
      purpose: "calendar",
      accountId: "account-1",
      provider: "outlook",
    });

    const invalid = encodeURIComponent(
      encryptSecret(JSON.stringify({ issuedAt: Date.now() })),
    );
    expect(() => parseOAuthState(invalid)).toThrow("OAuth state expired or invalid");
  });

  it("falls back to SESSION_SECRET", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    process.env.SESSION_SECRET = "session-secret";
    expect(decryptSecret(encryptSecret("secret"))).toBe("secret");
  });

  it("requires an encryption key", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.SESSION_SECRET;
    expect(() => encryptSecret("secret")).toThrow("TOKEN_ENCRYPTION_KEY");
  });
});
