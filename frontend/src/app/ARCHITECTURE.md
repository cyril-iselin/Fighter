# Clean Architecture - Core vs Presenter

## Grundprinzip: Separation of Concerns

### CORE (Deterministic Game Logic)
**Location:** `core/`
**Responsibility:** Tick-based (60Hz) gameplay simulation

#### Was gehört in den Core?
- **Attack Timings** (telegraphTicks, activeTicks, recoveryTicks, cooldownTicks)
- **Damage, Range, Knockback** (alle Gameplay-Parameter)
- **State Machine Logic** (wann wechselt State von `telegraph` → `attack` → `recovery`)
- **Hit Detection** (während activeTicks)
- **Cooldown Management** (zählt ab Beginn von telegraph)

#### Was gehört NICHT in den Core?
- ❌ Spine Animation Durations
- ❌ Prozentuale Animation-Marker (z.B. "freeze bei 25%")
- ❌ Visual Freeze/Hold Logic
- ❌ Rendering/Canvas/WebGL Details

#### Beispiel: slash_heavy Attack
```typescript
slash_heavy: {
  telegraphTicks: 24,  // 400ms windup
  activeTicks: 21,     // 350ms damage window
  recoveryTicks: 30,   // 500ms recovery
  cooldownTicks: 72,   // 1200ms total cooldown
  // Total phases: 24 + 21 + 30 = 75 ticks (1250ms)
  // Cooldown prevents re-use for 72 ticks from start
}
```

---

### PRESENTER (Visual Representation)
**Location:** `adapters/`
**Responsibility:** Map core states to Spine animations

#### Was gehört in den Presenter?
- **Animation Mapping** (FighterState → Spine Animation Name)
- **Animation Freeze/Hold** (z.B. block pose freeze)
- **Visual Thresholds** (ANIMATION_END_THRESHOLD = 2%)
- **Rendering Logic** (WebGL, MVP matrix, viewport)
- **Debug Overlays** (ranges, hitboxes)

#### Was gehört NICHT in den Presenter?
- ❌ Gameplay Timings (keine Tick-Counts)
- ❌ Damage Calculation
- ❌ State Transitions
- ❌ Hit Detection

#### Beispiel: Block Freeze (Presenter)
```typescript
// Core sagt: state = 'block' (für X ticks)
// Presenter zeigt: block animation plays → freezes at end → unfreezes on release
// Freeze-Logik ist rein visuell, beeinflusst NICHT das Gameplay
```

---

## Spine Animations: Referenz, NICHT Source of Truth

### ❌ FALSCH:
```typescript
// Im Core die Animation-Duration verwenden
const attackDuration = spineAnimation.duration * 60; // NO!
```

### ✅ RICHTIG:
```typescript
// Im Core: Tick-basierte Timings definieren
const attackConfig = {
  activeTicks: 21,  // Source of Truth
};

// Im Presenter: Animation als visuelle Referenz
// Wenn Animation zu kurz: Freeze/Hold am Ende
// Wenn Animation zu lang: Wird abgeschnitten (egal)
```

### Workflow:
1. **Designer** definiert Attack-Timings im Core (Gameplay-Focus)
2. **Animator** erstellt Spine-Animationen (ungefähre Duration)
3. **Presenter** mappt States → Animationen
4. **Visueller Check:** Passt Animation zum Timing? (Ja = gut, Nein = Freeze/Hold nutzen)

---

## Cooldown-Regel (Klarstellung)

### Wann startet Cooldown?
- **Beginn:** Beim Start von `telegraph` State
- **Ende:** Nach `cooldownTicks` ab Start

### Beispiel-Timeline:
```
Tick 0:   Attack Start → telegraph State (cooldown startet)
Tick 24:  → attack State
Tick 45:  → recovery State
Tick 75:  → idle State (phases complete)
Tick 72:  Cooldown expires (can attack again)
```

**Wichtig:** `cooldownTicks` sollte >= `telegraph + active + recovery` sein, 
sonst kann Attack wieder genutzt werden während noch in recovery!

---

## Best Practices

### Core Changes:
1. Alle Timings in **Ticks** (60Hz)
2. Keine `setTimeout`, `setInterval`, `Promise.delay`
3. Pure Functions für State Transitions
4. Determinismus: gleicher Input → gleicher Output

### Presenter Changes:
1. State-based Rendering (kein eigener State)
2. Idempotent: mehrfache Calls mit gleichem State = keine Änderung
3. Animation-Freezes nur für visuelle Polish
4. Keine Gameplay-Logic (nur Mapping)

### Testing:
- **Core:** Unit Tests mit deterministischen Tick-Sequenzen
- **Presenter:** Visual Tests (sieht es gut aus?)
- **Integration:** Core + Presenter zusammen (Timings passen?)

---

## Zusammenfassung

| Concern | Core | Presenter |
|---------|------|-----------|
| **Attack Timings** | ✅ Source of Truth | ❌ |
| **Animation Duration** | ❌ | ℹ️ Referenz only |
| **State Transitions** | ✅ Tick-based | ❌ |
| **Visual Freeze** | ❌ | ✅ Presentation |
| **Hit Detection** | ✅ During activeTicks | ❌ |
| **Rendering** | ❌ | ✅ WebGL/Canvas |

**Goldene Regel:** 
> "If it affects gameplay, it belongs in Core. If it's only visual, it belongs in Presenter."
