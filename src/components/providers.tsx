"use client";

import { useCallback } from "react";
import { authClient } from "@/lib/auth/client";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { useRouter } from "next/navigation";
import { TRPCProvider } from "@/trpc/provider";
import { UserProfileProvider } from "@/contexts/UserProfileContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const handleSessionChange = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      redirectTo="/assistant"
      onSessionChange={handleSessionChange}
    >
      <TRPCProvider>
        <UserProfileProvider>{children}</UserProfileProvider>
      </TRPCProvider>
    </NeonAuthUIProvider>
  );
}
