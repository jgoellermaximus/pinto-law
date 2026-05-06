/**
 * Activity Logger — audit trail helper
 *
 * Usage:
 *   import { logActivity } from "@/lib/activity";
 *
 *   await logActivity({
 *     organizationId: "pinto-law-group",
 *     actorType: "system",
 *     action: "letter_generated",
 *     entityType: "deal_intake",
 *     entityId: intakeId,
 *     metadata: { templateType: "document", filename: "..." },
 *   });
 *
 * For fire-and-forget (non-blocking):
 *   logActivity({ ... }).catch(console.error);
 */

import { db } from "@/lib/db";
import { activityLog } from "@/lib/db/schema/legal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogActivityParams {
  organizationId: string;
  actorType: "system" | "user";
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Main logger
// ---------------------------------------------------------------------------

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await db.insert(activityLog).values({
      organizationId: params.organizationId,
      actorType: params.actorType,
      actorId: params.actorId ?? null,
      actorName: params.actorName ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    // Never let logging failures break the main flow
    console.error("[activity] Failed to log:", params.action, err);
  }
}

// ---------------------------------------------------------------------------
// Convenience: log with user context from tRPC
// ---------------------------------------------------------------------------

export function logUserActivity(
  ctx: { userId: string; userName?: string | null; organizationId: string },
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return logActivity({
    organizationId: ctx.organizationId,
    actorType: "user",
    actorId: ctx.userId,
    actorName: ctx.userName ?? null,
    action,
    entityType,
    entityId,
    metadata,
  });
}
