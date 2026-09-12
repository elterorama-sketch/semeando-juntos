/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Supabase URL and anon key are safe to ship in the client bundle --
  // access control lives in Postgres RLS, not in keeping these secret --
  // so they're hardcoded here instead of requiring Vercel dashboard env
  // var configuration. SUPABASE_SERVICE_ROLE_KEY must NEVER be added here;
  // it stays a real environment variable, set only in the Vercel dashboard.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://piyixtgeqwmsxxdkyrgd.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpeWl4dGdlcXdtc3h4ZGt5cmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNDE2NjMsImV4cCI6MjEwNDgxNzY2M30.fXdtoUsrrgtRIDHymzhnqYM6RYAjlYOG-0JVW0BBnjs",
  },
};

export default nextConfig;
