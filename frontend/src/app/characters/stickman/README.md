# Stickman Character Integration Guide

## Quick Start Checklist
This character is already configured and ready to use. Use this guide when creating similar characters.

### ✅ Completed Configuration
- [x] Spine assets configured (`spine/assets.ts`)
- [x] Bone mapping complete (`spine/bone-map.ts`) 
- [x] Animation mapping complete (`spine/animation-map.ts`)
- [x] Model profile set (`spine/model-profile.ts`)
- [x] Hitboxes configured (`combat/hitboxes.ts`)
- [x] Hurtboxes tuned (`combat/hurtboxes.ts`)
- [x] Visual overrides set (`visuals/overrides.ts`)
- [x] Character registered (`index.ts`)

## For New Characters: Copy & Modify Process

### 1. Asset Setup
```typescript
// spine/assets.ts - Update paths to your character's spine files
export const YOUR_CHARACTER_ASSETS: SpineAssets = {
  skeletonPath: 'assets/spine/your-character.json',
  atlasPath: 'assets/spine/your-character.atlas.txt'
};
```

### 2. Bone Mapping (CRITICAL)
```typescript
// spine/bone-map.ts - Map to YOUR skeleton's bone names
export const YOUR_CHARACTER_BONE_MAP = {
  head: 'YOUR_head_bone_name',
  chest: 'YOUR_torso_bone_name', 
  rightHand: 'YOUR_right_hand_bone',
  rightFoot: 'YOUR_right_foot_bone',
  weaponLine: {
    start: 'YOUR_weapon_start_bone',
    end: 'YOUR_weapon_end_bone'
  }
};
```

### 3. Animation Mapping
```typescript
// spine/animation-map.ts - Map to YOUR animation keys
export const YOUR_CHARACTER_ANIMATIONS = {
  idle: 'your_idle_animation',
  attacks: {
    jab_single: 'your_punch_animation',
    // Add more attack mappings...
  }
};
```

### 4. Physical Calibration
```typescript
// spine/model-profile.ts - Adjust for proper alignment
export const YOUR_CHARACTER_PROFILE = {
  scale: 1.2,        // Scale up/down to match game world
  groundOffsetY: -10, // Move up/down to align feet with ground
  facingCorrection: 1 // 1 = normal, -1 = flip if facing wrong way
};
```

### 5. Combat Tuning
Hitboxes (`combat/hitboxes.ts`):
- Adjust `radius` values for attack range
- Fine-tune `activeFromFrac`/`activeToFrac` for timing
- Test with debug overlays enabled

Hurtboxes (`combat/hurtboxes.ts`):
- Adjust head `radius` for fair headshot area
- Adjust chest `width`/`height` for body size
- Use debug overlays to verify visual alignment

### 6. Optional Visual Polish
```typescript
// visuals/overrides.ts - Character-specific feel
export const YOUR_CHARACTER_VISUALS: VisualOverrides = {
  defense: {
    blockTapSpeed: 1.0,      // Block animation responsiveness
    parryAnimModifier: 1.2   // Parry animation speed
  },
  attack: {
    freezeFrames: {          // Impact freeze on specific attacks
      your_special_attack: 6
    }
  }
};
```

### 7. Registration
```typescript
// index.ts - Combine and register
const YOUR_CHARACTER: CharacterDefinition = {
  id: 'your-character-id',
  name: 'Your Character Name',
  spine: { assets, mapping, profile },
  combat: { hitboxes, hurtboxes },
  visuals: YOUR_CHARACTER_VISUALS
};

export function registerYourCharacter(): void {
  registerCharacter(YOUR_CHARACTER);
}
```

### 8. Add to Registry
```typescript
// In characters/registry.ts initializeCharacters():
import('./your-character').then(module => module.registerYourCharacter());
```

## Debug & Testing
1. Enable debug overlays in training mode
2. Check bone position alignment with sprites
3. Test all attack hitboxes vs training dummy
4. Verify hurtbox sizes feel fair
5. Adjust ground alignment and scale
6. Test facing direction correctness

## Performance Notes
- Keep hitbox radius values reasonable (30-60px typical)
- Avoid too many overlapping hitboxes
- Test on slower devices if targeting mobile

## Common Issues
- **Character faces wrong way**: Set `facingCorrection: -1`
- **Floating/underground**: Adjust `groundOffsetY`
- **Attacks don't connect**: Check bone names in spine file match bone-map.ts
- **Animations don't play**: Verify animation keys in spine file match animation-map.ts
- **Scale looks wrong**: Adjust `scale` value in model-profile.ts