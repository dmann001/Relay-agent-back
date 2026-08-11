import { handleApiError } from "@/lib/server/api-utils";
import { UnauthorizedError } from "@/lib/server/supabase-admin";

describe("API error mapping", () => {
  it.each([
    [new UnauthorizedError("Missing Authorization header"), 401, "UNAUTHORIZED"],
    [{ code: 401 }, 401, "AUTH_EXPIRED"],
    [new Error("invalid_grant"), 401, "AUTH_EXPIRED"],
    [{ response: { status: 403 } }, 403, "GMAIL_FORBIDDEN"],
    [new Error("Gmail API has not been used in this project"), 403, "GMAIL_FORBIDDEN"],
  ])("maps known errors to stable responses", async (error, status, code) => {
    const response = handleApiError(error);
    await expect(response.json()).resolves.toMatchObject({ code });
    expect(response.status).toBe(status);
  });

  it("does not expose more than the available error message", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const response = handleApiError(new Error("database unavailable"));

    await expect(response.json()).resolves.toEqual({ error: "database unavailable" });
    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("uses a safe fallback for errors without a message", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const response = handleApiError({});

    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
    expect(response.status).toBe(500);
    consoleError.mockRestore();
  });
});
