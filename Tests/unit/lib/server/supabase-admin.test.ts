const createClient = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

describe("Supabase request authentication", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    createClient.mockReset();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("creates and caches a non-persistent service-role client", async () => {
    const client = { auth: { getUser: jest.fn() } };
    createClient.mockReturnValue(client);
    const { getSupabaseAdmin } = await import("@/lib/server/supabase-admin");

    expect(getSupabaseAdmin()).toBe(client);
    expect(getSupabaseAdmin()).toBe(client);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it("rejects requests without a bearer token", async () => {
    const { requireUser, UnauthorizedError } = await import("@/lib/server/supabase-admin");
    const request = { headers: new Headers() };

    await expect(requireUser(request as never)).rejects.toEqual(
      new UnauthorizedError("Missing Authorization header"),
    );
  });

  it("returns the authenticated user id", async () => {
    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
    });
    const { requireUser } = await import("@/lib/server/supabase-admin");
    const request = {
      headers: new Headers({ Authorization: "Bearer valid-token" }),
    };

    await expect(requireUser(request as never)).resolves.toBe("user-123");
  });

  it("rejects invalid or expired sessions", async () => {
    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("expired"),
        }),
      },
    });
    const { requireUser } = await import("@/lib/server/supabase-admin");
    const request = {
      headers: new Headers({ Authorization: "Bearer expired-token" }),
    };

    await expect(requireUser(request as never)).rejects.toThrow(
      "Invalid or expired session",
    );
  });

  it("fails fast when server credentials are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getSupabaseAdmin } = await import("@/lib/server/supabase-admin");

    expect(() => getSupabaseAdmin()).toThrow("must be set");
  });
});
