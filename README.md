# 🎧 Pass the Aux!

**Pass the Aux** is a work-in-progress multiplayer music guessing game. Players join a private session, anonymously submit tracks, then try to guess **who submitted each song** before the reveal.

> **Status:** Early prototype — first four-player user test completed. Core multiplayer flows are being stabilized; this is not yet a polished public release.

## Why I built it

I wanted to build a music-related application while learning more about full-stack development, authentication, third-party APIs, and real-time multiplayer state. This is a solo project, and the first user-testing session has helped me prioritize what to improve next.

## Tech stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend / data:** Supabase (PostgreSQL, Auth, Realtime)
- **Music integration:** Spotify Web API
- **Access control:** PostgreSQL Row Level Security (RLS)

## Gameplay (intended flow)

1. Create a session and invite friends using a session code or link.
2. Players join a lobby and submit songs for the round.
3. During the guessing phase, players identify who submitted each track.
4. Reveal the answers and show the results.

Some of these steps are still being debugged. The description above explains the intended game, not a guarantee that every flow works end to end.

## What works in the current prototype

- Spotify-based sign-in and song search
- Creating sessions and joining via a session code
- Showing player names and profile pictures in the lobby, with real-time updates
- Submitting tracks to a session

## Known issues from the first user test

- **Invitation link:** the copied session-specific invitation link can lead to a page-not-found error; entering the session code works. Sharing the application's base URL also works.
- **Refresh / reconnect:** a guest may lose the session flow after refreshing the page.
- **Guessing phase:** a player may only see the tracks they submitted, rather than all eligible tracks in the round.
- **Audio previews:** listening to track previews is not working yet.

These issues are being investigated; please do not rely on the current deployment for a full game.

## Roadmap

### Priority 0 — make the game playable end to end
- [ ] Fix session invitation links and routing
- [ ] Restore session state reliably after refresh
- [ ] Correct the set of tracks shown during guessing

### Priority 1 — improve the experience
- [ ] Enable audio previews where supported by the Spotify API
- [ ] Explain the rules before the game starts
- [ ] Improve the UI and player feedback during each phase

### Ideas to explore
- [ ] Generate a playlist from the tracks submitted during a session
- [ ] Test a one-by-one guessing flow instead of showing all tracks at once
- [ ] Make invitation links shorter and easier to share

## Engineering topics explored

- Supabase Realtime for multiplayer presence and state updates
- Spotify OAuth and API integration
- PostgreSQL constraints and Row Level Security for data integrity and access control
- Client-side session management and routing
- User testing, bug triage, and iterative improvements

## Run locally

```bash
git clone https://github.com/Chd06/Pass-the-Aux.git
cd Pass-the-Aux
npm install
```

Create a `.env` file and supply your own Supabase project configuration:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

```bash
npm run dev
```

You will also need a compatible Supabase project and Spotify developer configuration for authentication and music-related features. Local setup is not fully documented yet.

## Demo

The deployed prototype is available at **https://pass-the-aux-kappa.vercel.app/**, but the multiplayer experience currently has known bugs. A stable playable demo will be shared after further fixes.

---

*Built as a learning project. Feedback and suggestions are welcome.*
