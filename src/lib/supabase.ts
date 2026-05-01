/**
 * Supabase shim — enough API surface for existing frontend to compile.
 * All DB operations will be replaced by tRPC in Task 4/8.
 * TODO: Delete this file once mikeApi.ts is fully replaced.
 */

export const supabase = {
  auth: {
    getSession: async () => ({
      data: { session: { access_token: "" } },
      error: null,
    }),
    onAuthStateChange: (_event: string, _callback: any) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  },
  from: (_table: string) => {
    const noop = () => chain;
    const chain: any = {
      select: noop,
      insert: noop,
      update: noop,
      delete: noop,
      eq: noop,
      neq: noop,
      single: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: any) => resolve({ data: null, error: null }),
    };
    return chain;
  },
};