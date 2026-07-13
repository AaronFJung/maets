# The Maets Protocol for Turn-Based Games

> **Status:** DRAFT — design specification only. **No implementation exists yet.**
> This document is the single source of truth. Implementation must follow this
> spec; when the two disagree, fix the spec first, then the code.
>
> **Protocol version:** `1` &nbsp;•&nbsp; **Package:** `maets-realtime` &nbsp;•&nbsp; **Transport:** Supabase Realtime

Maets is a lightweight, **game-agnostic protocol for online turn-based games**
(tic-tac-toe, Connect Four, checkers, battleship, …) that runs entirely on
**Supabase Realtime** — no dedicated game server. It handles matchmaking-by-code,
turn ordering, hidden information, spectating, disconnect/pause, and reconnection,
while each individual game plugs in only its own rules.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Requirements](#3-requirements)
4. [Terminology](#4-terminology)
5. [Architecture](#5-architecture)
6. [Transport Binding (Supabase Realtime)](#6-transport-binding-supabase-realtime)
7. [Identity & Seats](#7-identity--seats)
8. [State Model: The Event Log](#8-state-model-the-event-log)
9. [Roles & Authority](#9-roles--authority)
10. [Message Envelopes](#10-message-envelopes)
11. [Ordering, Sequencing & Idempotency](#11-ordering-sequencing--idempotency)
12. [Lifecycle & State Machines](#12-lifecycle--state-machines)
13. [The Game Plugin Contract](#13-the-game-plugin-contract)
14. [Hidden Information & Trust Model](#14-hidden-information--trust-model)
15. [Reconnection & Resume](#15-reconnection--resume)
16. [Spectators](#16-spectators)
17. [Error Handling & Edge Cases](#17-error-handling--edge-cases)
18. [Persistence & Replay](#18-persistence--replay)
19. [Versioning & Compatibility](#19-versioning--compatibility)
20. [Security & Threat Model](#20-security--threat-model)
21. [Worked Examples](#21-worked-examples)
22. [Public API Surface](#22-public-api-surface)
23. [Open Questions & Future Work](#23-open-questions--future-work)
24. [Appendix: Constants & Quick Reference](#24-appendix-constants--quick-reference)

---

## 1. Overview

A **match** is a single instance of a game between a fixed set of **seats**
(2 for the launch games, but the core supports N). Players find each other with a
short **room code**. All communication for a match happens over one Supabase
Realtime **channel**.

The design rests on four decisions (see the rationale inline throughout):

| Decision | Choice |
| --- | --- |
| **Source of truth** | Host-authoritative client (a *sequencer*), not a DB |
| **Hidden information** | Each player owns its own secret; results are revealed on demand |
| **Game integration** | A pure `reduce` + `isLegal` plugin per game; the core is generic |
| **Disconnect handling** | Pause & wait for reconnect; migrate the sequencer if the host drops |

The key mechanism: **all accepted events flow through a single sender (the
sequencer), which is what gives us a clean total order over Supabase broadcast.**
Every participant keeps a full replica of the public event log, so if the
sequencer disconnects, any remaining player can be deterministically elected to
take over without losing state.

---

## 2. Goals & Non-Goals

### Goals

- **Serverless core.** Runs on Supabase Realtime (broadcast + presence) alone.
  No custom WebSocket server, no authoritative backend, for the launch games.
- **Game-agnostic.** The transport, turn loop, sync, reconnect, spectate, and
  migration logic know nothing about any specific game.
- **Recordable, replayable state.** State is derived deterministically from an
  ordered event log; any point can be reconstructed by replaying it.
- **Resilient sessions.** A player can disconnect and return to the same seat as
  long as the match still has a live participant.
- **Hidden information done fairly.** No participant — not even the host — ever
  holds another player's secret state.
- **Spectating.** Anyone with the code can watch live, read-only, and catch up
  from mid-game.

### Non-Goals (for v1)

- **Anti-cheat / verifiable fairness.** Reveals are self-reported and trusted.
  A malicious client can lie or peek. See [§20](#20-security--threat-model).
- **Authentication / authorization.** Identity is a self-asserted opaque id.
- **Durable persistence by default.** Matches are ephemeral (in-memory across
  the participants' browsers). Optional post-match flush is described in [§18](#18-persistence--replay).
- **Matchmaking / discovery beyond room codes.** No lobby browser, no ranking.
- **Server-side rule enforcement.** The "authority" is a player's browser.
- **Real-time / continuous games.** Strictly turn-based (incl. simultaneous
  turns), not action games.

---

## 3. Requirements

### Functional Requirements

- **FR-1** A user can **create** a match and receive a shareable **room code**.
- **FR-2** A user can **join** a match by entering its room code.
- **FR-3** The system **assigns seats** deterministically; the creator is seat `0`.
- **FR-4** When a match is full, additional joiners become **spectators**.
- **FR-5** A player can **submit an action**; it is validated (`isLegal`) and
  either **accepted** (appended to the log) or **rejected** with a reason.
- **FR-6** The protocol supports **strict alternating turns** and **simultaneous
  turns** (e.g. battleship placement) via a per-state set of *active seats*.
- **FR-7** The protocol supports **hidden information**: an action may require a
  **reveal** from the owning player before it can be finalized.
- **FR-8** Any participant can **spectate** read-only and **catch up** to current
  state upon joining mid-match.
- **FR-9** A disconnected player can **reconnect** and reclaim their seat while
  the match is still live.
- **FR-10** On any participant disconnect, the match **pauses** if it can no
  longer legally proceed, and **resumes** when the needed participant returns.
- **FR-11** If the **sequencer** disconnects, authority **migrates** to another
  connected player with no loss of accepted state.
- **FR-12** The protocol **detects game over** and reports the result.
- **FR-13** A new **game** can be added by implementing the plugin contract in
  [§13](#13-the-game-plugin-contract) with **zero changes to the core**.
- **FR-14** A **room** persists across games. After a game ends, the **host**
  starts the next game in the same room — the **same** game (rematch) or a
  **different** one — with no re-join and no new code.
- **FR-15** Selecting a game (re)starts a fresh **game session**; seats, roster,
  and presence carry over, and the first-mover is rotated across sessions for
  fairness.

### Non-Functional Requirements

- **NFR-1 (Transport)** Core depends only on Supabase Realtime channels
  (`broadcast` + `presence`), consistent with the existing `useChat` usage.
- **NFR-2 (Latency)** A move reaches opponents in a single relay hop (no reveal)
  or two hops (with reveal).
- **NFR-3 (Determinism)** Given the same event log, every replica computes an
  identical public state.
- **NFR-4 (Idempotency)** Duplicate delivery of any message must not corrupt
  state; every accepted event is uniquely keyed.
- **NFR-5 (Validation)** Every inbound message is schema-validated (Zod) before
  use; malformed messages are dropped, never trusted.
- **NFR-6 (Extensibility)** The core supports `N` seats and `M` spectators; the
  launch games use `N = 2`.
- **NFR-7 (Portability)** The core is framework-agnostic TypeScript; a React
  `useMatch` hook wraps it (see [§22](#22-public-api-surface)).
- **NFR-8 (Ephemerality)** No server-side state is required; a match exists only
  while ≥1 participant is connected (unless optionally flushed, [§18](#18-persistence--replay)).

---

## 4. Terminology

| Term | Definition |
| --- | --- |
| **Match** / **Room** | The persistent container for a **code**: channel, identity, seats, presence, and a *sequence of game sessions*. Outlives any single game. |
| **Game session** | One play-through of a single game inside a match, with its own `sessionId` and game state. A match may host many, one after another. |
| **Registry** | The client-side map of `gameId → Game` plugin that a room can select from. |
| **Code** | Short human-shareable string (e.g. `PLUM-42`) that maps to a channel. |
| **Channel** | The single Supabase Realtime channel carrying a match's traffic. |
| **Participant** | Any connected client on the channel: a player or a spectator. |
| **Player** | A participant occupying a **seat**; may submit actions. |
| **Seat** | An integer `0..N-1` role slot bound to one `playerId`. |
| **Spectator** | A participant with no seat; read-only. |
| **Sequencer** (a.k.a. *host*) | The one participant currently authoritative for ordering & validation. Always a connected player. |
| **Event** | An immutable, sequence-numbered entry in the log (a `control` or a `move`). |
| **Event log** | The ordered, append-only list of events that fully determines match state. |
| **Action** | A game-defined move a player proposes (e.g. `{ place: 4 }`). |
| **Reveal** | A game-defined result computed from a player's secret (e.g. `hit`). |
| **Public state** | The game state visible to everyone; derived from the log. |
| **Private state** | A player's secret, held only on that player's client. |
| **Snapshot** | A point-in-time copy of public state + `lastSeq`, sent to joiners. |
| **`playerId`** | A stable, opaque, self-asserted identity string per user. |

---

## 5. Architecture

```
                       Supabase Realtime channel:  maets:v1:match:PLUM-42
   ┌───────────────────────────────────────────────────────────────────────┐
   │  broadcast event "m"  (discriminated-union payload)   +   presence      │
   └───────────────────────────────────────────────────────────────────────┘
        ▲   │ submit                ▲   │ event (accepted, ordered)     ▲
        │   ▼                       │   ▼                               │
   ┌─────────────┐   propose   ┌──────────────┐   fan-out (single   ┌──────────┐
   │  Player B   │ ──────────▶ │  SEQUENCER   │ ─── sender = total ─│ Spectator│
   │  (seat 1)   │ ◀────────── │  = Player A  │     order) ────────▶│ (no seat)│
   │ own secret  │  reveal-req │  (seat 0)    │                     │ read-only│
   └─────────────┘  reveal-res │ public log + │                     └──────────┘
        holds its own          │ own secret   │
        private board          └──────────────┘
                                 holds ITS OWN secret only
```

- The **sequencer** is the only writer of accepted `event`s. Because every
  accepted event has one sender, Supabase delivers them **FIFO to all
  participants → a single total order**.
- Every participant **replicates the full public log** and derives public state
  locally via the game's pure `reduce`. Replicas are how migration is lossless.
- **Secrets never travel.** A shot against a hidden board is resolved by asking
  the *owner* to reveal only the result (`hit`/`miss`/`sunk`). The owner's board
  stays on the owner's device — even the sequencer never sees it.
- **Presence** (Supabase's presence feature) is the liveness signal that drives
  pause/resume and sequencer election.
- **The room outlives any one game.** A match is a persistent room (code,
  channel, seats, presence); each game is a *session* inside it. When a game
  ends, the host picks the next one — the same game (rematch) or a different one
  — and the room continues (§12.7).

---

## 6. Transport Binding (Supabase Realtime)

### 6.1 Channel

One channel per match:

```
maets:v{PROTOCOL_VERSION}:match:{CODE}
e.g.  maets:v1:match:PLUM-42
```

Created exactly as in `useChat`:

```ts
const channel = supabase.realtime.channel(channelName, {
  config: {
    broadcast: { self: false, ack: false },
    presence:  { key: playerId },   // reconnect replaces the same presence key
  },
});
```

- `broadcast.self = false` — a client never receives its own broadcast; the
  sequencer applies its own accepted events locally at append time (see §11).
- `presence.key = playerId` — a reconnecting client re-registers under the same
  key, so presence `join`/`leave` map cleanly to identity.

### 6.2 One broadcast event, discriminated payload

All protocol traffic uses a **single** broadcast event name, `"m"`, with the
message type carried inside the payload's `t` field (compare `useChat`'s single
`"msg"` event). This means one `.on("broadcast", { event: "m" }, …)` handler and
a discriminated-union parse.

```ts
channel.on("broadcast", { event: "m" }, ({ payload }) => {
  const msg = MaetsMessage.safeParse(payload);   // Zod
  if (!msg.success) return;                       // NFR-5: drop malformed
  dispatch(msg.data);
});
channel.send({ type: "broadcast", event: "m", payload: envelope });
```

### 6.3 Presence payload

Each connection tracks:

```ts
type MaetsPresence = {
  playerId: string;
  role: "player" | "spectator" | "pending";  // "pending" until welcomed
  seat: number | null;                        // null for spectator/pending
  name: string;                               // display name
  v: number;                                  // protocol version
};
```

Presence `sync`/`join`/`leave` events are the **only** liveness source. The
protocol never invents its own heartbeat.

---

## 7. Identity & Seats

- **`playerId`** is a stable, opaque, self-asserted string persisted in
  `localStorage` (key: `maets:playerId`), generated with `crypto.randomUUID()`
  on first use. It is **not** authenticated (v1 non-goal) and MAY later be
  replaced by a Supabase auth user id with no protocol change.
- A **seat** is an integer `0..N-1`. **Seat 0 is the match creator** and the
  initial sequencer.
- Seat assignment is **authoritative and recorded in the log** (a `seat-claimed`
  control event), so the roster is deterministic from the log alone — critical
  for reconnect and migration.
- **Reclaiming a seat:** if a joiner's `playerId` already owns a seat in the
  roster, that join is a **reconnect**; the sequencer returns a snapshot for the
  existing seat rather than allocating a new one.
- **Overflow → spectator:** if all seats are taken and the `playerId` owns none,
  the joiner is admitted as a spectator (FR-4). Spectators are tracked via
  presence only and are **not** written to the log.

---

## 8. State Model: The Event Log

### 8.1 The log

The authoritative history of a match is an **append-only, contiguously
sequence-numbered list of events**:

```ts
type Seat = number;

type LogEntry =
  | { seq: number; actionId: string; ts: number; by: "core"; kind: "control"; event: ControlEvent }
  | { seq: number; actionId: string; ts: number; by: Seat;   kind: "move";    action: unknown; reveal?: unknown };

type ControlEvent =
  | { c: "seat-claimed"; seat: Seat; playerId: string; name: string }
  | { c: "game-selected"; sessionId: string; gameId: string; version: string; seatOrder: Seat[] }
  | { c: "paused";  reason: "disconnect" | "reveal-timeout" | "manual"; waitingOn: Seat[] }
  | { c: "resumed" }
  | { c: "sequencer-changed"; seat: Seat; playerId: string }
  | { c: "game-over"; result: GameResult };
```

- `seq` starts at `0` and increases by exactly `1` per accepted event (no gaps).
- `actionId` is the idempotency key (UUID) minted by the proposer; for control
  events it is minted by the sequencer.
- `move` entries carry the game `action`, plus an optional `reveal` result when
  hidden information was resolved (see §14).
- Each `game-selected` opens a new **game session**: every subsequent `move`
  entry belongs to it, and game state is re-initialized (see §8.2, §12.7).

### 8.2 Deriving state

Match state is the fold of two reducers over the log:

```ts
type MatchState = {
  meta: MatchMeta;      // ROOM-level state — produced by the CORE reducer
  game: unknown;        // PUBLIC state of the CURRENT game session (§13)
  lastSeq: number;      // seq of the most recently applied entry (−1 if none)
};

type MatchMeta = {
  phase: "lobby" | "active" | "paused" | "finished";
  roster: Record<Seat, { playerId: string; name: string; connected: boolean }>;
  sequencerSeat: Seat;
  activeGameId: string | null;        // which game the current session is playing
  sessionId: string | null;           // id of the current game session
};
```

- The **core reducer** consumes `control` events → `MatchMeta` (room-level:
  phase, roster, sequencer, active game, session).
- The **game reducer** — the plugin for `meta.activeGameId` — consumes only the
  `move` events of the **current session** → public game state. A
  `game-selected` resets it to `game.init(seatOrder)`; `game-over` freezes it.
- A participant applies `applyEntry(state, entry)` for each entry in `seq` order.

### 8.3 Snapshots

Replaying from `seq 0` is fine for short games, but the canonical catch-up path
is a **snapshot** so late joiners don't need full history and so no historical
detail is re-broadcast:

```ts
type Snapshot = {
  meta: MatchMeta;  // includes activeGameId + sessionId, so the joiner knows which game to instantiate
  game: unknown;    // PUBLIC state of the current session only — never any private state
  lastSeq: number;
};
```

A joiner applies the snapshot, then applies any `event`s with `seq > lastSeq`,
buffering out-of-range entries and requesting a resync on a persistent gap (§11).

---

## 9. Roles & Authority

### 9.1 Sequencer (host) responsibilities

Exactly one connected player is the sequencer at any time. It MUST:

1. **Assign seats** — respond to `hello` with either a `seat-claimed` event
   (new player) or a `snapshot` (reconnecting player / spectator).
2. **Validate moves** — for each `submit`, parse `action` with
   `game.actionSchema`, then run `game.isLegal(state, action, by)` and verify
   `by ∈ game.activeSeats(state)`.
3. **Resolve reveals** — if `game.needsReveal(state, action)` returns a seat,
   drive the reveal handshake (§14), parsing the returned `reveal` with
   `game.revealSchema`, before finalizing.
4. **Order & append** — assign the next `seq`, append the accepted `LogEntry`,
   apply it locally, and broadcast it as an `event`.
5. **Reject** — send a `reject` (point-to-point) for illegal/out-of-turn/stale
   submits.
6. **Serve snapshots** — answer reconnect/spectate/resync requests.
7. **Manage phase** — emit `paused`/`resumed`/`game-over` control events.
8. **Select & start games** — on the host's choice, emit `game-selected` (§12.7)
   to (re)start play from `LOBBY` or `FINISHED`. The choice is **unilateral** and
   takes effect immediately for everyone present.

The sequencer is authoritative over **public flow only**. It has **no access to
any player's private state**, including for reveal resolution (it asks the owner).

### 9.2 Player responsibilities

- Hold a full replica of the log and derive public state.
- Hold and persist **its own** private state (§15.3).
- Propose actions via `submit`; retry unacknowledged submits (§11).
- Answer `reveal-req` addressed to it from its private state.
- Participate in election when eligible.

### 9.3 Election (sequencer migration)

Election is a **pure function of shared state**, so all replicas reach the same
answer without a vote:

```
newSequencer = the connected player with the LOWEST seat index
   where "connected" = playerId present in the current presence set
   and    "player"   = seat exists in meta.roster (spectators excluded)
```

- **Trigger:** presence shows the current `sequencerSeat`'s `playerId` has left.
- **Action:** each replica computes `newSequencer`. The winner sets its next
  `seq = lastSeq + 1`, emits a `sequencer-changed` control event, then drives
  pause/resume as appropriate.
- **Split-brain guard:** if two clients ever believe they won, the **lower seat
  wins**; a higher-seat claimant that sees a `sequencer-changed` from a lower
  seat immediately stands down. Duplicate `seq` values are reconciled by
  idempotency (§11).
- Spectators are **never** elected.

---

## 10. Message Envelopes

Every broadcast payload is an **Envelope**. `to` is absent for
broadcast-to-all and set to a `playerId` for point-to-point (recipients whose
`playerId !== to` ignore it).

```ts
type Envelope = {
  v: 1;              // protocol major version
  match: string;     // room code
  mid: string;       // message id (UUID) — tracing / transient dedupe
  from: string;      // sender playerId
  to?: string;       // target playerId (point-to-point); omit for broadcast
  ts: number;        // sender epoch ms (advisory, not trusted for ordering)
  t: MessageType;    // discriminator (below)
  /* ...type-specific fields... */
};
```

| `t` | Direction | Kind | Purpose |
| --- | --- | --- | --- |
| `hello` | joiner → all (sequencer acts) | transient | Announce arrival; request seat/spectate. |
| `snapshot` | sequencer → joiner (`to`) | transient | Public state + `lastSeq` for catch-up. |
| `submit` | player → sequencer | transient | Propose a game action. |
| `event` | sequencer → all | **log** | An accepted, ordered `LogEntry`. |
| `reject` | sequencer → player (`to`) | transient | A submit was refused, with reason. |
| `reveal-req` | sequencer → owner (`to`) | transient | Ask owner to resolve a hidden action. |
| `reveal-res` | owner → sequencer (`to`) | transient | Owner's revealed result. |
| `resync` | participant → sequencer | transient | Request a fresh snapshot (gap/recovery). |

Type-specific fields:

```ts
// t: "hello"
{ playerId: string; name: string; want: "player" | "spectator";
  games: Array<{ id: string; version: string }>; }  // games this client's registry supports

// t: "snapshot"
{ snapshot: Snapshot; yourSeat: number | null; yourRole: "player" | "spectator"; }

// t: "submit"
{ actionId: string; action: unknown; }          // validated by game.actionSchema (§13)

// t: "event"
{ entry: LogEntry; }                             // see §8.1

// t: "reject"
{ actionId: string; reason: RejectReason; message?: string; }

// t: "reveal-req"
{ revealId: string; forActionId: string; action: unknown; }

// t: "reveal-res"
{ revealId: string; reveal: unknown; }           // validated by game.revealSchema (§13)

// t: "resync"
{ haveSeq: number; }

type RejectReason =
  | "not-your-turn" | "illegal-move" | "match-not-active"
  | "unknown-seat"  | "version-mismatch" | "match-full" | "stale";
```

Every message type has a corresponding **Zod schema**; parsing failures are
dropped silently (NFR-5), consistent with `useChat`.

The two **game-defined** payloads — `submit.action` and `reveal-res.reveal` —
have no fixed shape at the protocol layer. The core validates them against the
active game's `actionSchema` / `revealSchema` (§13): a `submit` whose `action`
fails its schema is `reject`ed (`illegal-move`); a `reveal-res` whose `reveal`
fails its schema is dropped and re-requested. `Setup` and `Private` never cross
the wire, so they need no envelope schema.

---

## 11. Ordering, Sequencing & Idempotency

- **Total order** comes from the single-sender rule: only the sequencer emits
  `event`s, and Supabase delivers one sender's broadcasts in FIFO order, so all
  replicas see the same sequence.
- **Contiguity:** `seq` increments by exactly 1. A replica applies an entry only
  if `entry.seq === lastSeq + 1`.
  - `entry.seq <= lastSeq` → **duplicate**, ignore.
  - `entry.seq > lastSeq + 1` → **gap**; buffer the entry and send `resync`
    (`haveSeq = lastSeq`). Apply buffered entries once the gap is filled.
- **Action idempotency:** the sequencer dedupes `submit`s by `actionId`. If it
  has already accepted an `actionId`, it re-sends the existing `accepted` event
  (or its `reject`) instead of processing again.
- **Submit retry:** a player keeps each submitted `actionId` "pending" until it
  observes the matching `event` or a `reject`. On sequencer change, on `resync`,
  or after `SUBMIT_TIMEOUT_MS`, it **re-submits with the same `actionId`** — safe
  because acceptance is idempotent. In-flight submits lost during migration are
  recovered this way.
- **Migration seam:** a newly elected sequencer resumes numbering at
  `lastSeq + 1` from its replica. Any entry the old sequencer accepted but did
  not broadcast is simply absent from all replicas and is re-created when the
  proposer retries.

---

## 12. Lifecycle & State Machines

### 12.1 Match phases

```
 ∅ ─create─▶ LOBBY ─┐
                    │ host game-selected  (starts a game session)
                    ▼
                 ACTIVE ⇄ PAUSED        (PAUSED on a disconnect that blocks play;
                    │ isOver()           RESUMED when the needed player returns)
                    ▼
                 FINISHED ── host game-selected ──▶ back to ACTIVE (new session)
                                                    same id = rematch, other id = switch

 (any phase, everyone gone → match evaporates: ABANDONED)
```

`FINISHED` is **not terminal** — it is a post-game lobby. The room persists; the
host starts the next game with `game-selected`, opening a fresh session and
returning the room to `ACTIVE` (§12.7). `ABANDONED` is not a broadcast state; it
is simply the absence of any live participant (ephemeral, NFR-8). Optional flush
(§18) may persist a record first.

### 12.2 Join / handshake

```
Joiner                         Channel/Presence                 Sequencer
  │  subscribe + track(pending) ─────────▶ presence join
  │  hello{playerId, want} ──────broadcast──────────────────────▶
  │                                     (sequencer decides:)
  │                          new player & seat free:
  │  ◀──── event{seat-claimed} (to all) ─────────────────────────┤
  │  ◀──── snapshot{yourSeat} (to joiner) ───────────────────────┤
  │                          reconnecting player:
  │  ◀──── snapshot{yourSeat=existing} (to joiner) ──────────────┤
  │                          match full / want=spectator:
  │  ◀──── snapshot{yourRole=spectator} (to joiner) ─────────────┤
  │  track(role,seat)  ─────▶ presence update
  │  apply snapshot, then apply event{seq>lastSeq}
```

If **no sequencer is present** when `hello` arrives (e.g. creator still setting
up), the creator (seat 0) is the sequencer by definition and answers. A brand-new
match's first `hello` from a non-creator with no sequencer yet simply waits/retries
until seat 0 is present (a match cannot exist without its creator having created it).

### 12.3 Turn loop (no hidden info)

```
Player(by)                         Sequencer                        Everyone
  │ submit{actionId, action} ──────▶
  │                          isLegal & by∈activeSeats ?
  │                            yes → append event{seq, move}
  │                                  apply locally
  │  ◀────────────── event{...} (broadcast) ─────────────────────▶ apply
  │                            no  → reject{actionId, reason}
  │  ◀──── reject (to player) ──────┤
```

### 12.4 Turn loop (with hidden info) — the shoot/reveal sub-protocol

```
Attacker                 Sequencer                 Owner(target)        Everyone
  │ submit{shoot A5} ──────▶
  │                 isLegal? & needsReveal→ownerSeat
  │                 reveal-req{revealId, action} ──▶
  │                                         resolveReveal(priv,action)
  │                 ◀── reveal-res{revealId, reveal=hit} ──┤
  │                 append event{seq, move: shoot A5, reveal: hit}
  │  ◀───────────────── event{...} (broadcast) ─────────────────────▶ apply
```

- The sequencer holds the pending action and **does not advance the turn** until
  the reveal returns.
- If `reveal-res` does not arrive within `REVEAL_TIMEOUT_MS` (owner likely
  disconnected), the sequencer emits `paused{reason:"reveal-timeout", waitingOn:[ownerSeat]}`
  and re-issues `reveal-req` on resume.
- The owner may also update **its own** private state via `reducePrivate`
  (e.g. mark its cell hit) — this never leaves the owner's device.

### 12.5 Pause / resume

- **Pause when** presence `leave` removes a player whose seat the game still
  needs to proceed — precisely: `leftSeat ∈ game.activeSeats(state)`, **or** a
  pending reveal is owed by the departed seat, **or** the match would otherwise
  have fewer than the game's `seats.min` connected players.
  → sequencer emits `paused{reason:"disconnect", waitingOn:[…]}`.
- **Resume when** the needed `playerId`(s) return (presence `join`) and have been
  re-snapshotted. → sequencer emits `resumed`.
- A disconnect of a player **not** currently blocking play does **not** pause the
  match (their turn simply isn't up).

### 12.6 Sequencer migration

```
presence leave (sequencer's playerId gone)
        │
        ▼   each replica computes newSequencer = lowest-seat connected player
   ┌──────────────┐ am I newSequencer?
   │ every player │───── no ──▶ wait for sequencer-changed, keep replicating
   └──────────────┘
        │ yes
        ▼
   set nextSeq = lastSeq+1
   emit event{sequencer-changed, seat:self}
   re-evaluate pause/resume (§12.5) and any owed reveal (re-request)
```

### 12.7 Game selection & post-game (multi-game rooms)

A **match is a persistent room**; a **game session** is one play-through inside
it. The host (the current sequencer) drives which game runs.

- **Registry.** Every client is built with a **game registry** — a map of
  `gameId → Game` plugin (§13). The host can only select a game in the registry,
  and every participant needs the same game (compatible version, §19) to play or
  render it.
- **Selecting a game.** From `LOBBY` (first game) or `FINISHED` (any later game),
  the host emits `game-selected { sessionId, gameId, version, seatOrder }`. This
  is **unilateral** — it takes effect immediately for everyone present; a player
  who doesn't want it simply leaves. `sessionId` is a fresh UUID.
- **Starting the session.** On applying `game-selected`, every replica sets
  `meta.activeGameId = gameId`, `meta.sessionId = sessionId`, `phase = active`,
  and initializes game state to `game.init(seatOrder)`. Subsequent `move` events
  belong to this session until the next `game-selected`.
- **Rematch = re-select.** Choosing the same `gameId` again is a rematch; there
  is no separate rematch message.
- **First-mover rotation.** The sequencer rotates `seatOrder` round-robin each
  session (e.g. `[0,1]` then `[1,0]`) so the first-move advantage alternates.
  Because `init` treats `seatOrder[0]` as first, fairness needs no game code.
- **Seat-count check.** `game-selected` is valid only if the connected roster
  size lies within the selected game's `seats` bounds (§13). If too few players
  are present, the host can't start it yet; players beyond `max` stay spectators
  for that session.
- **Post-game.** `game-over` moves the room to `FINISHED` (a post-game lobby).
  The finished game's final state stays visible until the next `game-selected`
  replaces it.
- **Joining between games.** A player who joins while phase is `lobby`/`finished`
  receives a snapshot with `activeGameId` = the last finished game (or `null`)
  and waits for the host's next `game-selected`.

```
FINISHED ──(host clicks "play again" / picks a game)──▶ sequencer:
   sessionId = uuid();  seatOrder = rotate(prevOrder)
   emit event{ game-selected, sessionId, gameId, version, seatOrder }
        │
        ▼  every replica
   activeGameId = gameId;  game = registry[gameId].init(seatOrder);  phase = ACTIVE
```

---

## 13. The Game Plugin Contract

A game is a set of **pure functions** plus type declarations. The core imports
nothing game-specific; it holds a **registry** of `Game` objects (keyed by
`Game.id`) and calls into whichever one the current session selected (§12.7).

```ts
import { z } from "zod";

type GameResult =
  | { kind: "win";  winners: Seat[] }
  | { kind: "draw" }
  | { kind: "abandoned" };

interface Game<
  State,           // public game state (in the log-derived snapshot)
  Action,          // a proposed move
  Setup = void,    // local secret setup input (e.g. ship placement)
  Private = void,  // a player's private state (never serialized to others)
  Reveal = void,   // result of resolving a hidden action
> {
  readonly id: string;                 // e.g. "tictactoe"
  readonly version: string;            // semver of the game rules
  readonly seats: { min: number; max: number };

  /** Zod schema for a proposed action. The core validates every inbound
   *  `submit.action` against this BEFORE it reaches `isLegal` (NFR-5). */
  readonly actionSchema: z.ZodType<Action>;

  /** Zod schema for a reveal result. REQUIRED for any game that uses
   *  `needsReveal`/`resolveReveal`; the core validates every inbound
   *  `reveal-res.reveal` against it before finalizing the move. */
  readonly revealSchema?: z.ZodType<Reveal>;

  /** Initial PUBLIC state for the given seats. Deterministic. */
  init(seats: Seat[]): State;

  /** Which seats may act right now. [] = nobody (finished/paused/awaiting). */
  activeSeats(state: State): Seat[];

  /** Is `action` by seat `by` legal in `state`? Pure, no side effects. */
  isLegal(state: State, action: Action, by: Seat): true | { reason: string };

  /** Does this action require a private reveal? Return the owning seat or null. */
  needsReveal?(state: State, action: Action, by: Seat): Seat | null;

  /** Apply an accepted action (with its reveal, if any) to PUBLIC state. Pure. */
  reduce(state: State, action: Action, ctx: { by: Seat; reveal?: Reveal }): State;

  /** Result if the game has ended, else null. Pure. */
  isOver(state: State): GameResult | null;

  // ─── Hidden-information hooks (run ONLY on the owning client) ───
  /** Build private state from local setup (e.g. chosen ship layout). */
  initPrivate?(setup: Setup): Private;

  /** Resolve a hidden action against MY private state → the reveal to publish. */
  resolveReveal?(priv: Private, action: Action, state: State): Reveal;

  /** Update MY private state after my board is acted upon (optional). */
  reducePrivate?(priv: Private, action: Action, reveal: Reveal): Private;
}
```

### Contract rules

- **Purity & determinism.** `init`, `activeSeats`, `isLegal`, `reduce`, `isOver`
  MUST be pure and deterministic — same inputs, same output, no `Date.now`, no
  `Math.random`, no I/O. This is what guarantees identical replicas (NFR-3).
- **Immutability.** `reduce` returns new state; it MUST NOT mutate its input.
- **Turn model.** `activeSeats` is the single source of turn truth: a
  one-element array = strict alternation; a multi-element array = simultaneous
  turns (e.g. both players placing ships); `[]` = no one may act.
- **Validation is total.** `isLegal` MUST reject anything not explicitly allowed;
  the core additionally enforces `by ∈ activeSeats(state)` before calling it.
- **Reveals are owner-local.** `resolveReveal`/`reducePrivate`/`initPrivate` run
  **only** on the owning player's client. The core never ships `Private` anywhere.
- **No hidden state in `State`.** Anything placed in `State` is public and will be
  snapshotted to spectators. Secrets belong in `Private`.
- **Schema'd wire payloads.** `actionSchema` (always) and `revealSchema`
  (whenever the game reveals) validate the only two game-defined values that
  cross the wire. The core parses inbound `action`/`reveal` with them before
  calling any rule function, so `isLegal`/`resolveReveal` may assume
  well-formed, correctly-typed input. `Setup` and `Private` stay local and need
  no schema.

### Turn-model matrix

| Game | `activeSeats` during play | Hidden info? |
| --- | --- | --- |
| Tic-tac-toe | `[currentPlayer]` (strict) | none |
| Connect Four | `[currentPlayer]` (strict) | none |
| Battleship — setup | `seatsNotYetReady` (simultaneous) | `Private` = board |
| Battleship — play | `[currentShooter]` (strict) | reveal on `shoot` |

---

## 14. Hidden Information & Trust Model

### 14.1 The mechanism

Secret ownership is **distributed**: each player is the sole authority over its
own `Private` state.

1. **Setup.** A player builds a secret locally (`initPrivate(setup)`), persists it
   (§15.3), and submits a **public** `ready` action. `reduce` marks that seat
   ready; no secret content is published.
2. **Query.** An opponent submits an action that touches the secret (e.g.
   `shoot A5`). The sequencer confirms it's public-legal, then asks the owner via
   `reveal-req`.
3. **Reveal.** The owner runs `resolveReveal(priv, action)` → `hit`/`miss`/`sunk`
   and returns it; it optionally updates its own `Private` via `reducePrivate`.
4. **Finalize.** The sequencer appends the `move` event carrying the **public**
   action **and** the reveal result. Everyone applies it; the public board now
   shows the outcome, but no full board was ever transmitted.

Because the sequencer only ever sees **revealed results**, migrating the
sequencer to another player leaks nothing — a direct benefit of distributing
secret ownership.

### 14.2 Trust assumptions (v1)

Reveals are **self-reported and trusted**. This spec explicitly does **not**
defend against:

- An owner **lying** in `resolveReveal` ("miss" on a real hit, or vice-versa).
- A player **peeking** at data its own client legitimately holds.
- A sequencer **fabricating** or reordering accepted events.

These are acceptable per the project's stance (no security). If needed later,
a commit-reveal scheme (publish a hash of the board at setup, reveal cells with
proofs) can be layered in without changing the message flow — see [§23](#23-open-questions--future-work).

---

## 15. Reconnection & Resume

### 15.1 Public state recovery

On reconnect a player re-subscribes, re-tracks presence under the same
`playerId`, and sends `hello`. The sequencer recognizes the existing seat and
returns a `snapshot`. The player applies it and resumes at `lastSeq`.

### 15.2 What "still live" means

A returning player reclaims their seat **as long as the match still has ≥1
connected participant** to answer the `hello` (a player who can be/served by a
sequencer). If every participant has left, the match has evaporated (ephemeral)
and the code is dead unless it was flushed (§18).

### 15.3 Private state recovery (critical)

Because secrets live only on the owner's device, **the owner is responsible for
persisting its own `Private` state** across reloads:

- Private state MUST be written to `localStorage` under
  `maets:secret:{code}:{playerId}` whenever it changes (at setup and after each
  `reducePrivate`).
- On reconnect the owner rehydrates `Private` from `localStorage` and can again
  answer `reveal-req`.
- **If a player's private state is unrecoverable** (cleared storage, different
  device) while its game requires reveals, that player **cannot continue**; the
  sequencer treats it as an unanswerable reveal and the match ends
  `game-over{ result: abandoned }` (or a game-defined forfeit). This limitation
  is inherent to serverless hidden information and is documented, not hidden.

---

## 16. Spectators

- Admitted when a joiner sets `want:"spectator"`, or when the match is full
  (FR-4). Tracked via presence only; **not** written to the event log.
- Receive a `snapshot` (public state only — never a `Private`) and then apply the
  live `event` stream like any replica.
- Are **read-only**: any `submit` from a non-seat is `reject`ed (`unknown-seat`).
- Are **never** elected sequencer and never receive `reveal-req`.
- May join and leave freely with no effect on match phase.
- `M` spectators are supported; the only limit is Supabase channel capacity.

---

## 17. Error Handling & Edge Cases

| # | Situation | Handling |
| --- | --- | --- |
| E-1 | Malformed / unparseable message | Dropped by Zod parse; never trusted (NFR-5). |
| E-2 | Out-of-turn submit | `reject{ not-your-turn }`. |
| E-3 | Illegal move | `reject{ illegal-move, message }` from `isLegal`. |
| E-4 | Duplicate `submit` (`actionId` seen) | Idempotent: re-send existing `event`/`reject`. |
| E-5 | Duplicate `event` (`seq ≤ lastSeq`) | Ignored. |
| E-6 | Gap in `event` seq | Buffer + `resync`; apply once contiguous. |
| E-7 | Submit lost in migration | Proposer retries same `actionId` after timeout. |
| E-8 | Two clients claim sequencer | Lowest seat wins; other stands down (§9.3). |
| E-9 | Reveal owner disconnects mid-reveal | `paused{ reveal-timeout }`; re-request on resume. |
| E-10 | Reveal owner's secret is lost | Match ends `abandoned`/forfeit (§15.3). |
| E-11 | Join when match full | Admitted as spectator (FR-4). |
| E-12 | `hello` with wrong game/version | `reject{ version-mismatch }` (§19). |
| E-13 | All participants leave | Match evaporates; optional flush (§18). |
| E-14 | Late/duplicate `sequencer-changed` | Idempotent by seat priority (§9.3). |
| E-15 | Action references stale state (`lastSeq` moved) | Re-validated at accept time; `reject{ stale }` if now illegal. |

---

## 18. Persistence & Replay

**Default: none.** Matches are ephemeral and live in participants' browsers.

**Optional post-match flush.** Because state *is* an ordered log, a full replay
record is trivial to persist. When enabled, the sequencer (or any participant)
writes the finished log to Supabase Postgres at `game-over`:

```sql
-- OPTIONAL. Not required for the serverless core.
create table maets_matches (
  code        text primary key,
  game_id     text not null,
  game_version text not null,
  created_at  timestamptz not null default now(),
  finished_at timestamptz,
  result      jsonb
);

create table maets_events (
  code   text not null references maets_matches(code),
  seq    int  not null,
  entry  jsonb not null,           -- the LogEntry (§8.1)
  primary key (code, seq)
);
```

- Replay = read `maets_events` ordered by `seq` and fold with the same reducers.
- **Private state is never persisted** (it never leaves the owner), so replays of
  hidden-info games show only what was publicly revealed.
- RLS, auth, and mid-match durability are out of scope for v1 (non-goals).

---

## 19. Versioning & Compatibility

- **Protocol version** is the integer `v` in every envelope and the `v{N}` in the
  channel name. Different protocol majors use **different channel names** and
  therefore cannot collide.
- **Game availability & version.** A client advertises the games its registry
  supports in `hello.games`. A `game-selected` is playable by a participant only
  if its registry contains `gameId` at a compatible `version` (same **major**,
  semver). A participant lacking the selected game stays in the room but cannot
  play or render that session — effectively a spectator until the next
  `game-selected`. The host SHOULD only select a game all seated players
  advertise. A protocol-level `version-mismatch` (`v`) is still hard-`reject`ed.
- **Additive evolution:** new optional message fields and new `control`
  subtypes are backward-compatible within a protocol major, provided older
  clients ignore unknown fields (Zod schemas MUST use non-strict parsing for
  forward fields).

---

## 20. Security & Threat Model

**v1 provides no security guarantees.** It is designed for friendly play. In
scope of *correctness* but explicitly **out of scope of protection**:

| Threat | v1 posture |
| --- | --- |
| Cheating via lying reveals | **Unprotected.** Trusted (§14.2). |
| Peeking at own client's data | **Unprotected.** |
| Malicious sequencer (fabricate/reorder events) | **Unprotected.** |
| Impersonating a `playerId` | **Unprotected** (self-asserted identity). |
| Joining/spectating any known code | **By design** (codes are the only gate). |
| Denial of service (spam submits) | Bounded only by Supabase rate limits. |

Anyone who knows a code can watch or, if a seat is open, take it. Codes are
**capability tokens**, not secrets against a determined adversary. Hardening
paths are listed in §23.

---

## 21. Worked Examples

### 21.1 Tic-tac-toe (perfect information)

```
1. Alice creates room → code PLUM-42, seat 0 (sequencer).
   event{seq:0, seat-claimed, seat:0, Alice}.
2. Bob joins: hello{want:player, games:[tictactoe@1.0.0]}.
   Sequencer → event{seq:1, seat-claimed, seat:1, Bob}; snapshot → Bob.
3. Alice (host) picks tic-tac-toe:
   event{seq:2, game-selected, gameId:"tictactoe", seatOrder:[0,1]}.
   Every replica: game = ticTacToe.init([0,1]); phase ACTIVE; activeSeats = [0].
4. Alice submit{place:4}. Sequencer: legal, by∈[0] → event{seq:3, move:{place:4}}.
   Everyone reduce → center = X. activeSeats now [1].
5. Bob submit{place:0} → event{seq:4, move:{place:0}}. activeSeats [0].
   ...continues...
6. Alice completes a line. reduce → isOver → {win, winners:[0]}.
   Sequencer → event{seq:n, game-over, result}. Phase FINISHED (post-game lobby).
7. Rematch: Alice picks again → event{seq:n+1, game-selected, seatOrder:[1,0]}.
   Fresh board; Bob now moves first (rotation) — or she selects "battleship" to switch.
```

Reconnect mid-game: Carol opens the code as spectator → `snapshot` (current
board) → live `event`s. Bob refreshes → `hello` → recognized seat 1 → `snapshot`
→ resumes; if it was his turn the match was PAUSED and now RESUMES.

### 21.2 Battleship (hidden information + simultaneous setup)

```
1. Alice(seat0)/Bob(seat1) in match. Phase ACTIVE, game phase = SETUP.
   activeSeats = [0,1] (simultaneous).
2. Each places ships locally: initPrivate(layout) → Private, saved to localStorage.
   Alice submit{ready}; Bob submit{ready} → two events (seq n, n+1).
   reduce marks both ready → game phase PLAY, activeSeats = [0] (Alice shoots).
3. Alice submit{shoot: "B4"}. Sequencer: legal & needsReveal→seat1(Bob).
   reveal-req → Bob. Bob resolveReveal(priv, shoot B4) = "miss".
   reveal-res → sequencer. event{seq, move:{shoot:B4}, reveal:"miss"}.
   Everyone reduce: Alice's tracking grid marks B4 miss. activeSeats [1].
4. Bob shoots Alice's board symmetrically; Alice reveals from HER Private.
5. When a seat's last ship is sunk, reduce → isOver → {win,...} → game-over.
```

At no point did Alice's or Bob's board cross the wire — only `ready` flags and
per-shot `hit`/`miss`/`sunk` results. The sequencer never held either board.

### 21.3 Reference game: tic-tac-toe (full plugin)

The complete implementation of a perfect-information game. A game author writes
**only** this file; the core supplies transport, turns, sync, reconnect,
spectating, and migration. Because there is no hidden information, `Setup`,
`Private`, `Reveal`, `needsReveal`, and `revealSchema` are all omitted.

```ts
// games/tictactoe.ts
import { z } from "zod";
import type { Game, GameResult, Seat } from "../types";

// ─── Types ───────────────────────────────────────────────────────────
export type TttState = {
  board: (Seat | null)[]; // length 9, row-major; cell holds the seat that marked it
  turn: Seat;             // whose turn it is (0 or 1)
};

export const TttActionSchema = z.object({
  type: z.literal("place"),
  cell: z.number().int().min(0).max(8),
});
export type TttAction = z.infer<typeof TttActionSchema>;

// ─── Pure helpers ────────────────────────────────────────────────────
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

function winner(board: (Seat | null)[]): Seat | null {
  for (const [a, b, c] of LINES) {
    const s = board[a];
    if (s !== null && s === board[b] && s === board[c]) return s;
  }
  return null;
}
const isFull = (board: (Seat | null)[]) => board.every((c) => c !== null);
const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0); // 2-seat game

function withCell(board: (Seat | null)[], cell: number, mark: Seat) {
  const next = board.slice(); // never mutate input (contract §13)
  next[cell] = mark;
  return next;
}

// ─── The plugin ──────────────────────────────────────────────────────
export const ticTacToe = {
  id: "tictactoe",
  version: "1.0.0",
  seats: { min: 2, max: 2 },
  actionSchema: TttActionSchema, // §13: the only game-defined value on the wire

  init: (seats: Seat[]): TttState => ({
    board: Array(9).fill(null),
    turn: seats[0], // seat 0 (the creator) is X and moves first
  }),

  // The single source of turn truth. [] once the game is terminal.
  activeSeats: (s: TttState): Seat[] =>
    winner(s.board) !== null || isFull(s.board) ? [] : [s.turn],

  // Pure, total, defensive. The core already guarantees `by ∈ activeSeats` and
  // has already parsed `action` with actionSchema — so we only check game rules.
  isLegal: (s: TttState, a: TttAction, _by: Seat) => {
    if (winner(s.board) !== null || isFull(s.board)) return { reason: "game-over" };
    if (s.board[a.cell] !== null) return { reason: "cell-occupied" };
    return true as const;
  },

  // Apply an accepted move. `by` comes from the authoritative log entry.
  reduce: (s: TttState, a: TttAction, ctx: { by: Seat }): TttState => ({
    board: withCell(s.board, a.cell, ctx.by),
    turn: other(ctx.by),
  }),

  isOver: (s: TttState): GameResult | null => {
    const w = winner(s.board);
    if (w !== null) return { kind: "win", winners: [w] };
    if (isFull(s.board)) return { kind: "draw" };
    return null;
  },
} satisfies Game<TttState, TttAction>;
```

Because a room can host several games, the game's UI is a **presentational
view**: the room owns one `useMatch(...)` call and renders the matching view by
`activeGameId` (§22), handing it the live session `state` + `submit`.

```tsx
"use client";
import { ticTacToe, type TttState, type TttAction } from "@/lib/maets-realtime/games/tictactoe";
import type { Seat } from "@/lib/maets-realtime/types";

// The Room (§22) renders this when activeGameId === "tictactoe".
export function TicTacToeView({
  state, seat, phase, submit,
}: {
  state: TttState;
  seat: Seat | null;
  phase: "lobby" | "active" | "paused" | "finished";
  submit: (a: TttAction) => void;
}) {
  const result = ticTacToe.isOver(state); // reuse the plugin in the view layer
  const myTurn = phase === "active" && seat !== null && state.turn === seat && !result;
  const glyph = (s: Seat | null) => (s === 0 ? "✕" : s === 1 ? "◯" : "");

  return (
    <div className="grid grid-cols-3 gap-1">
      {state.board.map((cell, i) => (
        <button
          key={i}
          disabled={!myTurn || cell !== null}
          onClick={() => submit({ type: "place", cell: i })}
          className="h-20 w-20 border text-3xl"
        >
          {glyph(cell)}
        </button>
      ))}
    </div>
  );
}
```

The game author writes no channel code, no turn enforcement, no reconnect/pause
logic, and nothing about game selection. For the message exchange and resulting
event log this plugin produces, see the walkthrough in §21.1.

---

## 22. Public API Surface

The core is framework-agnostic; React gets a thin hook mirroring `useChat`.

```ts
// A registry maps game ids to their plugins — the set a room can play.
type GameRegistry = Record<string, Game<any, any, any, any, any>>;

// Framework-agnostic client (the protocol engine). Game-agnostic at the room level.
class MaetsMatch {
  constructor(opts: {
    supabase: SupabaseClient;
    code: string;
    playerId: string;
    name: string;
    games: GameRegistry;                  // every game this room can play
    want?: "player" | "spectator";
  });
  join(): Promise<void>;

  selectGame(gameId: string): void;       // HOST-ONLY (no-op otherwise); same id = rematch, other = switch
  submit(action: unknown): string;        // validated vs the ACTIVE game's actionSchema; returns actionId
  setSetup(setup: unknown): void;         // hidden-info games; local only — never sent

  on(event: "state" | "phase" | "roster" | "game" | "rejected" | "over", cb): () => void;
  get activeGameId(): string | null;      // which game the current session is
  get state(): unknown;                   // PUBLIC state of the active session (narrow by activeGameId)
  get phase(): "lobby" | "active" | "paused" | "finished";
  get seat(): number | null;
  get isHost(): boolean;                  // am I the current sequencer?
  leave(): Promise<void>;
}

// React binding. `S`/`A` are for the CURRENTLY rendered game; narrow by activeGameId.
function useMatch<S = unknown, A = unknown>(opts: {
  code: string;
  games: GameRegistry;
  playerId?: string;                      // defaults to persisted maets:playerId
  name: string;
  want?: "player" | "spectator";
}): {
  activeGameId: string | null;
  state: S;
  phase: "lobby" | "active" | "paused" | "finished";
  seat: number | null;
  isHost: boolean;
  players: Array<{ seat: number; name: string; connected: boolean }>;
  spectators: number;
  submit: (action: A) => void;
  selectGame: (gameId: string) => void;   // host-only
  status: "connecting" | "syncing" | "ready" | "paused";
};
```

Wire validation rides on the **active session's** game plugin: `submit`
pre-validates `action` against that game's `actionSchema` client-side (fail-fast)
before broadcasting, and the sequencer re-validates on receipt; hidden-info games
additionally validate reveals against `revealSchema` (§13). The API needs no
schema parameters — the **registry** supplies them.

Because a room can host different games, the UI **dispatches on `activeGameId`**:
one `useMatch(...)` per room renders a picker in `lobby`/`finished` and the
matching presentational view (each with its own `S`/`A`, §21.3) in `active`.

```tsx
const { activeGameId, phase, isHost, seat, state, submit, selectGame } =
  useMatch({ code, games, name });

if (phase === "lobby" || phase === "finished")
  return <GamePicker canPick={isHost} onPick={selectGame} />;   // host-only controls
if (activeGameId === "tictactoe")
  return <TicTacToeView state={state as TttState} seat={seat} phase={phase} submit={submit} />;
if (activeGameId === "battleship")
  return <BattleshipView state={state as BsState} seat={seat} phase={phase} submit={submit} />;
```

Lobbies are **code-based**: a create screen generates a code and routes to
`?code=…`; a join screen reads a code. No lobby browser in v1.

---

## 23. Open Questions & Future Work

- **Anti-cheat:** commit-reveal (hash board at `ready`, reveal cells with a Merkle
  proof) to make lying detectable — slots into the existing reveal handshake.
- **Authenticated identity:** swap self-asserted `playerId` for Supabase auth uid.
- **Server authority option:** a Supabase Edge Function / Postgres RPC as a
  neutral sequencer for tournaments (removes the trusted-client assumption).
- **Durable mid-match state:** flush the log continuously, not just at game-over,
  so a fully-evaporated match can be revived.
- **Matchmaking:** a lobby/discovery layer above codes; rating/queueing.
- **Turn timers & auto-forfeit:** per-game clocks and timeout policies.
- **N > 2 games** and team/free-for-all turn structures.
- **Reconnect grace window** tuning and abandoned-match GC.

---

## 24. Appendix: Constants & Quick Reference

### Constants (initial values, tune later)

| Constant | Value | Meaning |
| --- | --- | --- |
| `PROTOCOL_VERSION` | `1` | Envelope `v` and channel `v{N}`. |
| `SUBMIT_TIMEOUT_MS` | `4000` | Resubmit an unacknowledged action after this. |
| `REVEAL_TIMEOUT_MS` | `8000` | Pause if a reveal isn't answered in time. |
| `RESYNC_DEBOUNCE_MS` | `500` | Min gap between `resync` requests. |
| `CHANNEL_PREFIX` | `maets:v1:match:` | Channel name prefix. |

### Channel & storage keys

```
channel:          maets:v1:match:{CODE}
broadcast event:  "m"
presence key:     {playerId}
localStorage:     maets:playerId                        (identity)
                  maets:secret:{CODE}:{playerId}        (private game state)
```

### Message → role cheat-sheet

```
hello       any joiner        → sequencer assigns seat / serves snapshot
snapshot    sequencer         → one joiner (catch-up)
submit      a seated player   → sequencer (proposal)
event       sequencer only    → all (ordered, authoritative log entry)
reject      sequencer         → one player (refusal + reason)
reveal-req  sequencer         → secret owner
reveal-res  secret owner      → sequencer
resync      any participant   → sequencer (gap recovery)
```

### State-authority summary

```
PUBLIC flow (turns, roster, win)  → the SEQUENCER (migratable, lowest connected seat)
PRIVATE state (secret boards)     → each PLAYER, for its OWN secret only
ORDERING (total order)            → single-sender broadcast of accepted events
LIVENESS (pause/resume/migrate)   → Supabase PRESENCE
```
```
```
