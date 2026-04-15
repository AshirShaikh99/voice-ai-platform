// Next.js 16 renames middleware.ts → proxy.ts. The Clerk clerkMiddleware()
// helper returns a standard NextMiddleware function, which is the same
// signature Next.js 16 expects for proxy.ts.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
]);

const isOrgRoute = createRouteMatcher(["/orgs/:slug/(.*)", "/select-org(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  if (isOrgRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and common static assets.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on api and trpc routes.
    "/(api|trpc)(.*)",
  ],
};
