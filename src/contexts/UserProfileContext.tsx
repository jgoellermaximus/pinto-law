"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import { useAuth } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// Stub UserProfileContext
// Provides the same interface as the original so existing components compile.
// All DB operations are no-ops until tRPC user router is built (Task 4/8).
// ---------------------------------------------------------------------------

interface UserProfile {
  displayName: string | null;
  organisation: string | null;
  messageCreditsUsed: number;
  creditsResetDate: string;
  creditsRemaining: number;
  tier: string;
  tabularModel: string;
  claudeApiKey: string | null;
  geminiApiKey: string | null;
  openrouterApiKey: string | null;
}

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  updateDisplayName: (name: string) => Promise<boolean>;
  updateOrganisation: (organisation: string) => Promise<boolean>;
  updateModelPreference: (
    field: "tabularModel",
    value: string,
  ) => Promise<boolean>;
  updateApiKey: (
    provider: "claude" | "gemini" | "openrouter",
    value: string | null,
  ) => Promise<boolean>;
  reloadProfile: () => Promise<void>;
  incrementMessageCredits: () => Promise<boolean>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(
  undefined,
);

const DEFAULT_PROFILE: UserProfile = {
  displayName: null,
  organisation: "Pinto Law Group",
  messageCreditsUsed: 0,
  creditsResetDate: new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString(),
  creditsRemaining: 999999,
  tier: "Free",
  tabularModel: "gemini-3-flash-preview",
  claudeApiKey: null,
  geminiApiKey: null,
  openrouterApiKey: null,
};

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user) {
      // TODO: Replace with tRPC query — trpc.user.getProfile.useQuery()
      setProfile({ ...DEFAULT_PROFILE, displayName: user.name ?? null });
      setLoading(false);
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  // All update methods are no-ops until tRPC user router is wired
  const updateDisplayName = useCallback(async (_name: string) => true, []);
  const updateOrganisation = useCallback(async (_org: string) => true, []);
  const updateModelPreference = useCallback(
    async (_field: "tabularModel", _value: string) => true,
    [],
  );
  const updateApiKey = useCallback(
    async (_provider: "claude" | "gemini" | "openrouter", _value: string | null) => true,
    [],
  );
  const reloadProfile = useCallback(async () => {}, []);
  const incrementMessageCredits = useCallback(async () => true, []);

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        loading,
        updateDisplayName,
        updateOrganisation,
        updateModelPreference,
        updateApiKey,
        reloadProfile,
        incrementMessageCredits,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error(
      "useUserProfile must be used within a UserProfileProvider",
    );
  }
  return context;
}
