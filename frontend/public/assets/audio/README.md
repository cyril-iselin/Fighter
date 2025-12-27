# Audio Assets

Place your sound files here. The configuration expects the following structure:

## SFX (Sound Effects)
`assets/audio/sfx/`

| File | Description |
|------|-------------|
| `hit_flesh.mp3` | Impact when attack hits |
| `hit_block.mp3` | Sound when blocked |
| `parry.mp3` | Perfect parry sound |
| `whoosh_light.mp3` | Light attack swing |
| `whoosh_heavy.mp3` | Heavy attack swing |
| `whoosh.mp3` | Generic whoosh (whiff) |
| `rage_burst.mp3` | Boss rage explosion |
| `phase_change.mp3` | Boss phase transition |
| `telegraph.mp3` | Attack charge-up warning |
| `stun.mp3` | Stun/daze effect |
| `jump.mp3` | Jump sound |
| `land.mp3` | Landing sound |
| `fight_start.mp3` | "FIGHT!" announcement |
| `fight_won.mp3` | Victory fanfare |
| `game_over.mp3` | Defeat sound |
| `death.mp3` | KO sound |

## Music (Background Tracks)
`assets/audio/music/`

| File | Description | Loop |
|------|-------------|------|
| `menu.mp3` | Main menu music | Yes |
| `fight.mp3` | Combat music | Yes |
| `victory.mp3` | Victory screen | No |
| `defeat.mp3` | Game over screen | No |

## Configuration

Edit `frontend/src/app/adapters/audio/sound-config.ts` to adjust:
- File paths
- Individual sound volumes
- Master/SFX/Music volume levels
- Preload settings

## Audio Format Recommendations

- **Format**: MP3 (best compatibility) or OGG (smaller size)
- **SFX**: Short clips, ~0.5-2 seconds
- **Music**: Compressed, ~128kbps for web
- **Sample Rate**: 44.1kHz

## Placeholder Sources

Free sound effects:
- [Freesound.org](https://freesound.org/)
- [Mixkit](https://mixkit.co/free-sound-effects/)
- [Zapsplat](https://www.zapsplat.com/)

Free music:
- [OpenGameArt](https://opengameart.org/)
- [Incompetech](https://incompetech.com/)
