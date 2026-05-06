"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { Loader2, Users, Plus, User, X } from "lucide-react";
import {
  SidebarProvider,
  AppLayout,
  AppHeader,
} from "@/components/app-sidebar";

export default function ClientsPage() {
  return (
    <SidebarProvider>
      <ClientsPageInner />
    </SidebarProvider>
  );
}

function ClientsPageInner() {
  const { isAuthenticated, authLoading } = useAuth();
  const router = useRouter();

  const clientsQuery = trpc.clients.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

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

  const clients = clientsQuery.data ?? [];

  return (
    <AppLayout>
      <main className="flex flex-1 flex-col min-w-0">
        <AppHeader>
          <h1 className="text-sm font-semibold text-gray-800 mr-auto">
            Clients
          </h1>
        </AppHeader>

        <div className="flex-1 overflow-auto p-4">
          {clientsQuery.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <Users className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No clients yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Clients are created automatically when you add deals.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-2">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4"
                >
                  <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">{client.name}</p>
                    <p className="text-sm text-gray-500 capitalize">
                      {client.type}
                      {client.email && ` · ${client.email}`}
                      {client.phone && ` · ${client.phone}`}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(client.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
