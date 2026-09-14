import { act, render, screen, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useEffect } from "react";
import {
  AuthProvider,
  type LoginResult,
  useAuth,
} from "@/context/AuthContext";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

type AdminLookupResult = {
  data: { name: string; role: string } | null;
};

const mocks = vi.hoisted(() => ({
  adminLookups: [] as Array<Promise<AdminLookupResult>>,
  authCallback: null as
    | ((event: AuthChangeEvent, session: Session | null) => void)
    | null,
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
    from: mocks.from,
  }),
}));

vi.mock("@/lib/auth/admin-rbac", () => ({
  hasPermissionForRole: vi.fn(() => false),
  normalizeAdminRole: vi.fn((role) => role ?? null),
}));

const supabaseUser = (id: string, email = `${id}@kalanara.com`) =>
  ({
    id,
    email,
    user_metadata: {},
  }) as Session["user"];

const sessionFor = (id: string, email?: string) =>
  ({ user: supabaseUser(id, email) }) as Session;

let latestAuth: ReturnType<typeof useAuth> | null = null;

function AuthStateProbe() {
  const auth = useAuth();

  useEffect(() => {
    latestAuth = auth;
  }, [auth]);

  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="user-id">{auth.user?.id ?? "none"}</span>
      <span data-testid="user-name">{auth.user?.name ?? "none"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestAuth = null;
    mocks.adminLookups.length = 0;
    mocks.authCallback = null;
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(
            () =>
              mocks.adminLookups.shift() ??
              Promise.resolve({ data: null }),
          ),
        })),
      })),
    }));
    mocks.onAuthStateChange.mockImplementation((callback) => {
      mocks.authCallback = callback;
      return {
      data: {
        subscription: {
            unsubscribe: mocks.unsubscribe,
        },
      },
      };
    });
  });

  it("keeps unauthenticated visitors signed out after auth initialization", async () => {
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("hydrates protected admin auth from bootstrap user before client session resolves", async () => {
    render(
      <AuthProvider
        bootstrapUser={{
          id: "admin-1",
          email: "admin@kalanara.com",
          name: "Admin",
          role: "SUPER_ADMIN",
        }}
      >
        <AuthStateProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
  });

  it("finishes initialization when INITIAL_SESSION reports no user", async () => {
    const initialSession = deferred<{ data: { session: Session | null } }>();
    mocks.getSession.mockReturnValue(initialSession.promise);

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    act(() => {
      mocks.authCallback?.("INITIAL_SESSION", null);
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");

    await act(async () => {
      initialSession.resolve({
        data: { session: sessionFor("stale-bootstrap-admin") },
      });
      await initialSession.promise;
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("resolves the INITIAL_SESSION user and ignores the stale bootstrap result", async () => {
    const initialSession = deferred<{ data: { session: Session | null } }>();
    const initialLookup = deferred<AdminLookupResult>();
    mocks.getSession.mockReturnValue(initialSession.promise);
    mocks.adminLookups.push(initialLookup.promise);

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    act(() => {
      mocks.authCallback?.(
        "INITIAL_SESSION",
        sessionFor("initial-session-admin")
      );
    });
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));

    await act(async () => {
      initialSession.resolve({ data: { session: null } });
      initialLookup.resolve({ data: { name: "Admin Awal", role: "MANAGER" } });
      await Promise.all([initialSession.promise, initialLookup.promise]);
    });

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("user-id")).toHaveTextContent(
      "initial-session-admin"
    );
    expect(screen.getByTestId("user-name")).toHaveTextContent("Admin Awal");
  });

  it("does not let a late bootstrap admin lookup undo a newer sign-out", async () => {
    const lookup = deferred<AdminLookupResult>();
    mocks.adminLookups.push(lookup.promise);
    mocks.getSession.mockResolvedValue({
      data: { session: sessionFor("bootstrap-admin") },
    });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));

    act(() => {
      mocks.authCallback?.("SIGNED_OUT", null);
    });

    await act(async () => {
      lookup.resolve({ data: { name: "Admin Lama", role: "SUPER_ADMIN" } });
      await lookup.promise;
    });

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user-id")).toHaveTextContent("none");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("keeps the latest user-bearing event when lookups resolve in reverse order", async () => {
    const firstLookup = deferred<AdminLookupResult>();
    const secondLookup = deferred<AdminLookupResult>();

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    );

    mocks.adminLookups.push(firstLookup.promise, secondLookup.promise);
    act(() => {
      mocks.authCallback?.("SIGNED_IN", sessionFor("admin-1"));
      mocks.authCallback?.("USER_UPDATED", sessionFor("admin-2"));
    });

    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(2));

    await act(async () => {
      secondLookup.resolve({ data: { name: "Admin Terbaru", role: "MANAGER" } });
      await secondLookup.promise;
    });
    expect(screen.getByTestId("user-id")).toHaveTextContent("admin-2");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Admin Terbaru");

    await act(async () => {
      firstLookup.resolve({ data: { name: "Admin Lama", role: "SUPER_ADMIN" } });
      await firstLookup.promise;
    });
    expect(screen.getByTestId("user-id")).toHaveTextContent("admin-2");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Admin Terbaru");
  });

  it("unsubscribes when the provider unmounts during a pending lookup", async () => {
    const lookup = deferred<AdminLookupResult>();
    mocks.adminLookups.push(lookup.promise);
    mocks.getSession.mockResolvedValue({
      data: { session: sessionFor("pending-admin") },
    });

    const { unmount } = render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);

    await act(async () => {
      lookup.resolve({ data: { name: "Terlambat", role: "STAFF" } });
      await lookup.promise;
    });
  });

  it("does not let a late login resolution restore state after logout", async () => {
    const loginLookup = deferred<AdminLookupResult>();
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: supabaseUser("login-admin") },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    );
    mocks.adminLookups.push(loginLookup.promise);

    let loginPromise!: Promise<LoginResult>;
    act(() => {
      loginPromise = latestAuth!.login("admin@kalanara.com", "secret");
    });
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));

    await act(async () => {
      await latestAuth!.logout();
    });

    let result!: LoginResult;
    await act(async () => {
      loginLookup.resolve({ data: { name: "Admin", role: "SUPER_ADMIN" } });
      result = await loginPromise;
    });

    expect(result.success).toBe(false);
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user-id")).toHaveTextContent("none");
  });

  it("lets login follow the newer matching signed-in event resolution", async () => {
    const signIn = deferred<{
      data: { user: Session["user"] };
      error: null;
    }>();
    const eventLookup = deferred<AdminLookupResult>();
    const user = supabaseUser("event-admin");
    mocks.signInWithPassword.mockReturnValue(signIn.promise);

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    );

    let loginPromise!: Promise<LoginResult>;
    act(() => {
      loginPromise = latestAuth!.login("admin@kalanara.com", "secret");
    });

    mocks.adminLookups.push(eventLookup.promise);
    act(() => {
      mocks.authCallback?.("SIGNED_IN", sessionFor(user.id, user.email));
    });
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));

    await act(async () => {
      signIn.resolve({ data: { user }, error: null });
      await signIn.promise;
    });

    let result!: LoginResult;
    await act(async () => {
      eventLookup.resolve({ data: { name: "Admin Event", role: "MANAGER" } });
      result = await loginPromise;
    });

    expect(result).toEqual({ success: true });
    expect(screen.getByTestId("user-id")).toHaveTextContent("event-admin");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Admin Event");
  });

  it("does not chase another generation while awaiting a matching login event", async () => {
    const signIn = deferred<{
      data: { user: Session["user"] };
      error: null;
    }>();
    const firstEventLookup = deferred<AdminLookupResult>();
    const secondEventLookup = deferred<AdminLookupResult>();
    const user = supabaseUser("event-admin");
    mocks.signInWithPassword.mockReturnValue(signIn.promise);

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    );

    let loginPromise!: Promise<LoginResult>;
    act(() => {
      loginPromise = latestAuth!.login("admin@kalanara.com", "secret");
    });

    mocks.adminLookups.push(firstEventLookup.promise, secondEventLookup.promise);
    act(() => {
      mocks.authCallback?.("SIGNED_IN", sessionFor(user.id, user.email));
    });
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));

    await act(async () => {
      signIn.resolve({ data: { user }, error: null });
      await signIn.promise;
    });

    act(() => {
      mocks.authCallback?.("USER_UPDATED", sessionFor(user.id, user.email));
    });
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(2));

    let result!: LoginResult;
    await act(async () => {
      firstEventLookup.resolve({ data: { name: "Admin Lama", role: "MANAGER" } });
      result = await loginPromise;
    });

    expect(result.success).toBe(false);

    await act(async () => {
      secondEventLookup.resolve({
        data: { name: "Admin Terbaru", role: "SUPER_ADMIN" },
      });
      await secondEventLookup.promise;
    });

    expect(screen.getByTestId("user-name")).toHaveTextContent("Admin Terbaru");
  });
});
