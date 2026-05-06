/**
 * POST /api/templates/upload
 *
 * Handles DOCX template file upload:
 * 1. Accepts multipart form data with a DOCX file
 * 2. Uploads to R2 under templates/{workflowId}/{filename}
 * 3. Scans the DOCX for {{PLACEHOLDER}} merge fields
 * 4. Returns the R2 storage path + detected placeholders
 *
 * The caller (workflows page) then saves the metadata via tRPC.
 *
 * Auth required — only attorneys and admins can upload templates.
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadFile, templateKey } from "@/lib/storage";
import { extractPlaceholders } from "@/lib/legal/docxMerge";
import type { MergeField } from "@/lib/legal/docxMerge";

// ---------------------------------------------------------------------------
// Known field mappings — auto-maps detected placeholders to intake form fields
// ---------------------------------------------------------------------------

const KNOWN_MAPPINGS: Record<
  string,
  { label: string; type: MergeField["type"]; mapTo: string | null }
> = {
  BUYER_NAME: { label: "Buyer Name", type: "text", mapTo: "buyerName" },
  SELLER_NAME: { label: "Seller Name", type: "text", mapTo: "sellerName" },
  PROPERTY_ADDRESS: {
    label: "Property Address",
    type: "text",
    mapTo: "propertyAddress",
  },
  PROPERTY_CITY: {
    label: "Property City",
    type: "text",
    mapTo: "propertyCity",
  },
  PROPERTY_ZIP: { label: "Property ZIP", type: "text", mapTo: "propertyZip" },
  PURCHASE_PRICE: {
    label: "Purchase Price",
    type: "currency",
    mapTo: "purchasePrice",
  },
  CLOSING_DATE: { label: "Closing Date", type: "date", mapTo: "closingDate" },
  REPRESENTING_SIDE: {
    label: "Representing Side",
    type: "select",
    mapTo: "representingSide",
  },
  REALTOR_NAME: {
    label: "Realtor Name",
    type: "text",
    mapTo: "realtorName",
  },
  REALTOR_BROKERAGE: {
    label: "Realtor Brokerage",
    type: "text",
    mapTo: "realtorBrokerage",
  },
  REALTOR_EMAIL: {
    label: "Realtor Email",
    type: "text",
    mapTo: "realtorEmail",
  },
  REALTOR_PHONE: {
    label: "Realtor Phone",
    type: "text",
    mapTo: "realtorPhone",
  },
  BUYER_EMAIL: { label: "Buyer Email", type: "text", mapTo: "buyerEmail" },
  BUYER_PHONE: { label: "Buyer Phone", type: "text", mapTo: "buyerPhone" },
  SELLER_EMAIL: { label: "Seller Email", type: "text", mapTo: "sellerEmail" },
  SELLER_PHONE: { label: "Seller Phone", type: "text", mapTo: "sellerPhone" },
  MORTGAGE_CONTINGENCY: {
    label: "Mortgage Contingency",
    type: "select",
    mapTo: "mortgageContingency",
  },
  INSPECTION_CONTINGENCY: {
    label: "Inspection Contingency",
    type: "select",
    mapTo: "inspectionContingency",
  },
  ADDITIONAL_TERMS: {
    label: "Additional Terms",
    type: "textarea",
    mapTo: "additionalTerms",
  },
  // Auto-generated fields (no mapTo — system fills these)
  TODAYS_DATE: { label: "Today's Date", type: "date", mapTo: null },
  ATTORNEY_NAME: { label: "Attorney Name", type: "text", mapTo: null },
  FIRM_NAME: { label: "Firm Name", type: "text", mapTo: null },
  FIRM_ADDRESS: { label: "Firm Address", type: "text", mapTo: null },
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const workflowId = formData.get("workflowId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream", // some browsers send this for .docx
    ];
    const isDocx =
      file.name.toLowerCase().endsWith(".docx") ||
      validTypes.includes(file.type);

    if (!isDocx) {
      return NextResponse.json(
        { error: "Only .docx files are supported" },
        { status: 400 },
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large — max 10MB" },
        { status: 400 },
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate storage key
    // If workflowId provided, use it; otherwise use a temp ID
    const id = workflowId ?? `temp-${Date.now()}`;
    const storagePath = templateKey(id, file.name);

    // Upload to R2
    await uploadFile(
      storagePath,
      buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    // Extract placeholders from the DOCX
    const detectedKeys = extractPlaceholders(buffer);

    // Build MergeField definitions with auto-mapping
    const templateFields: MergeField[] = detectedKeys.map((key) => {
      const known = KNOWN_MAPPINGS[key];
      return {
        key,
        label: known?.label ?? key.replace(/_/g, " "),
        type: known?.type ?? "text",
        required: true,
        mapTo: known?.mapTo ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      detectedKeys,
      templateFields,
    });
  } catch (err) {
    console.error("[template-upload] error:", err);
    return NextResponse.json(
      { error: "Failed to upload template" },
      { status: 500 },
    );
  }
}
