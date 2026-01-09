// ============================================================================
// COMBAT TEXT RENDERER
// ============================================================================
// Displays floating combat feedback text above fighters
// - Damage numbers (body/head hits)
// - Block/Parry icons
// ============================================================================

import type { GameEvent } from '../core/types';
import type { BoneSamples } from '../core/bone-samples';

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

interface CombatText {
  id: number;
  x: number;           // World X position
  y: number;           // World Y position (starts at head)
  text: string;        // Display text (damage number or icon)
  color: string;       // Text color
  icon?: string;       // Optional icon/emoji
  scale?: number;      // Text scale multiplier (default: 1.0)
  centered?: boolean;  // If true, stays centered (no float)
  lifetime: number;    // Ticks remaining
  age: number;         // Current age in ticks
}

export class CombatTextRenderer {
  private ctx: CanvasRenderingContext2D;
  private texts: CombatText[] = [];
  private nextId = 0;
  
  private readonly LIFETIME_TICKS = 60;      // 1 second @ 60Hz
  private readonly FLOAT_SPEED = 3;          // Pixels per tick upward
  private readonly HEAD_OFFSET_Y = -300;      // Offset above head position

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Handle game event and spawn appropriate combat text
   */
  handleEvent(event: GameEvent, boneSamples: [BoneSamples, BoneSamples]): void {
    console.log('[CombatText] Handling event:', event.type, event);
    
    switch (event.type) {
      case 'hit': {
        // Damage number over attacker's head
        const attackerBones = boneSamples[event.attacker];
        const isHeadshot = event.zone === 'top';
        
        console.log('[CombatText] Spawning hit text at', attackerBones.head);
        
        this.spawn({
          x: attackerBones.head.x,
          y: attackerBones.head.y,
          text: event.damage.toString(),
          color: isHeadshot ? '#ff6b6b' : '#ffd93d',  // Red for headshot, yellow for body
          icon: isHeadshot ? '💀' : '👊',
        });
        break;
      }
      
      case 'block': {
        // Block icon over defender's head
        const defenderBones = boneSamples[event.defender];
        
        console.log('[CombatText] Spawning block text at', defenderBones.head);
        
        this.spawn({
          x: defenderBones.head.x,
          y: defenderBones.head.y,
          text: event.perfect ? 'PERFECT' : 'BLOCK',
          color: event.perfect ? '#6bcf7f' : '#6dd5ed',  // Green for perfect, cyan for normal
          icon: '🛡️',
        });
        break;
      }
      
      case 'parry': {
        // Parry icon over defender's head
        const defenderBones = boneSamples[event.defender];
        
        console.log('[CombatText] Spawning parry text at', defenderBones.head);
        
        this.spawn({
          x: defenderBones.head.x,
          y: defenderBones.head.y,
          text: 'PARRY!',
          color: '#00ff88',  // Bright green
          icon: '✨',
        });
        break;
      }
      
      case 'stun': {
        // Stun icon over stunned fighter's head
        const stunBones = boneSamples[event.fighter];
        
        console.log('[CombatText] Spawning stun text at', stunBones.head);
        
        this.spawn({
          x: stunBones.head.x,
          y: stunBones.head.y,
          text: 'STUNNED!',
          color: '#ff4757',  // Bright red
          icon: '😵‍💫',
        });
        break;
      }
      
      case 'rageBurst': {
        // Rage burst - big dramatic text over the boss
        const burstBones = boneSamples[event.fighter];
        
        console.log('[CombatText] Spawning rage burst text at', burstBones.head);
        
        // Main "RAGE!" text - big and dramatic
        this.spawn({
          x: burstBones.head.x,
          y: burstBones.head.y - 50,  // Higher than normal
          text: '💢 RAGE! 💢',
          color: '#ff3300',  // Bright red-orange
          icon: '',
          scale: 1.5,  // Bigger text
        });
        break;
      }
      
      case 'phaseChange': {
        // Phase change - big centered announcement
        console.log('[CombatText] Spawning phase change text:', event.phaseName);
        
        this.spawn({
          x: DESIGN_WIDTH / 2,  // Center of screen
          y: DESIGN_HEIGHT / 2 - 100,  // Slightly above center
          text: `⚔️ ${event.phaseName.toUpperCase()} ⚔️`,
          color: '#ffaa00',  // Gold/amber color
          icon: '',
          scale: 2.0,  // Much bigger
          centered: true,  // Don't float up
        });
        break;
      }
    }
  }

  /**
   * Spawn a new combat text
   */
  private spawn(config: {
    x: number;
    y: number;
    text: string;
    color: string;
    icon?: string;
    scale?: number;
    centered?: boolean;
  }): void {
    const newText: CombatText = {
      id: this.nextId++,
      x: config.x,
      y: config.centered ? config.y : config.y - this.HEAD_OFFSET_Y,  // Start above head (unless centered)
      text: config.text,
      color: config.color,
      icon: config.icon,
      scale: config.scale ?? 1.0,
      centered: config.centered ?? false,
      lifetime: config.centered ? 90 : this.LIFETIME_TICKS,  // Longer lifetime for centered
      age: 0,
    };
    
    this.texts.push(newText);
  }

  /**
   * Update all active combat texts (called every tick)
   */
  update(): void {
    for (const text of this.texts) {
      text.age++;
      // Only float upward if not centered
      if (!text.centered) {
        text.y -= this.FLOAT_SPEED;
      }
    }
    
    // Remove expired texts
    this.texts = this.texts.filter(t => t.age < t.lifetime);
  }

  /**
   * Render all active combat texts
   */
  render(): void {

    const ctx = this.ctx;
    
    for (const text of this.texts) {
      // Calculate fade-out opacity (1.0 -> 0.0 over lifetime)
      const lifeProgress = text.age / text.lifetime;
      const opacity = 1.0 - lifeProgress;
      
      // Convert world Y to canvas Y (flip Y axis)
      const canvasY = DESIGN_HEIGHT - text.y;
      
      // Scale based on age (start big, shrink slightly) + custom scale multiplier
      const baseScale = text.scale ?? 1.0;
      const ageScale = 1.0 + (0.3 * (1.0 - lifeProgress));
      const scale = baseScale * ageScale;
      
      ctx.save();
      ctx.globalAlpha = opacity;
      
      // Draw icon (if present)
      if (text.icon) {
        ctx.font = `${Math.floor(48 * scale)}px "Segoe UI Emoji", "Noto Color Emoji", Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text.icon, text.x, canvasY - 30);
      }
      
      // Draw text with outline
      ctx.font = `bold ${Math.floor(42 * scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Black outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText(text.text, text.x, canvasY + 10);
      
      // Colored fill
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, canvasY + 10);
      
      ctx.restore();
    }
  }

  /**
   * Clear all active texts
   */
  clear(): void {
    this.texts = [];
  }
}
