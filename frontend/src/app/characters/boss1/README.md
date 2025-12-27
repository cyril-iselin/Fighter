# Boss1 Character (Jester)

## Overview
Boss1 is a large, aggressive boss character with slow but powerful attacks.

## Spine Animation Names
- `idle` - Standing idle
- `walk` - Walking movement
- `attack` - Heavy attack (slow, high damage)
- `attack2` - Light attack (quick poke)
- `get hit` - Hurt reaction (note: has space in name!)
- `dead` - Death animation
- `happy` - Victory pose (unused)

## Bone Structure
Hitbox bones (weapons):
- `images/armf_01` - Front arm weapon
- `images/armb_01` - Back arm weapon

Hurtbox bones:
- `images/head1` - Head
- `hips` - Body center

## Attacks
| ID | Animation | Command | Damage | Range | Duration |
|---|---|---|---|---|---|
| boss1_heavy | attack | heavy | 25 | 200px | 90 ticks |
| boss1_light | attack2 | light | 12 | 180px | 60 ticks |

## AI Behavior
- **Rushdown style**: Boss never retreats, always pushes forward
- **Heavy preference**: 70% heavy attacks, 30% light attacks
- **Slow reactions**: 5 tick delay (boss is heavy/lumbering)
- **No survival instinct**: Doesn't back off at low health

## File Structure
```
boss1/
├── index.ts              # Main registration
├── ai/
│   ├── index.ts
│   └── profile.ts        # AI behavior config
├── combat/
│   ├── attack-data.ts    # Attack definitions
│   ├── contextual-overrides.ts
│   ├── hitboxes.ts       # Hit detection zones
│   └── hurtboxes.ts      # Vulnerable zones
├── providers/
│   └── boss1-providers.ts # Animation/Attack/Visual providers
├── spine/
│   ├── animation-map.ts  # Animation name mappings
│   ├── assets.ts         # Asset paths
│   ├── bone-map.ts       # Bone name mappings
│   └── model-profile.ts  # Scale, positioning
└── visuals/
    └── overrides.ts      # Visual effects config
```
