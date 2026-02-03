# Global Leaderboard Setup

This project now includes a shared global leaderboard powered by Supabase. The UI lives in the existing game screen, and scores are written via a server route (`POST /api/score`) that uses the Supabase service role key.

## Supabase setup

1. Create a new Supabase project.
2. Open the SQL editor and run `supabase/leaderboard.sql` to create the `leaderboard_scores` table, RLS policies, and the `upsert_high_score` function.
3. Copy your project URL and anon key from **Project Settings → API**.

## Environment variables

Create a `.env` file in the project root (or set these in your deployment environment):

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Update `index.html` and set the client config (used for anonymous leaderboard reads):

```html
<script>
  window.SUPABASE_CONFIG = {
    url: "your-project-url",
    anonKey: "your-anon-key",
  };
</script>
```

> The service role key is **server-only** and should never be exposed to the browser.

## Local development

1. Install dependencies:

```
npm install
```

2. Start the server:

```
npm run dev
```

The server hosts the static game and exposes `POST /api/score` for score submissions.

## Deployment notes

- Set the same environment variables on your host.
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is available only to the server runtime.
- The leaderboard fetch on the client uses the anon key configured in `index.html`.
