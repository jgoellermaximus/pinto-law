"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, Table2 } from "lucide-react";
import {
  SidebarProvider,
  AppLayout,
  AppHeader,
} from "@/components/app-sidebar";

export default function TabularReviewsPage() {
  return (
    <SidebarProvider>
      <TabularReviewsInner />
    </SidebarProvider>
  );
}

function TabularReviewsInner() {
  const { isAuthenticated, authLoading } = useAuth();
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
            Tabular Review
          </h1>
        </AppHeader>

        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <Table2 className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Tabular Review</p>
          <p className="text-sm text-gray-400 mt-1 text-center max-w-sm">
            Upload multiple contracts and extract structured data into a
            spreadsheet grid. Powered by Mike OSS tabular review engine — 
            connecting in Phase 2.
          </p>
        </div>
      </main>
    </AppLayout>
  );
}
