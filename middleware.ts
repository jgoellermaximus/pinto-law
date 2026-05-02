import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    "/((?!auth|api|intake|test-chat|_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js).*)",
  ],
};
