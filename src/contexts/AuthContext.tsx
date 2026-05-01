"use client";

import { authClient } from "@/lib/auth/client";

/**
 * Compatibility hook — provides the same API as the old Supabase AuthContext
 * so existing components continue working without immediate refactoring.
 *
 * Old pattern: const { user, isAuthenticated, authLoading, signOut } = useAuth();
 * This hook preserves that interface backed by Neon Auth.
 */
export function useAuth() {
  const { data: session, isPending } = authClient.useSession();

  return {
    user: session?.user
      ? {
          id: session.user.id,
          email: session.user.email ?? "",
          name: session.user.name ?? undefined,
        }
      : null,
    isAuthenticated: !!session?.user,
    authLoading: isPending,
    signOut: async () => {
      await authClient.signOut();
    },
  };
}
