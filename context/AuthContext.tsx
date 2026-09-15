'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  type AdminPermission,
  hasPermissionForRole,
  normalizeAdminRole,
  type CanonicalAdminRole,
} from '@/lib/auth/admin-rbac';
import type { User as SupabaseUser, AuthError } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: CanonicalAdminRole | null;
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: AdminPermission) => boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
  bootstrapUser?: User | null;
}

type BrowserSupabaseClient = ReturnType<typeof createClient>;
interface ActiveUserResolution {
  epoch: number;
  promise: Promise<User | null>;
}

export const INITIAL_SESSION_FALLBACK_DELAY_MS = 50;
export const SESSION_LOOKUP_TIMEOUT_MS = 3_000;

// ============================================================================
// Helpers
// ============================================================================

async function extractUserFromSupabaseUser(
  supabase: BrowserSupabaseClient,
  supabaseUser: SupabaseUser
): Promise<User | null> {
  const metadata = supabaseUser.user_metadata || {};
  const fallbackName =
    metadata.name || metadata.full_name || supabaseUser.email?.split('@')[0] || 'User';
  let name = fallbackName;

  try {
    const { data: admin } = await supabase
      .from('admins')
      .select('name, role')
      .eq('id', supabaseUser.id)
      .maybeSingle();

    const role = normalizeAdminRole(admin?.role);

    if (!admin || !role) {
      return null;
    }

    name = admin?.name || fallbackName;

    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name,
      role,
    };
  } catch (error) {
    console.error('Error resolving admin access from database:', error);
    return null;
  }
}

/**
 * Map Supabase auth errors to user-friendly messages
 */
function getAuthErrorMessage(error: AuthError): string {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Invalid email or password';
    case 'Email not confirmed':
      return 'Please verify your email address';
    case 'User not found':
      return 'No account found with this email';
    case 'Too many requests':
      return 'Too many login attempts. Please try again later';
    default:
      return error.message || 'An unexpected error occurred';
  }
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

export function AuthProvider({ children, bootstrapUser = null }: AuthProviderProps) {
  const bootstrapUserRef = useRef<User | null>(bootstrapUser);
  const hasBootstrapUser = bootstrapUserRef.current?.role != null;
  const authEpochRef = useRef(0);
  const mountedRef = useRef(false);
  const activeUserResolutionRef = useRef<ActiveUserResolution | null>(null);
  const pendingUserResolutionsRef = useRef(
    new Map<string, Promise<User | null>>()
  );
  const [supabase] = useState(createClient);
  const [user, setUser] = useState<User | null>(() => bootstrapUserRef.current);
  const userRef = useRef<User | null>(bootstrapUserRef.current);
  const [isLoading, setIsLoading] = useState(() => !hasBootstrapUser);
  const isAuthenticated = user?.role != null;

  const advanceAuthEpoch = useCallback(() => {
    activeUserResolutionRef.current = null;
    authEpochRef.current += 1;
    return authEpochRef.current;
  }, []);

  const commitAuthState = useCallback((
    epoch: number,
    nextUser: User | null,
    finishLoading = true
  ) => {
    if (!mountedRef.current || epoch !== authEpochRef.current) {
      return false;
    }

    userRef.current = nextUser;
    setUser(nextUser);
    if (finishLoading) {
      setIsLoading(false);
    }
    return true;
  }, []);

  const resolveSupabaseUser = useCallback((
    supabaseUser: SupabaseUser,
    reusePending = false
  ) => {
    if (reusePending) {
      const pendingResolution = pendingUserResolutionsRef.current.get(
        supabaseUser.id
      );
      if (pendingResolution) {
        return pendingResolution;
      }
    }

    const resolution = extractUserFromSupabaseUser(supabase, supabaseUser);
    pendingUserResolutionsRef.current.set(supabaseUser.id, resolution);
    void resolution.finally(() => {
      if (
        pendingUserResolutionsRef.current.get(supabaseUser.id) === resolution
      ) {
        pendingUserResolutionsRef.current.delete(supabaseUser.id);
      }
    });
    return resolution;
  }, [supabase]);

  const resolveUserAtEpoch = useCallback((
    supabaseUser: SupabaseUser,
    epoch: number,
    reusePending = false
  ): Promise<User | null> => {
    const promise = (async () => {
      const resolvedUser = await resolveSupabaseUser(supabaseUser, reusePending);
      const bootstrapUserForIdentity =
        bootstrapUserRef.current?.id === supabaseUser.id
          ? bootstrapUserRef.current
          : null;
      const nextUser = resolvedUser ?? bootstrapUserForIdentity;

      commitAuthState(epoch, nextUser);
      return nextUser;
    })();

    activeUserResolutionRef.current = { epoch, promise };
    return promise;
  }, [commitAuthState, resolveSupabaseUser]);

  const awaitSupersedingResolution = useCallback(async (
    supersededEpoch: number
  ): Promise<{ user: User | null; resolutionObserved: boolean }> => {
    let observedEpoch = supersededEpoch;

    while (mountedRef.current && observedEpoch !== authEpochRef.current) {
      observedEpoch = authEpochRef.current;
      const activeResolution = activeUserResolutionRef.current;

      if (!activeResolution || activeResolution.epoch !== observedEpoch) {
        return {
          user: userRef.current,
          resolutionObserved: false,
        };
      }

      const resolvedUser = await activeResolution.promise;
      if (!mountedRef.current) {
        return { user: null, resolutionObserved: false };
      }

      if (activeResolution.epoch === authEpochRef.current) {
        return {
          user: resolvedUser,
          resolutionObserved: true,
        };
      }
    }

    return {
      user: userRef.current,
      resolutionObserved: false,
    };
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    // Skip on server
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    mountedRef.current = true;

    // Listen for auth state changes
    let subscription: { unsubscribe: () => void } | null = null;
    let initialSessionReceived = false;
    let fallbackTimer: number | null = null;
    let fallbackTimeout: number | null = null;
    
    try {
      const { data } = supabase.auth.onAuthStateChange(
        (event, session) => {
          const isUserBearingEvent =
            event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'USER_UPDATED';
          const isInitialSession = event === 'INITIAL_SESSION';
          if (isInitialSession) {
            initialSessionReceived = true;
            if (fallbackTimer !== null) {
              window.clearTimeout(fallbackTimer);
              fallbackTimer = null;
            }
          }
          const epoch = advanceAuthEpoch();

          if (event === 'SIGNED_OUT') {
            commitAuthState(epoch, null);
            return;
          }

          if ((isUserBearingEvent || isInitialSession) && session?.user) {
            void resolveUserAtEpoch(
              session.user,
              epoch,
              isInitialSession
            );
            return;
          }

          if (isInitialSession) {
            commitAuthState(epoch, hasBootstrapUser ? userRef.current : null);
          }
        }
      );
      subscription = data.subscription;
    } catch (error) {
      console.error('Error setting up auth listener:', error);
    }

    const initializeFromSessionFallback = async () => {
      if (initialSessionReceived) {
        return;
      }

      const epoch = advanceAuthEpoch();
      fallbackTimeout = window.setTimeout(() => {
        commitAuthState(epoch, userRef.current);
      }, SESSION_LOOKUP_TIMEOUT_MS);

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mountedRef.current || epoch !== authEpochRef.current) {
          return;
        }

        if (session?.user) {
          await resolveUserAtEpoch(session.user, epoch, true);
        } else {
          commitAuthState(epoch, hasBootstrapUser ? userRef.current : null);
        }
      } catch (error) {
        if (!mountedRef.current || epoch !== authEpochRef.current) {
          return;
        }

        console.error('Error initializing auth:', error);
        commitAuthState(epoch, hasBootstrapUser ? userRef.current : null);
      } finally {
        if (fallbackTimeout !== null) {
          window.clearTimeout(fallbackTimeout);
          fallbackTimeout = null;
        }
        commitAuthState(epoch, userRef.current);
      }
    };

    fallbackTimer = window.setTimeout(() => {
      fallbackTimer = null;
      void initializeFromSessionFallback();
    }, INITIAL_SESSION_FALLBACK_DELAY_MS);

    // Cleanup subscription on unmount
    return () => {
      mountedRef.current = false;
      advanceAuthEpoch();
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
      if (fallbackTimeout !== null) {
        window.clearTimeout(fallbackTimeout);
      }
      subscription?.unsubscribe();
    };
  }, [
    advanceAuthEpoch,
    commitAuthState,
    hasBootstrapUser,
    resolveUserAtEpoch,
    supabase,
  ]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const loginEpoch = advanceAuthEpoch();
    const canceledResult: LoginResult = {
      success: false,
      error: 'Unable to sign in. Please try again.',
    };

    const rejectAdminLogin = async (): Promise<LoginResult> => {
      const signOutEpoch = advanceAuthEpoch();

      try {
        await supabase.auth.signOut();
      } finally {
        commitAuthState(signOutEpoch, null);
      }

      return {
        success: false,
        error: 'Akun ini tidak memiliki akses admin.',
      };
    };

    const resultFromSupersedingAuth = async (): Promise<LoginResult> => {
      const { user: supersedingUser, resolutionObserved } =
        await awaitSupersedingResolution(loginEpoch);

      if (supersedingUser?.role) {
        return { success: true };
      }

      return resolutionObserved ? rejectAdminLogin() : canceledResult;
    };

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!mountedRef.current || loginEpoch !== authEpochRef.current) {
        return resultFromSupersedingAuth();
      }

      if (error) {
        return {
          success: false,
          error: getAuthErrorMessage(error),
        };
      }

      if (data.user) {
        const resolvedUser = await resolveSupabaseUser(data.user);

        if (!mountedRef.current || loginEpoch !== authEpochRef.current) {
          return resultFromSupersedingAuth();
        }

        if (!resolvedUser) {
          return rejectAdminLogin();
        }

        commitAuthState(loginEpoch, resolvedUser, false);
        return { success: true }; 
      }

      return {
        success: false,
        error: 'Unable to sign in. Please try again.',
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'A network error occurred. Please check your connection.',
      };
    }
  }, [
    advanceAuthEpoch,
    awaitSupersedingResolution,
    commitAuthState,
    resolveSupabaseUser,
    supabase,
  ]);

  const logout = useCallback(async (): Promise<void> => {
    const epoch = advanceAuthEpoch();

    try {
      await supabase.auth.signOut();
      commitAuthState(epoch, null);
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if the API call fails
      commitAuthState(epoch, null);
    }
  }, [advanceAuthEpoch, commitAuthState, supabase]);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    hasPermission: (permission) => hasPermissionForRole(user?.role, permission),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
