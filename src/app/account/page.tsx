"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, Settings, User, Key, Bell } from "lucide-react";
import {
  SidebarProvider,
  AppLayout,
  AppHeader,
} from "@/components/app-sidebar";

export default function AccountPage() {
  return (
    <SidebarProvider>
      <AccountPageInner />
    </SidebarProvider>
  );
}

function AccountPageInner() {
  const { user, isAuthenticated, authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/sign-in");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AppLayout>
      <main className="flex flex-1 flex-col min-w-0">
        <AppHeader>
          <h1 className="text-sm font-semibold text-gray-800 mr-auto">
            Settings
          </h1>
        </AppHeader>

        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Profile */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="h-5 w-5 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-800">Profile</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Name</p>
                  <p className="text-sm text-gray-800">{user?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-sm text-gray-800">{user?.email ?? "—"}</p>
                </div>
              </div>
            </div>

            {/* API Keys */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Key className="h-5 w-5 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-800">API Keys</h2>
              </div>
              <p className="text-sm text-gray-500">
                API key management coming soon. Currently using shared OpenRouter key.
              </p>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="h-5 w-5 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-800">Notifications</h2>
              </div>
              <p className="text-sm text-gray-500">
                Push notification settings coming in Phase 2 with PWA service worker.
              </p>
            </div>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
