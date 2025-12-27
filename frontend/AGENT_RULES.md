# AGENT_RULES.md — Fighter Game Architecture Rules

## Repo Structure
This repo contains:
- `frontend/legacy/` → Prototype implementation (READ ONLY)
- `frontend/new/`    → New clean architecture (GREENFIELD)

**IMPORTANT**
- Files in `frontend/legacy/` must never be modified.
- All new work happens in `frontend/new/src`.

---

## Context & Goal
The existing code is a prototype used only to extract learnings.
The goal is NOT to refactor the prototype.

Goal:
- Clean, maintainable game architecture
- Much less code and duplication
- Deterministic core simulation
- AI can be improved/replaced later without touching combat or animation

---

## Non-Negotiable Learnings (Hard Constraints)

1. **AI never controls animation, timers, Spine, or controllers**
   - AI outputs only `Intent`.

2. **Telegraph / charge / recovery are implemented only via State + Counters**
   - Tick-based logic in Core.
   - No `setTimeout`, no Promises, no animation pause in Core.

3. **Interrupts must be deterministic**
   - No Promise rejection without guaranteed cleanup.

4. **Range policy**
   - `EngageRange > HitRange`
   - Ranges are loadout-dependent but defined centrally.

5. **No cross-subsystem timer clearing**
   - Never clear timers across module boundaries.

6. **Explicit state machine**
   - All state transitions must be visible and traceable.

7. **No magic numbers**
   - Use named constants or config objects.

8. **Single Responsibility**
   - Avoid large classes or “manager” dumping grounds.

9. **Prefer simplification over features**
   - If unsure, reduce coupling and code size.

---

## Target Architecture (frontend/new/src)

### `/core` — Deterministic Simulation
- Pure data + pure functions
- Tick-based (`step(state, intent, dt)` or `stepTick`)
- Owns:
  - combat rules
  - state machine
  - counters (telegraph, cooldown, recovery)
- Must NOT import:
  - Spine
  - rendering
  - audio
  - networking
- Must NOT use:
  - `setTimeout`
  - Promises

---

### `/adapters/spine`
- Presentation layer
- Maps Core state/events → Spine animations
- No game rules here
- Idempotent animation triggering (no thrashing)

---

### `/ai`
- `IFighterBrain.decide(observation) => Intent`
- No direct access to controllers or Spine

---

### `/net`
- SignalR transport only
- Multiplayer is optional
- Server-authoritative only if MP mode is active
- Singleplayer runs fully locally

---

### `/game`
- Game loop / wiring
- Chooses:
  - local core vs server core
  - human input vs AI brain

---

## Single Source of Truth
- Attack configuration (`attack-data`) is authoritative for:
  - timings
  - ranges
  - cooldowns
  - interruptibility / armor
- No duplicated mappings in AI, adapters, or controllers.

---

## API Design Rules
- Commands must be idempotent
- Prefer `Intent → State` over imperative command sequences
- Avoid side effects during state queries

---

## Multiplayer Rules
- Client sends `Intent + tick`
- Server simulates Core
- Server sends `Snapshot`
- No rollback/lockstep unless explicitly requested

---

## Development Workflow Rules
1. **Small steps**
   - Max ~6 files per change
   - Each step must compile/run

2. **Two-phase work**
   - Phase A: Architecture + Interfaces + Step plan
   - Phase B: Implement only step 1

3. **Response format**
   1) Intent / Summary
   2) Files affected
   3) Interfaces / Types
   4) Code
   5) Next step

4. **If conflict exists between prototype behavior and these rules, rules win.**

---

## Do NOT
- Do not modify `frontend/legacy`
- Do not reintroduce prototype patterns
- Do not mix combat, animation, and AI
- Do not use timers in Core
- Do not create large monolithic classes
- Do not place html or css in ts files

---

## Minimal Required Interfaces
- `Intent`
- `Observation`
- `CoreFighterState`
- `CoreMatchState`
- `Snapshot`