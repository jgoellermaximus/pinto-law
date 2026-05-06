/**
 * getIntakePrompt.ts — Template routing for intake submissions
 *
 * Looks up the default workflow template for a given intake type.
 * Handles two template types:
 *
 * 1. "prompt" — returns AI prompt text (original behavior)
 * 2. "document" — runs DOCX merge engine, returns filled document buffer
 *
 * Usage in /api/intake/route.ts:
 *
 *   const result = await resolveIntakeTemplate("attorney_review", intakeData);
 *
 *   if (result.type === "document") {
 *     // result.buffer is a filled DOCX — upload to R2, link to deal
 *   } else {
 *     // result.prompt is an AI prompt — send to LLM for generation
 *   }
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema/legal";
import {
  mergeTemplate,
  buildMergeData,
  type MergeField,
  type MergeResult,
} from "@/lib/legal/docxMerge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntakeTemplateResult =
  | {
      type: "document";
      buffer: Buffer;
      filename: string;
      filledFields: string[];
      missingFields: string[];
      workflowId: string;
      workflowTitle: string;
    }
  | {
      type: "prompt";
      prompt: string;
      workflowId: string | null;
      workflowTitle: string | null;
    };

// ---------------------------------------------------------------------------
// Fallback prompts — used when no workflow template exists
// ---------------------------------------------------------------------------

const FALLBACK_PROMPTS: Record<string, string> = {
  attorney_review: `You are an NJ real estate attorney. Review the following purchase agreement details and generate a professional attorney review letter.

The letter should:
1. Identify the parties, property, and purchase price
2. List standard NJ attorney review modifications
3. Note any unusual clauses or concerns
4. Use professional legal language appropriate for NJ real estate transactions

Deal details:
{{DEAL_DETAILS}}`,

  demand_letter: `You are an NJ attorney. Draft a professional demand letter based on the following details.

Details:
{{DEAL_DETAILS}}`,

  fee_agreement: `You are an NJ attorney. Draft a fee agreement based on the following engagement details.

Details:
{{DEAL_DETAILS}}`,

  expungement_petition: `You are an NJ criminal defense attorney. Draft an expungement petition based on the following details.

Details:
{{DEAL_DETAILS}}`,
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function resolveIntakeTemplate(
  intakeType: string,
  intakeData: Record<string, string | number | null>,
): Promise<IntakeTemplateResult> {
  try {
    // Look up default workflow for this intake type
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.intakeType, intakeType),
          eq(workflows.isDefault, true),
        ),
      )
      .limit(1);

    if (!workflow) {
      // No workflow found — fall through to any workflow, then fallback
      const [anyWorkflow] = await db
        .select()
        .from(workflows)
        .where(eq(workflows.intakeType, intakeType))
        .limit(1);

      if (anyWorkflow) {
        return handleWorkflow(anyWorkflow, intakeData);
      }

      // Absolute fallback — hardcoded prompt
      return {
        type: "prompt",
        prompt: FALLBACK_PROMPTS[intakeType] ?? FALLBACK_PROMPTS.attorney_review,
        workflowId: null,
        workflowTitle: null,
      };
    }

    return handleWorkflow(workflow, intakeData);
  } catch (err) {
    console.error("[resolveIntakeTemplate] error:", err);
    return {
      type: "prompt",
      prompt: FALLBACK_PROMPTS[intakeType] ?? FALLBACK_PROMPTS.attorney_review,
      workflowId: null,
      workflowTitle: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Handle workflow based on template type
// ---------------------------------------------------------------------------

async function handleWorkflow(
  workflow: typeof workflows.$inferSelect,
  intakeData: Record<string, string | number | null>,
): Promise<IntakeTemplateResult> {
  // ── Document template — DOCX merge ──
  if (
    workflow.templateType === "document" &&
    workflow.templateStoragePath &&
    workflow.templateFields
  ) {
    const fields = workflow.templateFields as MergeField[];
    const mergeData = buildMergeData(fields, intakeData);

    // Build a useful filename
    const address = String(intakeData.propertyAddress ?? "document");
    const city = String(intakeData.propertyCity ?? "");
    const safeName = `${address} ${city}`.trim().replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-");
    const filename = `${safeName}-attorney-review.docx`;

    const result: MergeResult = await mergeTemplate(
      workflow.templateStoragePath,
      mergeData,
      filename,
    );

    return {
      type: "document",
      buffer: result.buffer,
      filename: result.filename,
      filledFields: result.filledFields,
      missingFields: result.missingFields,
      workflowId: workflow.id,
      workflowTitle: workflow.title,
    };
  }

  // ── Prompt template — AI generation ──
  if (workflow.promptMd) {
    return {
      type: "prompt",
      prompt: workflow.promptMd,
      workflowId: workflow.id,
      workflowTitle: workflow.title,
    };
  }

  // Workflow exists but has no template or prompt — use fallback
  return {
    type: "prompt",
    prompt:
      FALLBACK_PROMPTS[workflow.intakeType ?? "attorney_review"] ??
      FALLBACK_PROMPTS.attorney_review,
    workflowId: workflow.id,
    workflowTitle: workflow.title,
  };
}

// ---------------------------------------------------------------------------
// Legacy function — kept for backward compatibility
// ---------------------------------------------------------------------------

export async function getIntakePrompt(intakeType: string): Promise<{
  prompt: string;
  workflowId: string | null;
  workflowTitle: string | null;
}> {
  const result = await resolveIntakeTemplate(intakeType, {});

  if (result.type === "prompt") {
    return {
      prompt: result.prompt,
      workflowId: result.workflowId,
      workflowTitle: result.workflowTitle,
    };
  }

  // Document template — can't return as prompt, use fallback
  return {
    prompt:
      FALLBACK_PROMPTS[intakeType] ?? FALLBACK_PROMPTS.attorney_review,
    workflowId: result.workflowId,
    workflowTitle: result.workflowTitle,
  };
}
