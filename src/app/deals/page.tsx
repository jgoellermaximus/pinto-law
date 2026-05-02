"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2,
  CheckCircle2,
  Clock,
  FileText,
  ArrowLeft,
  Send,
  ChevronDown,
} from "lucide-react";

interface DealIntake {
  id: string;
  status: string;
  propertyAddress: string;
  propertyCity: string;
  propertyZip: string;
  buyerName: string;
  sellerName: string;
  purchasePrice: number;
  closingDate: string | null;
  realtorName: string;
  realtorBrokerage: string | null;
  representingSide: string;
  generatedLetter: string | null;
  approvedLetter: string | null;
  attorneyNotes: string | null;
  createdAt: string;
}

export default function DealsPage() {
  const { isAuthenticated, authLoading } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<DealIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<DealIntake | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/sign-in");
    }
  }, [authLoading, isAuthenticated, router]);

  const loadDeals = useCallback(async () => {
    try {
      const res = await fetch("/api/deals");
      if (res.ok) {
        const data = await res.json();
        setDeals(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadDeals();
  }, [isAuthenticated, loadDeals]);

  async function handleApprove(dealId: string) {
    setApproving(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        await loadDeals();
        setSelectedDeal(null);
      }
    } catch {
      // ignore
    } finally {
      setApproving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Detail view
  if (selectedDeal) {
    const price = selectedDeal.purchasePrice.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

    return (
      <div className="min-h-dvh bg-white">
        <header className="border-b border-gray-100 px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => setSelectedDeal(null)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-800">
              {selectedDeal.propertyAddress}, {selectedDeal.propertyCity}
            </h1>
            <p className="text-sm text-gray-400">
              {selectedDeal.buyerName} → {selectedDeal.sellerName} · {price}
            </p>
          </div>
          <StatusBadge status={selectedDeal.status} />
        </header>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Deal summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <InfoCard label="Purchase Price" value={price} />
            <InfoCard label="Closing Date" value={selectedDeal.closingDate ?? "TBD"} />
            <InfoCard label="Realtor" value={selectedDeal.realtorName} />
            <InfoCard label="Representing" value={selectedDeal.representingSide} />
          </div>

          {/* Generated letter */}
          {selectedDeal.generatedLetter && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                Attorney Review Letter
              </h2>
              <div className="bg-gray-50 rounded-xl p-6 prose prose-sm prose-gray max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedDeal.approvedLetter ?? selectedDeal.generatedLetter}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Actions */}
          {selectedDeal.status === "letter_generated" && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleApprove(selectedDeal.id)}
                disabled={approving}
                className="flex items-center gap-2 rounded-lg bg-green-700 text-white px-6 py-3 text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
              >
                {approving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Approve Letter
              </button>
              <button
                onClick={() => {
                  // Placeholder for sending to signature tool
                  alert(
                    "Send for Signature — DocuSeal integration coming in Phase 2",
                  );
                }}
                className="flex items-center gap-2 rounded-lg border border-gray-200 text-gray-600 px-6 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Send className="h-4 w-4" />
                Send for Signature
              </button>
            </div>
          )}

          {selectedDeal.status === "approved" && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Approved
              </div>
              <button
                onClick={() => {
                  alert(
                    "Send for Signature — DocuSeal integration coming in Phase 2",
                  );
                }}
                className="flex items-center gap-2 rounded-lg bg-gray-900 text-white px-6 py-3 text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <Send className="h-4 w-4" />
                Send for Signature
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Pinto Law"
            width={28}
            height={34}
            className="object-contain"
            unoptimized
          />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-800">
              Deal Review Queue
            </h1>
            <p className="text-xs text-gray-400">
              {deals.length} deal{deals.length !== 1 ? "s" : ""} submitted
            </p>
          </div>
          <button
            onClick={() => router.push("/chat")}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to Chat
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-3">
        {deals.length === 0 && (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No deals submitted yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Share <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/intake</code> with your realtor partners.
            </p>
          </div>
        )}

        {deals.map((deal) => {
          const price = deal.purchasePrice.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          });
          return (
            <button
              key={deal.id}
              onClick={() => setSelectedDeal(deal)}
              className="w-full text-left bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {deal.propertyAddress}, {deal.propertyCity}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {deal.buyerName} → {deal.sellerName} · {price} ·{" "}
                  {deal.realtorName}
                </p>
              </div>
              <StatusBadge status={deal.status} />
              <ChevronDown className="h-4 w-4 text-gray-300 -rotate-90" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; Icon: typeof Clock }> = {
    submitted: {
      label: "Generating...",
      className: "bg-yellow-50 text-yellow-700 border-yellow-200",
      Icon: Loader2,
    },
    letter_generated: {
      label: "Needs Review",
      className: "bg-blue-50 text-blue-700 border-blue-200",
      Icon: FileText,
    },
    approved: {
      label: "Approved",
      className: "bg-green-50 text-green-700 border-green-200",
      Icon: CheckCircle2,
    },
    sent: {
      label: "Sent",
      className: "bg-gray-50 text-gray-600 border-gray-200",
      Icon: Send,
    },
  };

  const c = config[status] ?? config.submitted;
  const Icon = c.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${c.className}`}
    >
      <Icon className={`h-3 w-3 ${status === "submitted" ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-800 capitalize">{value}</p>
    </div>
  );
}
