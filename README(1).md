# Chat App

A realtime 1:1 and group chat system: Node/Express + MongoDB + Socket.IO backend, React (Vite) web frontend.

## Features
- JWT auth (register/login) — signup now collects phone and bio, and an optional profile photo
- Forgot/reset password via email (Resend) — request a link, click it, set a new password
- Profile pages — view your own or another user's profile (bio, phone for you only, online status, their posts)
- Settings page — edit username/bio/phone/avatar, change password, manage blocked list, and a full Appearance section (theme, sound pack, default chat background)
- User search
- 1:1 direct messages (auto-reuses existing conversation)
- Group chats — create, add/remove members (admin-only), leave group, auto-promotes a new admin if the last one leaves
- Realtime messaging via Socket.IO
- Typing indicators (animated waveform)
- Delivery and read receipts — single/double/blue ticks on your own messages, tracked per-recipient, with offline catch-up on reconnect
- Full timestamps (hover a message for the full date/time) plus day separators ("Today", "Yesterday", full date)
- Online/offline presence
- 1:1 voice and video calls (WebRTC, signaled over Socket.IO) — ringing UI, mute/camera toggle, and the call gets logged into the conversation like a message ("Voice call · 3:24", "Missed video call")
- Image and video sharing (upload via REST, delivered over the socket like any other message)
- Voice notes (in-browser mic recording via MediaRecorder, uploaded as an audio attachment)
- Message editing and deleting (soft delete — shows "This message was deleted")
- In-conversation message search, with jump-to-message for anything already loaded
- Blocking — blocked users can't message you, can't find you in search, and can't start a new conversation or call with you (checked server-side)
- A posts feed — share photos/videos with a caption and control who sees each post (everyone / your contacts / hand-picked people), visible on the Feed page and on profiles
- Per-conversation chat background (color/gradient presets or a custom uploaded image) plus a global default set from Settings
- Five synthesized sound packs for keyboard/send/receive sounds (Classic, Soft Pop, Typewriter, Marimba, Crystal) — no audio files, all generated with the Web Audio API
- Light/dark theme, defaults to OS preference, toggle in the sidebar or Settings

## Project structure
```
chat-app/
  backend/     Express API + Socket.IO server
  frontend/    React (Vite) web client
```

## Prerequisites
- Node.js 18+
- MongoDB running locally or a connection string (e.g. MongoDB Atlas)
- A [Resend](https://resend.com) account + API key, if you want "forgot password" emails to actually send (the app still runs fine without one — it just logs an error server-side and the person won't get an email)

## Backend setup
```bash
cd backend
cp .env.example .env    # fill in MONGO_URI, JWT_SECRET, and RESEND_API_KEY
npm install
npm run dev              # nodemon, or `npm start` for plain node
```
Server runs on http://localhost:5000 by default. Health check: `GET /api/health`.

## Frontend setup
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
App runs on http://localhost:5173.

## Design
The UI ("Pulse") aims for a mature, premium feel rather than generic chat-app chrome:
- **Palette**: cool neutral light theme and a warm-black dark theme (not pure black), both built around a violet gradient accent (`--gradient-accent`) and a coral "live" color used only for recording/missed-call state and the online presence dot.
- **Type**: Fraunces (a characterful serif) for the wordmark, hero headlines, and empty states only; Inter for all functional UI text; IBM Plex Mono for timestamps, call durations, and voice note durations, which gives them a "transmission log" feel.
- **Signature touches**: an animated waveform typing indicator instead of "X is typing…" text, a soft radiating pulse on the online presence dot, a gradient "hero" panel on auth pages and the call overlay, and gradient-filled primary buttons with a subtle hover lift.
- **Theme toggle**: sun/moon icon in the sidebar or a segmented control in Settings → Appearance. Defaults to the OS-level `prefers-color-scheme`, then remembers your choice in `localStorage`. Respects `prefers-reduced-motion` by disabling the pulse/wave animations.

## How the realtime layer works
- On login, the client connects a Socket.IO connection authenticated with the JWT (sent via `socket.handshake.auth.token`).
- The server verifies the token in Socket.IO middleware, then joins the socket to a room per conversation (`conversation:<id>`) and a personal room (`user:<id>`) used for call signaling.
- Sending a message emits `message:send` with an ack callback; the server persists it to MongoDB then broadcasts `message:new` to everyone in that conversation's room.
- **Delivery/read tracking**: when a message is created, the server checks which other participants are currently online (in-memory `Map<userId, Set<socketId>>`) and marks the message delivered to them immediately. Anyone who was offline gets caught up the moment they reconnect (`catchUpDelivery` in `backend/src/sockets/index.js`), which fires `message:delivered` for anything they'd missed. Reading a message (`message:read`) marks it both read and delivered. The tick shown on your own messages (`frontend/src/components/MessageTicks.jsx`) is computed client-side from `deliveredTo`/`readBy` against the conversation's other participants — single check = saved, double gray = delivered to everyone else, double violet = read by everyone else.
- Typing indicators (`typing:start` / `typing:stop`) follow the same room-broadcast pattern.
- Presence is tracked in-memory so a user with multiple tabs/devices open is only marked offline once every socket disconnects.

## How calls work
1:1 voice/video calls use WebRTC for the actual audio/video, with Socket.IO only relaying signaling messages (SDP offers/answers, ICE candidates) — the server never touches media.
- `frontend/src/context/CallContext.jsx` owns the whole state machine (`idle → outgoing/incoming → active`), the `RTCPeerConnection`, and ICE candidate buffering (candidates that arrive before the peer connection exists yet — e.g. before the callee has accepted — are queued and flushed once the remote description is set).
- Only a public STUN server (`stun:stun.l.google.com:19302`) is configured. That's enough on most networks, but calls between two people on restrictive/symmetric NATs may fail to connect — a production deployment would need a TURN server (e.g. Twilio's or a self-hosted coturn) as a relay fallback.
- When a call ends, the caller's client logs it as a regular message via the `call:log` event (`"Voice call · 3:24"`, `"Missed video call"`, etc.) so it shows up in the conversation history like WhatsApp's call log entries.
- Calls are 1:1 only — there's no group calling. Call buttons only appear in direct-message headers, not group headers.

## How media (images/video/voice notes/posts) works
Media doesn't go over the socket directly — sockets aren't a great fit for large binary payloads. Instead:
1. Client uploads the file via `POST /api/uploads` (for chat attachments) or `POST /api/posts` (for feed posts) — both multipart/form-data.
2. The server saves it to `backend/uploads/<images|videos|audio|avatars>/` with a UUID filename.
3. For chat messages, the client then emits `message:send` over the socket with the returned attachment metadata. For posts, the post is just created directly via the REST call.
4. `/uploads` is served as static files by Express — see `frontend/src/utils/media.js` for how relative paths get resolved to full URLs.

Voice notes follow the same upload path: the browser's `MediaRecorder` API records a `Blob`, uploaded exactly like an image/video file with `type: 'audio'`.

**Storage note:** uploads currently live on local disk. That's fine for development, but a real deployment (especially anything beyond one server) should swap the multer disk storage for something like S3/Cloudinary — see "Next steps" below.

## Posts & visibility
Posts are separate from chat messages — think a lightweight feed rather than disappearing stories (they don't expire). Each post has a `visibility`:
- **Everyone** — any user who hasn't blocked you (and whom you haven't blocked) can see it.
- **My contacts** — visible only to people you share at least one conversation with (computed from the `Conversation` collection, not a separate friends list).
- **Selected people** — a hand-picked list chosen in the composer, stored as `visibleTo` on the post.

The feed (`GET /api/posts/feed`) and a profile's posts (`GET /api/posts/user/:userId`) both run every post through the same visibility check server-side (`backend/src/controllers/postController.js`) — the client never has to enforce this itself.

## Forgot / reset password
Uses [Resend](https://resend.com) to send the actual email. The flow:
1. `POST /api/auth/forgot-password` — if the email matches an account, generates a random token, stores only its SHA-256 hash on the user (with a 1-hour expiry), and emails a link containing the raw token via Resend. The response is always the same generic message whether or not the email exists, so this endpoint can't be used to enumerate registered emails.
2. The link (`/reset-password?token=...`) lets the person set a new password; `POST /api/auth/reset-password` re-hashes the submitted token and matches it against the stored hash + expiry.

**To actually receive emails**, put your Resend API key in `backend/.env` as `RESEND_API_KEY`. Without it, the request still "succeeds" (for the reasons above) but the server logs an email-send error and no email goes out — useful for local dev without a Resend account, but you'll want it set for real use.

## Chat backgrounds
A background can be set two ways: per-conversation (via the 🎨 icon in a chat header) or as a global default (Settings → Appearance → Chat background). Per-conversation choices are stored in `localStorage` per device and take priority; if a conversation has no override, it falls back to the global default. Neither is synced across devices — that's a deliberate MVP simplification (see "Next steps").

## Sound effects
Keyboard clicks and send/receive chimes are synthesized with the Web Audio API (`frontend/src/utils/sound.js`) — no audio files to ship. There are five selectable packs (Classic, Soft Pop, Typewriter, Marimba, Crystal), each defined as a small set of oscillator/noise parameters; pick one and preview it in Settings → Appearance. The on/off toggle lives in both the sidebar (quick access) and Settings.

## REST API summary
| Method | Route | Description |
|---|---|---|
| POST | /api/auth/register | Create account (multipart — accepts `avatar` file plus `phone`/`bio`) |
| POST | /api/auth/login | Log in |
| GET | /api/auth/me | Get current user (auth required) |
| POST | /api/auth/forgot-password | Request a password reset email |
| POST | /api/auth/reset-password | Reset password using the emailed token |
| GET | /api/users/search?q= | Search users by username/email (excludes blocked relationships) |
| GET | /api/users/:id | Public profile of any user |
| PUT | /api/users/me | Update your own profile (multipart, avatar optional) |
| PUT | /api/users/me/password | Change password (requires current password) |
| POST | /api/users/:id/block | Block a user |
| POST | /api/users/:id/unblock | Unblock a user |
| GET | /api/users/me/blocked | List users you've blocked |
| GET | /api/conversations | List my conversations |
| POST | /api/conversations | Create 1:1 or group conversation (blocked-aware for 1:1) |
| POST | /api/conversations/:id/participants | Add member to a group (admin only) |
| DELETE | /api/conversations/:id/participants/:userId | Remove a member (admin only) |
| POST | /api/conversations/:id/leave | Leave a group yourself |
| GET | /api/conversations/:id/messages | Paginated message history |
| GET | /api/conversations/:id/messages/search?q= | Search messages within a conversation |
| POST | /api/uploads | Upload an image/video/audio file (multipart), returns attachment metadata |
| POST | /api/posts | Create a post (multipart: `media` file, `caption`, `visibility`, `visibleTo`) |
| GET | /api/posts/feed | Visibility-filtered feed of posts from other people |
| GET | /api/posts/user/:userId | One user's posts, visibility-filtered for you |
| DELETE | /api/posts/:id | Delete your own post |

## Socket.IO events
| Event | Direction | Description |
|---|---|---|
| `conversation:join` | client → server | Join a conversation's room (e.g. right after creating it) |
| `message:send` | client ↔ server | Send a message (text and/or attachment); ack + `message:new` broadcast |
| `message:edit` | client ↔ server | Edit your own message; ack + `message:edited` broadcast |
| `message:delete` | client ↔ server | Soft-delete your own message; ack + `message:deleted` broadcast |
| `message:read` | client → server → broadcast | Mark a message read (also marks it delivered) |
| `message:delivered` | server → client | Broadcast when a message reaches an online recipient, including offline catch-up on reconnect |
| `call:log` | client ↔ server | Log a finished call as a message; ack + `message:new` broadcast |
| `typing:start` / `typing:stop` | client → server → broadcast | Typing indicator |
| `presence:update` | server → client | Broadcast when a contact comes online/offline |
| `call:invite` / `call:accept` / `call:decline` / `call:cancel` / `call:end` | client ↔ server → target user | Call signaling (ringing, pickup, hangup) |
| `call:ice-candidate` | client → server → target user | WebRTC ICE candidate relay |

## Notes / next steps
- **Scaling beyond one server**: Socket.IO's in-memory presence map and rooms work for a single Node process. If you deploy multiple instances, add the [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/) so broadcasts (including call signaling, which relies on a personal `user:<id>` room) reach sockets connected to other instances.
- **TURN server for calls**: only STUN is configured; add a TURN server for reliable connections across restrictive NATs/firewalls in production.
- **Media storage in production**: swap multer's disk storage for an S3-compatible bucket (or Cloudinary). The upload controllers are the only place that needs to change — the socket/message flow stays the same. Note that deleting a post or message doesn't currently clean up its underlying file on disk.
- **Mobile (React Native)**: this backend is platform-agnostic — the same REST endpoints and Socket.IO events can be reused from a React Native client with `socket.io-client` and the same JWT flow (store the token in SecureStore/AsyncStorage instead of localStorage). WebRTC on RN would use `react-native-webrtc` instead of the browser's built-in APIs, but the signaling events are unchanged.
- **Message search limitation**: search matches are found via a case-insensitive regex on `Message.text` within one conversation — fine at this scale, but a dedicated search index (MongoDB Atlas Search) would be worth it at higher message volume. "Jump to message" only works for messages already loaded in the open conversation.
- **Group admin model is intentionally minimal**: any admin can add/remove members; there's no "owner" concept, and promotion only happens automatically when the last admin leaves.
- **Production hardening to add later**: rate limiting on auth routes (especially `/forgot-password`, to prevent email-bombing an address), input validation (e.g. `zod`/`joi`), refresh tokens, message pagination on scroll (the `before` query param on `/messages` is already wired for this), push notifications for mobile, virus/content scanning on uploads.
