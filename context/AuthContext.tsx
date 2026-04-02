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

// ============================================================================
// Helpers
// ============================================================================

async function extractUserFromSupabaseUser(
  supabaseUser: SupabaseUser
): Promise<User | null> {
  const metadata = supabaseUser.user_metadata || {};
  const supabase = createClient();
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
  const [user, setUser] = useState<User | null>(() => bootstrapUserRef.current);
  const [isLoading, setIsLoading] = useState(() => !hasBootstrapUser);
  const isAuthenticated = user?.role != null;

  // Initialize auth state on mount
  useEffect(() => {
    // Skip on server
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const resolvedUser = await extractUserFromSupabaseUser(session.user);
          setUser(resolvedUser ?? bootstrapUserRef.current);
        } else if (!hasBootstrapUser) {
          setUser(null);
        }
      } catch (error) {
        // Handle storage access errors gracefully
        console.error('Error initializing auth:', error);
        if (!hasBootstrapUser) {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    let subscription: { unsubscribe: () => void } | null = null;
    
    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            setUser((await extractUserFromSupabaseUser(session.user)) ?? bootstrapUserRef.current);
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            setUser((await extractUserFromSupabaseUser(session.user)) ?? bootstrapUserRef.current);
          } else if (event === 'USER_UPDATED' && session?.user) {
            setUser((await extractUserFromSupabaseUser(session.user)) ?? bootstrapUserRef.current);
          }
        }
      );
      subscription = data.subscription;
    } catch (error) {
      console.error('Error setting up auth listener:', error);
    }

    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, [hasBootstrapUser]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: getAuthErrorMessage(error),
        };
      }

      if (data.user) {
        const resolvedUser = await extractUserFromSupabaseUser(data.user);

        if (!resolvedUser) {
          await supabase.auth.signOut();
          setUser(null);
          return {
            success: false,
            error: 'Akun ini tidak memiliki akses admin.',
          };
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
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    const supabase = createClient();

    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if the API call fails
      setUser(null);
    }
  }, []);

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
