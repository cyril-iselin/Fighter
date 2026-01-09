# Fighter Game - Clean Architecture (frontend/new)

## Architektur-Übersicht

```
src/app/
├── core/          # Deterministische Simulation (60Hz)
│   ├── types.ts
│   ├── config.ts
│   ├── step.ts
│   ├── state-machine.ts
│   ├── physics.ts
│   └── combat.ts
├── adapters/      # Presenter Layer (State → Rendering/Audio)
│   ├── animation-map.ts
│   ├── spine-adapter.ts
│   └── sound-adapter.ts
├── ai/            # AI Brains (Observation → Intent)
│   ├── brain.interface.ts
│   ├── observation.ts
│   ├── basic-brain.ts
│   ├── debug-brain.ts
│   └── rng.ts
└── game/          # Game Loop + Wiring
    ├── game-loop.ts
    ├── input-handler.ts
    └── stubs.ts
```

## Start Guide

### Option 1: Auto-Start (F1)

1. `npm install`
2. `ng serve`
3. Browser öffnen: `http://localhost:4200`
4. **Drücke F1** um das Spiel zu starten

### Option 2: Console Start

1. `npm install`
2. `ng serve`
3. Browser Console öffnen (F12)
4. Eingeben:
   ```javascript
   startGame()
   // oder mit Debug-Logging:
   startGame({ enableDebugLogging: true })
   ```

### Option 3: Auto-Start bei Page Load

In `src/main.ts` auskommentieren:
```typescript
import { startGame } from './app/game/game-loop';
setTimeout(() => startGame({ enableDebugLogging: false }), 1000);
```

## Steuerung (Player 0)

| Taste | Aktion |
|-------|--------|
| **A / ←** | Links bewegen |
| **D / →** | Rechts bewegen |
| **W / ↑ / Space** | Springen |
| **S / ↓ / Shift** | Blocken (center) |
| **J / Numpad1** | Light Attack |
| **K / Numpad2** | Heavy Attack |
| **L / Numpad3** | Special Attack |

## Console Commands

```javascript
// Stop game
window.gameLoop.stop()

// Check current state
window.gameLoop

// Start new game with debug logging
startGame({ enableDebugLogging: true })

// Change loadouts
startGame({ loadouts: ['sword', 'bare'] })
```

## Aktueller Status (Schritt 6)

✅ **Core Simulation**: 60Hz fixed timestep, deterministisch  
✅ **Physics**: Movement, Gravity, Jump, Collisions  
✅ **Combat**: Hit/Block/Parry, Damage, Knockback  
✅ **State Machine**: 9 States mit expliziten Transitions  
✅ **AI**: BasicBrain (approach, attack, block/parry)  
✅ **Adapters**: Spine + Sound (mit Stubs)  
✅ **Game Loop**: Accumulator Pattern, variable FPS  
✅ **Input**: Keyboard → Intent  

🚧 **TODO (Später)**:
- Echte Spine Integration (statt Stubs)
- Audio Library Integration (statt Console-Logs)
- Canvas Rendering
- UI/HUD (Health Bars, Meters)
- Multiplayer (SignalR)

## Architektur-Prinzipien

1. **Core ist deterministisch**: Keine setTimeout, Promise, Animation-Calls
2. **AI ist Intent-Only**: Kein direkter Zugriff auf Core/Adapter
3. **Adapters haben keine Logik**: Nur Mapping (State → Rendering)
4. **Fixed Timestep**: 60Hz Core, variable FPS Rendering
5. **Dependency Injection**: Interfaces für Spine/Audio (testbar)
6. **Idempotenz**: Keine Animation-Thrashing

## Determinismus-Test

```typescript
// Gleiche Inputs → Gleiche States
const state0 = createInitialState(['bare', 'bare']);
const intents = [noIntent, noIntent];

let state = state0;
for (let i = 0; i < 60; i++) {  // 1 Sekunde
  const result = step(state, intents);
  state = result.state;
}

console.log(state.fighters[0].x);  // Deterministisch reproduzierbar
```

## Build

```bash
npm run build
# Output: dist/fighter-game/browser
```

## Troubleshooting

**Problem**: Game startet nicht  
→ Check Browser Console für Errors  
→ Verify `ng serve` läuft ohne TypeScript Errors

**Problem**: Inputs funktionieren nicht  
→ Click in Browser Window (focus)  
→ Check Console ob InputHandler aktiv ist

**Problem**: Zu schnell/langsam  
→ Core läuft fix mit 60Hz, unabhängig von FPS  
→ Check `TICK_RATE` in `core/config.ts`



Dummies:
https://ezgif.com/sprite-cutter
https://bulkimagecrop.com/
https://free-tex-packer.com/