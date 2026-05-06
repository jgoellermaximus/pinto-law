"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/trpc/client";
import {
  X,
  Loader2,
  Plus,
  Search,
  Home,
  User,
  Gavel,
  Building2,
  Scale,
  Briefcase,
  FileText,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateDealModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

// ---------------------------------------------------------------------------
// Matter types
// ---------------------------------------------------------------------------

const MATTER_TYPES = [
  { value: "real_estate", label: "Real Estate", icon: Home },
  { value: "criminal", label: "Criminal", icon: Gavel },
  { value: "business", label: "Business", icon: Building2 },
  { value: "municipal", label: "Municipal", icon: Scale },
  { value: "landlord_tenant", label: "Landlord/Tenant", icon: Briefcase },
  { value: "estate_planning", label: "Estate Planning", icon: FileText },
];

const STAGES = [
  { value: "prospecting", label: "Prospecting" },
  { value: "intake", label: "Intake" },
  { value: "active", label: "Active" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateDealModal({
  open,
  onClose,
  onCreated,
}: CreateDealModalProps) {
  // Form state
  const [name, setName] = useState("");
  const [matterType, setMatterType] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientType, setNewClientType] = useState<
    "individual" | "business" | "brokerage"
  >("brokerage");
  const [stage, setStage] = useState("prospecting");

  const nameRef = useRef<HTMLInputElement>(null);

  // tRPC
  const createProject = trpc.projects.create.useMutation();
  const createClient = trpc.clients.create.useMutation();
  const clientSearchQuery = trpc.clients.search.useQuery(
    { query: clientSearch },
    { enabled: clientSearch.length >= 1 },
  );

  // Focus name input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Reset form
  function resetForm() {
    setName("");
    setMatterType(null);
    setClientSearch("");
    setSelectedClientId(null);
    setSelectedClientName("");
    setShowClientDropdown(false);
    setShowNewClient(false);
    setNewClientName("");
    setNewClientType("brokerage");
    setStage("prospecting");
  }

  // Submit
  async function handleSubmit() {
    if (!name.trim()) return;

    let clientId = selectedClientId;

    // Create new client if needed
    if (showNewClient && newClientName.trim()) {
      try {
        const newClient = await createClient.mutateAsync({
          name: newClientName.trim(),
          type: newClientType,
        });
        clientId = newClient.id;
      } catch {
        return;
      }
    }

    try {
      await createProject.mutateAsync({
        name: name.trim(),
        matterType: (matterType as any) ?? undefined,
        stage: stage as any,
        clientId: clientId ?? undefined,
      });
      resetForm();
      onCreated();
      onClose();
    } catch {
      // ignore
    }
  }

  const isSubmitting = createProject.isPending || createClient.isPending;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">New Matter</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Deal name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Name
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-gray-400 transition-colors">
              <Briefcase className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="123 Elm St — Rodriguez/Chen"
                className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
              />
            </div>
          </div>

          {/* Matter type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Matter Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MATTER_TYPES.map((mt) => {
                const Icon = mt.icon;
                const selected = matterType === mt.value;
                return (
                  <button
                    key={mt.value}
                    onClick={() =>
                      setMatterType(selected ? null : mt.value)
                    }
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      selected
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${selected ? "text-white" : "text-gray-400"}`} />
                    {mt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Optional — you can set this later.
            </p>
          </div>

          {/* Client selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Client / Brokerage
            </label>

            {selectedClientId && !showNewClient ? (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-800">
                    {selectedClientName}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedClientId(null);
                    setSelectedClientName("");
                    setClientSearch("");
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Change
                </button>
              </div>
            ) : showNewClient ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-gray-400 transition-colors">
                  <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Client or brokerage name"
                    className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-2">
                  {(
                    [
                      { value: "brokerage", label: "Brokerage" },
                      { value: "individual", label: "Individual" },
                      { value: "business", label: "Business" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setNewClientType(opt.value)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        newClientType === opt.value
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowNewClient(false);
                      setNewClientName("");
                    }}
                    className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-gray-400 transition-colors">
                  <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => {
                      if (clientSearch.length >= 1) setShowClientDropdown(true);
                    }}
                    placeholder="Search existing clients..."
                    className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
                  />
                </div>

                {/* Dropdown */}
                {showClientDropdown && clientSearch.length >= 1 && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowClientDropdown(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-48 overflow-y-auto">
                      {clientSearchQuery.data?.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => {
                            setSelectedClientId(client.id);
                            setSelectedClientName(client.name);
                            setShowClientDropdown(false);
                            setClientSearch("");
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                        >
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          <span className="flex-1 text-left text-gray-700">
                            {client.name}
                          </span>
                          <span className="text-[10px] text-gray-400 capitalize">
                            {client.type}
                          </span>
                        </button>
                      ))}

                      {clientSearchQuery.data?.length === 0 && (
                        <p className="px-3 py-2 text-xs text-gray-400">
                          No clients found
                        </p>
                      )}

                      {/* Create new option */}
                      <button
                        onClick={() => {
                          setShowNewClient(true);
                          setNewClientName(clientSearch);
                          setShowClientDropdown(false);
                          setClientSearch("");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors border-t border-gray-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create &ldquo;{clientSearch}&rdquo;
                      </button>
                    </div>
                  </>
                )}

                {/* Skip / create new */}
                <div className="flex items-center gap-3 mt-1.5">
                  <button
                    onClick={() => setShowNewClient(true)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    + New client
                  </button>
                  <span className="text-xs text-gray-300">or skip for now</span>
                </div>
              </div>
            )}
          </div>

          {/* Stage */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Stage
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {STAGES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStage(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    stage === opt.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create Matter
          </button>
        </div>
      </div>
    </>
  );
}