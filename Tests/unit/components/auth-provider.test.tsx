/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/components/auth-provider";

const replace = jest.fn();
const getSession = jest.fn();
const signOut = jest.fn();
const unsubscribe = jest.fn();
let pathname = "/inbox";

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));

jest.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe } },
      })),
      signOut: (...args: unknown[]) => signOut(...args),
    },
  },
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    replace.mockReset();
    getSession.mockReset();
    pathname = "/inbox";
  });

  it("redirects unauthenticated users away from protected routes", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <div>Protected content</div>
      </AuthProvider>,
    );

    expect(screen.getByText("Loading session...")).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("renders protected content for an authenticated session", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-123" } } },
      error: null,
    });

    render(
      <AuthProvider>
        <div>Protected content</div>
      </AuthProvider>,
    );

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalledWith("/login");
  });

  it("redirects authenticated users away from public auth pages", async () => {
    pathname = "/login";
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-123" } } },
      error: null,
    });

    render(
      <AuthProvider>
        <div>Login</div>
      </AuthProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/inbox"));
  });
});
