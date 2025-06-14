import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Define which routes should be public (accessible without authentication)
const isPublicRoute = createRouteMatcher([
  '/',                // Home page - let component handle auth UI
  '/sign-in(.*)',     // Clerk sign in pages
  '/sign-up(.*)',     // Clerk sign up pages
  '/api/socket(.*)',  // Socket.IO endpoints - needed for real-time game features
  '/api/socket-io',   // Socket.IO initialization
  '/api/health',      // Health check endpoint
  '/api/github-webhook', // GitHub webhook (if needed)
  '/api/create-game',     // Creating games - allow guests
  '/api/join-game(.*)',   // Joining games - allow guests
  '/api/game(.*)',        // All game-related API endpoints - allow guests
  '/api/game-state(.*)',  // Game state endpoints - allow guests
  '/api/start-game(.*)',  // Starting games - allow guests
  '/api/start-round(.*)', // Starting rounds - allow guests
  '/api/make-bet(.*)',    // Making bets - allow guests
  '/api/play-card(.*)',   // Playing cards - allow guests
  '/api/lobby-info(.*)',  // Lobby information - allow guests
  '/api/report-bug',      // Bug reports - allow guests
])

// Define which routes should be protected (require authentication)
const isProtectedRoute = createRouteMatcher([
  '/api/create-profile',  // Profile creation requires authentication
  '/api/get-profile',     // Profile access requires authentication
])

export default clerkMiddleware(async (auth, req) => {
  // Get the current path
  const { pathname } = req.nextUrl

  // Log for debugging (remove in production)
  console.log(`Middleware: ${pathname}`)

  // If it's a protected route, require authentication
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // For public routes, no authentication required
  // The middleware will still make auth info available but won't redirect
})

export const config = {
  // Match all routes except static files and API routes that don't need auth
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
} 