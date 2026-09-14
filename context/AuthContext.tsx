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
type AuthOperationKind =
  | 'auth-event'
  | 'bootstrap'
  | 'login'
  | 'logout'
  | 'signed-out'
  | 'user-event'
  | 'cleanup';

interface AuthOperation {
  generation: number;
  kind: AuthOperationKind;
  userId?: string;
  resolution?: Promise<User | null>;
}

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
  const authGenerationRef = useRef(0);
  const authActiveRef = useRef(false);
  const latestAuthOperationRef = useRef<AuthOperation | null>(null);
  const [supabase] = useState(createClient);
  const [user, setUser] = useState<User | null>(() => bootstrapUserRef.current);
  const [isLoading, setIsLoading] = useState(() => !hasBootstrapUser);
  const isAuthenticated = user?.role != null;

  const beginAuthOperation = useCallback((
    kind: AuthOperationKind,
    userId?: string
  ): AuthOperation => {
    const operation = {
      generation: ++authGenerationRef.current,
      kind,
      userId,
    };
    latestAuthOperationRef.current = operation;
    return operation;
  }, []);

  const isCurrentAuthOperation = useCallback(
    (operation: AuthOperation) =>
      authActiveRef.current &&
      operation.generation === authGenerationRef.current,
    []
  );

  const commitSignedOut = useCallback((operation: AuthOperation) => {
    if (!isCurrentAuthOperation(operation)) {
      return;
    }

    setUser(null);
    setIsLoading(false);
  }, [isCurrentAuthOperation]);

  const resolveUserForOperation = useCallback(async (
    supabaseUser: SupabaseUser,
    operation: AuthOperation
  ): Promise<User | null> => {
    const resolvedUser = await extractUserFromSupabaseUser(supabase, supabaseUser);
    const nextUser = resolvedUser ?? bootstrapUserRef.current;

    if (isCurrentAuthOperation(operation)) {
      setUser(nextUser);
      setIsLoading(false);
    }

    return nextUser;
  }, [isCurrentAuthOperation, supabase]);

  // Initialize auth state on mount
  useEffect(() => {
    // Skip on server
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    authActiveRef.current = true;

    // Get initial session
    const initializeAuth = async () => {
      const operation = beginAuthOperation('bootstrap');

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isCurrentAuthOperation(operation)) {
          return;
        }

        if (session?.user) {
          await resolveUserForOperation(session.user, operation);
        } else if (!hasBootstrapUser) {
          setUser(null);
        }
      } catch (error) {
        if (!isCurrentAuthOperation(operation)) {
          return;
        }

        // Handle storage access errors gracefully
        console.error('Error initializing auth:', error);
        if (!hasBootstrapUser) {
          setUser(null);
        }
      } finally {
        if (isCurrentAuthOperation(operation)) {
          setIsLoading(false);
        }
      }
    };

    void initializeAuth();

    // Listen for auth state changes
    let subscription: { unsubscribe: () => void } | null = null;
    
    try {
      const { data } = supabase.auth.onAuthStateChange(
        (event, session) => {
          const isUserBearingEvent =
            event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'USER_UPDATED';
          const operation = beginAuthOperation(
            event === 'SIGNED_OUT'
              ? 'signed-out'
              : isUserBearingEvent && session?.user
                ? 'user-event'
                : 'auth-event',
            session?.user?.id
          );

          if (event === 'SIGNED_OUT') {
            commitSignedOut(operation);
            return;
          }

          if (isUserBearingEvent && session?.user) {
            operation.resolution = resolveUserForOperation(session.user, operation);
            void operation.resolution;
          }
        }
      );
      subscription = data.subscription;
    } catch (error) {
      console.error('Error setting up auth listener:', error);
    }

    // Cleanup subscription on unmount
    return () => {
      authActiveRef.current = false;
      beginAuthOperation('cleanup');
      subscription?.unsubscribe();
    };
  }, [
    beginAuthOperation,
    commitSignedOut,
    hasBootstrapUser,
    isCurrentAuthOperation,
    resolveUserForOperation,
    supabase,
  ]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const operation = beginAuthOperation('login');
    const canceledResult: LoginResult = {
      success: false,
      error: 'Unable to sign in. Please try again.',
    };

    const rejectAdminLogin = async (): Promise<LoginResult> => {
      const signOutOperation = beginAuthOperation('logout');

      try {
        await supabase.auth.signOut();
      } finally {
        commitSignedOut(signOutOperation);
      }

      return {
        success: false,
        error: 'Akun ini tidak memiliki akses admin.',
      };
    };

    const resultFromNewerOperation = async (
      userId: string
    ): Promise<LoginResult> => {
      while (authActiveRef.current) {
        const latestOperation = latestAuthOperationRef.current;

        if (
          latestOperation?.kind !== 'user-event' ||
          latestOperation.userId !== userId ||
          !latestOperation.resolution
        ) {
          return canceledResult;
        }

        const resolvedUser = await latestOperation.resolution;

        if (latestOperation.generation !== authGenerationRef.current) {
          continue;
        }

        return resolvedUser ? { success: true } : rejectAdminLogin();
      }

      return canceledResult;
    };

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!isCurrentAuthOperation(operation)) {
        return data.user
          ? resultFromNewerOperation(data.user.id)
          : canceledResult;
      }

      if (error) {
        return {
          success: false,
          error: getAuthErrorMessage(error),
        };
      }

      if (data.user) {
        const resolvedUser = await extractUserFromSupabaseUser(supabase, data.user);

        if (!isCurrentAuthOperation(operation)) {
          return resultFromNewerOperation(data.user.id);
        }

        if (!resolvedUser) {
          return rejectAdminLogin();
        }

        setUser(resolvedUser);
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
    beginAuthOperation,
    commitSignedOut,
    isCurrentAuthOperation,
    supabase,
  ]);

  const logout = useCallback(async (): Promise<void> => {
    const operation = beginAuthOperation('logout');

    try {
      await supabase.auth.signOut();
      commitSignedOut(operation);
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if the API call fails
      commitSignedOut(operation);
    }
  }, [beginAuthOperation, commitSignedOut, supabase]);

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
