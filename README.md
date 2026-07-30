# 🎧 Pass the Aux !

A real-time, collaborative playlist game built with React and Supabase : players anonymously add tracks to a shared session, then try to guess who added what before the big reveal.

**Live demo:** [pass-the-aux-kappa.vercel.app](#) 

---

## Why this project

I built this as a solo full-stack project to go deep on real-time systems, authentication, and API constraints. Every technical decision below was a deliberate problem to solve, not a tutorial to follow. I wanted to build something related to music using Spotify as it's a plateform that I use regularly and I enjoy listening to music on a daily basis to. 

## Tech Stack

`React` `Vite` `Tailwind CSS` `Supabase (Postgres + Auth + Realtime)` `Spotify Web API` `Row Level Security`

## Key Technical Challenges

- **Real anonymity, enforced by the database, not the UI.** Track submitters are hidden during voting through Postgres Row Level Security policies, not by simply omitting a field in the frontend. Even a malicious API call can't leak who added what before the reveal phase.
- **Real-time multiplayer sync.** Player joins, session state changes, and votes propagate instantly across all connected clients via Supabase Realtime (WebSocket-based Postgres change subscriptions). No polling, no manual refresh.
- **OAuth token lifecycle management.** Spotify access tokens expire after ~1 hour; I built a custom persistence layer on top of Supabase Auth to capture and reuse the provider token for direct Spotify Web API calls (search, playback previews).
- **Built around a platform constraint, not despite it.** Spotify's 2026 Developer Mode caps apps at 5 authorized users. I designed the game session model (small private friend groups) to make that limit invisible to the product experience instead of fighting it.
- **Race condition handling with database-level constraints.** Duplicate player joins and duplicate votes are prevented with Postgres unique constraints, not fragile client-side checks : the database is the single source of truth.

## Features

- Spotify OAuth login
- Create/join sessions via shareable link
- Real-time lobby with player avatars
- Track search & submission (Spotify Web API)
- Anonymous voting phase with live audio previews
- Reveal phase with scoring and leaderboard

## Run locally

```bash
git clone https://github.com/Chd06/Pass-the-Aux.git
cd Pass-the-Aux
npm install
```

Create a `.env` file with your own Supabase project credentials:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

```bash
npm run dev
```
