/**
 * docxMerge.ts — DOCX template merge engine
 *
 * Reads a DOCX template from R2, replaces {{PLACEHOLDER}} fields with
 * actual data, and returns the filled DOCX as a Buffer.
 *
 * Uses docxtemplater + pizzip.
 *
 * Template format:
 *   Raul's DOCX files with {{BUYER_NAME}}, {{PROPERTY_ADDRESS}}, etc.
 *   These are standard docxtemplater delimiters.
 *
 * Usage:
 *   const filled = await mergeTemplate("templates/abc/letter.docx", {
 *     BUYER_NAME: "John Smith",
 *     PROPERTY_ADDRESS: "123 Main St",
 *     PURCHASE_PRICE: "$450,000",
 *   });
 *   // filled is a Buffer containing the completed DOCX
 */

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { downloadFile } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MergeField {
  /** The placeholder key in the template, e.g. "BUYER_NAME" */
  key: string;
  /** Human-readable label for the UI, e.g. "Buyer Name" */
  label: string;
  /** Field type for form rendering */
  type: "text" | "date" | "currency" | "select" | "textarea";
  /** Whether the field is required */
  required: boolean;
  /**
   * Maps to an intake form field name for automatic population.
   * e.g. "buyerName" means this field auto-fills from intake.buyerName
   * Null means the field must be filled manually.
   */
  mapTo: string | null;
  /** Default value if not provided */
  defaultValue?: string;
  /** Options for select type */
  options?: string[];
}

export interface MergeResult {
  /** The filled DOCX as a Buffer */
  buffer: Buffer;
  /** The output filename */
  filename: string;
  /** Fields that were filled */
  filledFields: string[];
  /** Fields that were empty / missing (replaced with empty string) */
  missingFields: string[];
}

// ---------------------------------------------------------------------------
// Core merge function
// ---------------------------------------------------------------------------

/**
 * Download a DOCX template from R2 and replace all {{PLACEHOLDER}} fields.
 *
 * @param templateStoragePath — R2 key for the template DOCX
 * @param data — key/value pairs: { BUYER_NAME: "John", PURCHASE_PRICE: "$450K" }
 * @param outputFilename — name for the output file (default: filled-template.docx)
 */
export async function mergeTemplate(
  templateStoragePath: string,
  data: Record<string, string>,
  outputFilename?: string,
): Promise<MergeResult> {
  // 1. Download template from R2
  const templateBuffer = await downloadFile(templateStoragePath);

  // 2. Load into pizzip (DOCX is a zip file)
  const zip = new PizZip(templateBuffer);

  // 3. Create docxtemplater instance
  const doc = new Docxtemplater(zip, {
    // Don't throw on missing tags — replace with empty string
    nullGetter: () => "",
    // Use {{ }} delimiters (default)
    delimiters: { start: "{{", end: "}}" },
    // Paragraph loop module not needed for simple merge
    paragraphLoop: true,
    linebreaks: true,
  });

  // 4. Replace all placeholders
  doc.render(data);

  // 5. Generate output buffer
  const outputBuffer = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  // 6. Determine which fields were filled vs missing
  const filledFields: string[] = [];
  const missingFields: string[] = [];

  // Extract all placeholder keys from the template
  const templateText = extractTemplateText(templateBuffer);
  const placeholderRegex = /\{\{([A-Z_]+)\}\}/g;
  let match;
  const allKeys = new Set<string>();

  while ((match = placeholderRegex.exec(templateText)) !== null) {
    allKeys.add(match[1]);
  }

  for (const key of allKeys) {
    if (data[key] && data[key].trim() !== "") {
      filledFields.push(key);
    } else {
      missingFields.push(key);
    }
  }

  return {
    buffer: outputBuffer,
    filename: outputFilename ?? "filled-template.docx",
    filledFields,
    missingFields,
  };
}

// ---------------------------------------------------------------------------
// Merge from raw buffer (for preview — no R2 download needed)
// ---------------------------------------------------------------------------

/**
 * Same as mergeTemplate but accepts a Buffer directly instead of downloading.
 * Used for preview during template upload.
 */
export function mergeTemplateFromBuffer(
  templateBuffer: Buffer,
  data: Record<string, string>,
): Buffer {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    nullGetter: () => "",
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(data);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

// ---------------------------------------------------------------------------
// Extract placeholders from a template
// ---------------------------------------------------------------------------

/**
 * Scan a DOCX template buffer and return all {{PLACEHOLDER}} keys found.
 * Used during template upload to auto-detect merge fields.
 */
export function extractPlaceholders(templateBuffer: Buffer): string[] {
  const text = extractTemplateText(templateBuffer);
  const placeholderRegex = /\{\{([A-Z_]+)\}\}/g;
  const keys = new Set<string>();
  let match;

  while ((match = placeholderRegex.exec(text)) !== null) {
    keys.add(match[1]);
  }

  return Array.from(keys).sort();
}

// ---------------------------------------------------------------------------
// Extract raw text from DOCX (for placeholder scanning)
// ---------------------------------------------------------------------------

function extractTemplateText(docxBuffer: Buffer): string {
  const zip = new PizZip(docxBuffer);
  const parts: string[] = [];

  // DOCX stores content in word/document.xml (and word/header*.xml, word/footer*.xml)
  const xmlFiles = [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/header3.xml",
    "word/footer1.xml",
    "word/footer2.xml",
    "word/footer3.xml",
  ];

  for (const xmlFile of xmlFiles) {
    try {
      const content = zip.file(xmlFile)?.asText();
      if (content) {
        // Strip XML tags to get raw text
        parts.push(content.replace(/<[^>]+>/g, ""));
      }
    } catch {
      // File doesn't exist in this template — skip
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Build merge data from intake form submission
// ---------------------------------------------------------------------------

/**
 * Given a workflow's templateFields config and an intake form submission,
 * build the data object for mergeTemplate().
 */
export function buildMergeData(
  templateFields: MergeField[],
  intakeData: Record<string, string | number | null>,
): Record<string, string> {
  const data: Record<string, string> = {};

  for (const field of templateFields) {
    // Try to auto-fill from intake data via mapTo
    if (field.mapTo && intakeData[field.mapTo] != null) {
      let value = String(intakeData[field.mapTo]);

      // Format currency fields
      if (field.type === "currency" && !isNaN(Number(value))) {
        value = Number(value).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });
      }

      // Format date fields
      if (field.type === "date" && value) {
        try {
          value = new Date(value).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
        } catch {
          // Keep original value if date parsing fails
        }
      }

      data[field.key] = value;
    } else if (field.defaultValue) {
      data[field.key] = field.defaultValue;
    } else {
      data[field.key] = "";
    }
  }

  // Always add auto-generated fields
  data["TODAYS_DATE"] = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  data["ATTORNEY_NAME"] = "Raul J. Pinto, Esq.";
  data["FIRM_NAME"] = "Pinto Law Group";
  data["FIRM_ADDRESS"] = "Elizabeth, New Jersey";

  return data;
}
