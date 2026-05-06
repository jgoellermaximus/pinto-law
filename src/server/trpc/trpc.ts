import { initTRPC, TRPCError } from "@trpc/server";
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema/legal";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export async function createContext(opts: FetchCreateContextFnOptions) {
  const { data: session } = await auth.getSession();

  let userRole: string | null = null;

  if (session?.user?.id) {
    const [profile] = await db
      .select({ role: userProfiles.role })
      .from(userProfiles)
      .where(eq(userProfiles.userId, session.user.id))
      .limit(1);

    userRole = profile?.role ?? null;
  }

  return {
    userId: session?.user?.id ?? null,
    userEmail: session?.user?.email ?? null,
    userName: session?.user?.name ?? null,
    userRole,
    // Default org for Raul's solo practice — will be dynamic with multi-tenant
    organizationId: "pinto-law-group",
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

// ---------------------------------------------------------------------------
// tRPC init
// ---------------------------------------------------------------------------

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// ---------------------------------------------------------------------------
// protectedProcedure — requires authenticated user
// ---------------------------------------------------------------------------

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      userRole: ctx.userRole,
      organizationId: ctx.organizationId,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);
