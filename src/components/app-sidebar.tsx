"use client";

import { useState, createContext, useContext } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  FolderOpen,
  Table2,
  Library,
  PanelLeft,
  LogOut,
  FileText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { PintoLogo } from "@/components/pinto-logo";

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { href: "/chat", label: "Assistant", icon: MessageSquare },
  { href: "/deals", label: "Deals", icon: FileText },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/tabular-reviews", label: "Tabular Review", icon: Table2 },
  { href: "/workflows", label: "Workflows", icon: Library },
];

// ---------------------------------------------------------------------------
// Sidebar context — lets any page header toggle the sidebar
// ---------------------------------------------------------------------------

interface SidebarContextValue {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  sidebarOpen: true,
  toggleSidebar: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <SidebarContext.Provider
      value={{
        sidebarOpen,
        toggleSidebar: () => setSidebarOpen((prev) => !prev),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// AppLayout — sidebar + main content wrapper
// ---------------------------------------------------------------------------

export function AppLayout({
  children,
  sidebarContent,
}: {
  children: React.ReactNode;
  sidebarContent?: React.ReactNode;
}) {
  const { sidebarOpen } = useSidebar();
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex h-dvh bg-white">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } flex-shrink-0 overflow-hidden transition-all duration-200 border-r border-gray-100 bg-gray-50/70`}
      >
        <div className="flex h-full w-64 flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100">
            <PintoLogo size={36} />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Legal OS
            </span>
          </div>

          {/* Nav */}
          <nav className="px-3 py-3 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Page-specific sidebar content */}
          <div className="flex-1 overflow-y-auto px-3 pt-2">
            {sidebarContent}
          </div>

          {/* User */}
          <div className="border-t border-gray-100 px-3 py-3">
            <div className="flex items-center gap-2.5 px-2">
              <div className="h-7 w-7 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-medium">
                {user?.name?.[0] ?? user?.email?.[0] ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {user?.name ?? user?.email}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppHeader — reusable header with sidebar toggle
// ---------------------------------------------------------------------------

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="flex items-center h-14 px-4 border-b border-gray-100 gap-2">
      <button
        onClick={toggleSidebar}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <PanelLeft className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      {children}
    </header>
  );
}