"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, CheckCircle2, Upload } from "lucide-react";

type FormData = {
  propertyAddress: string;
  propertyCity: string;
  propertyZip: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  purchasePrice: string;
  closingDate: string;
  mortgageContingency: string;
  inspectionContingency: string;
  additionalTerms: string;
  realtorName: string;
  realtorEmail: string;
  realtorPhone: string;
  realtorBrokerage: string;
  representingSide: string;
};

const INITIAL: FormData = {
  propertyAddress: "",
  propertyCity: "",
  propertyZip: "",
  buyerName: "",
  buyerEmail: "",
  buyerPhone: "",
  sellerName: "",
  sellerEmail: "",
  sellerPhone: "",
  purchasePrice: "",
  closingDate: "",
  mortgageContingency: "yes",
  inspectionContingency: "yes",
  additionalTerms: "",
  realtorName: "",
  realtorEmail: "",
  realtorPhone: "",
  realtorBrokerage: "",
  representingSide: "buyer",
};

export default function IntakeFormPage() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Submission failed");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
          <h1 className="text-2xl font-semibold text-gray-800">
            Deal Submitted
          </h1>
          <p className="text-gray-500">
            The attorney review letter will be generated and you will be
            contacted once it is ready for signatures.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setForm(INITIAL);
            }}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Submit another deal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Pinto Law"
            width={32}
            height={38}
            className="object-contain"
            unoptimized
          />
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              New Deal Submission
            </h1>
            <p className="text-xs text-gray-400">
              Pinto Law Group — Attorney Review
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="max-w-2xl mx-auto px-6 py-8 space-y-8"
      >
        {/* Property */}
        <Section title="Property Information">
          <Field label="Street Address" required>
            <input
              type="text"
              value={form.propertyAddress}
              onChange={(e) => update("propertyAddress", e.target.value)}
              placeholder="123 Main Street"
              required
              className={inputClass}
            />
          </Field>
          <Row>
            <Field label="City" required>
              <input
                type="text"
                value={form.propertyCity}
                onChange={(e) => update("propertyCity", e.target.value)}
                placeholder="Elizabeth"
                required
                className={inputClass}
              />
            </Field>
            <Field label="ZIP Code" required>
              <input
                type="text"
                value={form.propertyZip}
                onChange={(e) => update("propertyZip", e.target.value)}
                placeholder="07201"
                required
                className={inputClass}
              />
            </Field>
          </Row>
        </Section>

        {/* Buyer */}
        <Section title="Buyer Information">
          <Field label="Full Name" required>
            <input
              type="text"
              value={form.buyerName}
              onChange={(e) => update("buyerName", e.target.value)}
              placeholder="John Smith"
              required
              className={inputClass}
            />
          </Field>
          <Row>
            <Field label="Email">
              <input
                type="email"
                value={form.buyerEmail}
                onChange={(e) => update("buyerEmail", e.target.value)}
                placeholder="john@email.com"
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={form.buyerPhone}
                onChange={(e) => update("buyerPhone", e.target.value)}
                placeholder="(908) 555-0100"
                className={inputClass}
              />
            </Field>
          </Row>
        </Section>

        {/* Seller */}
        <Section title="Seller Information">
          <Field label="Full Name" required>
            <input
              type="text"
              value={form.sellerName}
              onChange={(e) => update("sellerName", e.target.value)}
              placeholder="Jane Doe"
              required
              className={inputClass}
            />
          </Field>
          <Row>
            <Field label="Email">
              <input
                type="email"
                value={form.sellerEmail}
                onChange={(e) => update("sellerEmail", e.target.value)}
                placeholder="jane@email.com"
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={form.sellerPhone}
                onChange={(e) => update("sellerPhone", e.target.value)}
                placeholder="(908) 555-0200"
                className={inputClass}
              />
            </Field>
          </Row>
        </Section>

        {/* Deal Terms */}
        <Section title="Deal Terms">
          <Row>
            <Field label="Purchase Price" required>
              <input
                type="number"
                value={form.purchasePrice}
                onChange={(e) => update("purchasePrice", e.target.value)}
                placeholder="450000"
                required
                className={inputClass}
              />
            </Field>
            <Field label="Closing Date">
              <input
                type="date"
                value={form.closingDate}
                onChange={(e) => update("closingDate", e.target.value)}
                className={inputClass}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Mortgage Contingency">
              <select
                value={form.mortgageContingency}
                onChange={(e) => update("mortgageContingency", e.target.value)}
                className={inputClass}
              >
                <option value="yes">Yes</option>
                <option value="no">No — Cash deal</option>
                <option value="waived">Waived</option>
              </select>
            </Field>
            <Field label="Inspection Contingency">
              <select
                value={form.inspectionContingency}
                onChange={(e) =>
                  update("inspectionContingency", e.target.value)
                }
                className={inputClass}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="waived">Waived</option>
              </select>
            </Field>
          </Row>
          <Field label="Additional Terms or Notes">
            <textarea
              value={form.additionalTerms}
              onChange={(e) => update("additionalTerms", e.target.value)}
              placeholder="Any special conditions, concessions, or notes..."
              rows={3}
              className={inputClass}
            />
          </Field>
        </Section>

        {/* Realtor */}
        <Section title="Realtor Information">
          <Row>
            <Field label="Your Name" required>
              <input
                type="text"
                value={form.realtorName}
                onChange={(e) => update("realtorName", e.target.value)}
                placeholder="Alex Rivera"
                required
                className={inputClass}
              />
            </Field>
            <Field label="Brokerage">
              <input
                type="text"
                value={form.realtorBrokerage}
                onChange={(e) => update("realtorBrokerage", e.target.value)}
                placeholder="RE/MAX Elite"
                className={inputClass}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Email">
              <input
                type="email"
                value={form.realtorEmail}
                onChange={(e) => update("realtorEmail", e.target.value)}
                placeholder="alex@remax.com"
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={form.realtorPhone}
                onChange={(e) => update("realtorPhone", e.target.value)}
                placeholder="(908) 555-0300"
                className={inputClass}
              />
            </Field>
          </Row>
          <Field label="Representing">
            <select
              value={form.representingSide}
              onChange={(e) => update("representingSide", e.target.value)}
              className={inputClass}
            >
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="dual">Dual Agency</option>
            </select>
          </Field>
        </Section>

        {/* TODO: PDF upload for purchase agreement */}
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
          <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            Purchase agreement upload — coming soon
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gray-900 text-white py-3 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting &amp; generating letter...
            </>
          ) : (
            "Submit for Attorney Review"
          )}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors bg-white";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}
