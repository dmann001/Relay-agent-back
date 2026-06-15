import {
  exchangeOutlookCode,
  isOutlookGuestProfile,
  OutlookOAuthError,
  validateOutlookOAuthConfig,
} from "@/lib/server/outlook-accounts";

describe("Outlook OAuth accounts", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      MICROSOFT_CLIENT_ID: "client-id",
      MICROSOFT_CLIENT_SECRET: "client-secret-value",
      MICROSOFT_REDIRECT_URI: "http://localhost:3000/api/auth/outlook/callback",
    };
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("requires the client secret before starting OAuth", () => {
    delete process.env.MICROSOFT_CLIENT_SECRET;

    expect(validateOutlookOAuthConfig).toThrow(
      expect.objectContaining({ code: "outlook_not_configured" }),
    );
  });

  it("maps AADSTS7000215 to an actionable error code", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "invalid_client",
        error_description: "AADSTS7000215: Invalid client secret provided.",
        error_codes: [7000215],
      }),
    });

    const error = await exchangeOutlookCode("code").catch((caught) => caught);

    expect(error).toBeInstanceOf(OutlookOAuthError);
    expect(error).toMatchObject({ code: "invalid_client_secret" });
  });

  it("detects Entra guest identities that do not represent the home mailbox", () => {
    expect(isOutlookGuestProfile({
      userPrincipalName: "person_outlook.com#EXT#@tenant.onmicrosoft.com",
    })).toBe(true);
    expect(isOutlookGuestProfile({
      userType: "Guest",
      userPrincipalName: "person@company.com",
    })).toBe(true);
    expect(isOutlookGuestProfile({
      userType: "Member",
      userPrincipalName: "person@outlook.com",
    })).toBe(false);
  });
});
