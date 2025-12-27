// ============================================================================
// BONE-DRIVEN DEBUG OVERLAY
// ============================================================================
// Visualizes sampled bone positions and collision results
// 
// COORDINATE SYSTEM:
// - Debug canvas buffer: ALWAYS 1920x1080 (design dimensions)
// - CSS scales canvas to fit container (stretch, no letterboxing)
// - Bone coordinates are in Spine world space (1920x1080 design)
// - Y-flip: Spine Y+ is UP, Canvas 2D Y+ is DOWN
// ============================================================================

import type { MatchState } from '../core/types';
import type { BoneSamples } from '../core/bone-samples';
import { getBoneCombatDebugData } from '../core/bone-combat';
import { getAttackResolver } from '../characters/provider-registry';
import { getCharacter } from '../characters/registry';

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

export interface BoneDebugConfig {
  showBones: boolean;
  showHurtboxes: boolean;
  showHitboxes: boolean;
  showCollisions: boolean;
  showCalibration: boolean;  // Show raw vs quantized for alignment debugging
  showAllHitboxes: boolean;  // Show all possible hitboxes for each loadout
}

export class BoneDebugRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: BoneDebugConfig;
  private _loggedOnce = false;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.config = {
      showBones: true,
      showHurtboxes: true,
      showHitboxes: true,
      showCollisions: true,
      showCalibration: false,
      showAllHitboxes: false,
    };
  }

  setConfig(config: Partial<BoneDebugConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Spine world Y and Canvas 2D use different conventions:
   * - Spine/WebGL: Y=0 at bottom, Y increases upward
   * - Canvas 2D: Y=0 at top, Y increases downward
   * 
   * Since WebGL ortho2d is configured to match canvas (via MVP matrix),
   * and bone positions are in Spine world space, we need to flip Y
   * to match what WebGL renders.
   */
  private toCanvasY(spineY: number): number {
    return DESIGN_HEIGHT - spineY;
  }

  /**
   * Clear debug overlay (call before each frame)
   */
  clear(): void {
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  render(
    state: MatchState,
    boneSamples: [BoneSamples, BoneSamples]
  ): void {
    // Clear previous frame
    this.clear();
    
    if (!this.config.showBones && !this.config.showHurtboxes && !this.config.showHitboxes) {
      return;
    }

    const ctx = this.ctx;
    
    // Debug: Log once to confirm rendering is happening
    if (!this._loggedOnce) {
      console.log('[BoneDebug] Rendering debug overlay');
      console.log('[BoneDebug] Fighter 0 position:', state.fighters[0].x, state.fighters[0].y);
      console.log('[BoneDebug] Bone samples:', boneSamples[0]);
      this._loggedOnce = true;
    }

    // Render each fighter
    for (let i = 0; i < 2; i++) {
      const fighter = state.fighters[i];
      const bones = boneSamples[i];
      const color = i === 0 ? 'rgba(100, 150, 255, 0.8)' : 'rgba(255, 100, 100, 0.8)';
      const characterId = fighter.characterId || 'stickman';

      // 1) Bone points
      if (this.config.showBones) {
        this.renderBonePoints(bones, color);
      }

      // 2) Hurtboxes (head + chest)
      if (this.config.showHurtboxes) {
        this.renderHurtboxes(bones, characterId, fighter.facingRight);
      }

      // 3) Attack hitbox (if attacking)
      if (this.config.showHitboxes && fighter.state === 'attack') {
        this.renderAttackHitbox(fighter, bones);
      }
      
      // 4) All possible hitboxes for this loadout (preview mode)
      if (this.config.showAllHitboxes) {
        this.renderAllPossibleHitboxes(fighter, bones, i, characterId);
      }
    }

    // 5) Collision feedback
    if (this.config.showCollisions) {
      this.renderCollisionFeedback();
    }
    
    // 5) Calibration info panel
    if (this.config.showCalibration) {
      this.renderCalibrationInfo(state, boneSamples);
    }
  }

  /**
   * Render all possible hitboxes for a fighter based on their loadout
   * Shows potential attack ranges visually
   */
  private renderAllPossibleHitboxes(fighter: any, bones: BoneSamples, fighterIndex: number, characterId: string): void {
    const ctx = this.ctx;
    const loadout = fighterIndex === 0 ? 'bare' : 'sword'; // TODO: Get actual loadout from fighter
    
    // Get all attacks available to this loadout
    const attackResolver = getAttackResolver(characterId);
    const availableAttacks = attackResolver.getAttacksForLoadout(loadout);

    // Color coding by bone type
    const boneColors: Record<string, string> = {
      rightHand: 'rgba(100, 200, 255, 0.3)', // Light blue
      leftHand: 'rgba(150, 100, 255, 0.3)',  // Purple
      rightFoot: 'rgba(255, 100, 100, 0.3)', // Red
      leftFoot: 'rgba(255, 150, 100, 0.3)',  // Orange
      weaponLine: 'rgba(255, 255, 100, 0.4)', // Yellow
    };

    // Get character configs
    const character = getCharacter(characterId);
    if (!character) {
      console.warn('[BoneDebug] No character found for debug overlay:', characterId);
      return;
    }

    // Draw hitboxes for each attack
    availableAttacks.forEach(attackId => {
      const hitboxConfig = character.combat.hitboxes[attackId];
      if (!hitboxConfig) return;

      // Support both single bone and array of bones
      const boneNames = Array.isArray(hitboxConfig.bone) ? hitboxConfig.bone : [hitboxConfig.bone];
      
      boneNames.forEach((boneName: string) => {
        ctx.strokeStyle = boneColors[boneName] || 'rgba(128, 128, 128, 0.3)';
        ctx.lineWidth = 1;

        if (boneName === 'weaponLine') {
          // Weapon line hitbox
          const weaponLine = bones.weaponLine;
          if (weaponLine) {
            const y1 = this.toCanvasY(weaponLine.y1);
            const y2 = this.toCanvasY(weaponLine.y2);
            
            // Main line
            ctx.beginPath();
            ctx.moveTo(weaponLine.x1, y1);
            ctx.lineTo(weaponLine.x2, y2);
            ctx.stroke();
            
            // Thickness indicator
            const thickness = hitboxConfig.thickness || 40;
            const dx = weaponLine.x2 - weaponLine.x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
              const nx = (-dy / len) * (thickness / 2);
              const ny = (dx / len) * (thickness / 2);
              
              ctx.beginPath();
              ctx.moveTo(weaponLine.x1 + nx, y1 + ny);
              ctx.lineTo(weaponLine.x2 + nx, y2 + ny);
              ctx.lineTo(weaponLine.x2 - nx, y2 - ny);
              ctx.lineTo(weaponLine.x1 - nx, y1 - ny);
              ctx.closePath();
              ctx.stroke();
            }
            
            // Label
            const midX = (weaponLine.x1 + weaponLine.x2) / 2;
            const midY = (y1 + y2) / 2;
            ctx.fillStyle = 'rgba(255, 255, 100, 0.8)';
            ctx.font = '8px monospace';
            ctx.fillText(`${attackId} (${thickness}px)`, midX + 10, midY);
          }
        } else {
          // Point bone hitbox (hand/foot)
          const bonePoint = bones[boneName as keyof BoneSamples] as { x: number; y: number };
          if (bonePoint) {
            const canvasY = this.toCanvasY(bonePoint.y);
            const radius = hitboxConfig.radius;
            
            ctx.beginPath();
            ctx.arc(bonePoint.x, canvasY, radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Label (only on first bone to avoid clutter)
            if (boneName === boneNames[0]) {
              ctx.fillStyle = boneColors[boneName] || 'rgba(128, 128, 128, 0.8)';
              ctx.font = '8px monospace';
              ctx.fillText(`${attackId}`, bonePoint.x + radius + 2, canvasY - radius);
              ctx.fillText(`r=${radius}`, bonePoint.x + radius + 2, canvasY - radius + 10);
            }
          }
        }
      });
    });
  }

  /**
   * Render calibration info panel for alignment debugging
   */
  private renderCalibrationInfo(state: MatchState, boneSamples: [BoneSamples, BoneSamples]): void {
    const ctx = this.ctx;
    const fighter0 = state.fighters[0];
    const bones0 = boneSamples[0];
    
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, 10, 320, 220);
    
    ctx.font = '12px monospace';
    ctx.fillStyle = '#fff';
    
    let y = 30;
    ctx.fillText('=== CALIBRATION MODE ===', 20, y); y += 18;
    ctx.fillText(`Game Position: (${fighter0.x.toFixed(0)}, ${fighter0.y.toFixed(0)})`, 20, y); y += 16;
    ctx.fillText(`Facing: ${fighter0.facingRight ? 'RIGHT' : 'LEFT'}`, 20, y); y += 18;
    
    ctx.fillText('--- BONE POSITIONS (quantized) ---', 20, y); y += 16;
    ctx.fillStyle = '#8af';
    ctx.fillText(`RH: (${bones0.rightHand.x}, ${bones0.rightHand.y})`, 20, y); y += 14;
    ctx.fillText(`LH: (${bones0.leftHand.x}, ${bones0.leftHand.y})`, 20, y); y += 14;
    ctx.fillText(`RF: (${bones0.rightFoot.x}, ${bones0.rightFoot.y})`, 20, y); y += 14;
    ctx.fillText(`LF: (${bones0.leftFoot.x}, ${bones0.leftFoot.y})`, 20, y); y += 18;
    
    ctx.fillStyle = '#0f0';
    ctx.fillText(`HEAD: (${bones0.head.x}, ${bones0.head.y})`, 20, y); y += 14;
    ctx.fillText(`CHEST: (${bones0.chest.x}, ${bones0.chest.y})`, 20, y); y += 18;
    
    // Delta from game position (to check transform)
    ctx.fillStyle = '#ff0';
    const chestDeltaX = bones0.chest.x - fighter0.x;
    const chestDeltaY = bones0.chest.y;
    ctx.fillText(`Chest delta from gameX: ${chestDeltaX}px`, 20, y); y += 14;
    ctx.fillText(`Press C to toggle calibration`, 20, y);
  }

  private renderBonePoints(bones: BoneSamples, color: string): void {
    const ctx = this.ctx;
    const canvas = ctx.canvas;

    const points = [
      { name: 'RH', pos: bones.rightHand },
      { name: 'LH', pos: bones.leftHand },
      { name: 'RF', pos: bones.rightFoot },
      { name: 'LF', pos: bones.leftFoot },
      { name: 'HEAD', pos: bones.head },
      { name: 'CHEST', pos: bones.chest },
    ];

    for (const { name, pos } of points) {
      // Convert Spine Y (up) to Canvas Y (down)
      const canvasX = pos.x;
      const canvasY = this.toCanvasY(pos.y);
      
      // Draw filled circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw border for visibility
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label with background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(canvasX + 12, canvasY - 20, 120, 18);
      ctx.fillStyle = 'yellow';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${name}(${Math.round(canvasX)},${Math.round(canvasY)})`, canvasX + 15, canvasY - 6);
    }

    // Weapon line
    if (bones.weaponLine) {
      const line = bones.weaponLine;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(line.x1, this.toCanvasY(line.y1));
      ctx.lineTo(line.x2, this.toCanvasY(line.y2));
      ctx.stroke();
      
      // Draw endpoints as small circles
      ctx.fillStyle = 'yellow';
      ctx.beginPath();
      ctx.arc(line.x1, this.toCanvasY(line.y1), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(line.x2, this.toCanvasY(line.y2), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderHurtboxes(bones: BoneSamples, characterId: string, facingRight: boolean): void {
    const ctx = this.ctx;

    // Get character-specific hurtbox config
    const character = getCharacter(characterId);
    if (!character) return;

    // Flip offsetX based on facing direction (offset is defined for facing right)
    const facingMultiplier = facingRight ? 1 : -1;

    // Head hurtbox (Circle)
    const headConfig = character.combat.hurtboxes['head'];
    if (headConfig.radius) {
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        bones.head.x + (headConfig.offsetX ?? 0) * facingMultiplier, 
        this.toCanvasY(bones.head.y + (headConfig.offsetY ?? 0)), 
        headConfig.radius, 
        0, 
        Math.PI * 2
      );
      ctx.stroke();
    }

    // Chest hurtbox (Box)
    const chestConfig = character.combat.hurtboxes['chest'];
    if (chestConfig.width && chestConfig.height) {
      const centerX = bones.chest.x + (chestConfig.offsetX ?? 0) * facingMultiplier;
      const centerY = bones.chest.y + (chestConfig.offsetY ?? 0);
      
      // Convert center coordinates to top-left for rect drawing
      const rectX = centerX - chestConfig.width / 2;
      const rectY = this.toCanvasY(centerY + chestConfig.height / 2);

      ctx.strokeStyle = 'rgba(0, 200, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rectX, rectY, chestConfig.width, chestConfig.height);
    }
  }

  private renderAttackHitbox(fighter: any, bones: BoneSamples): void {
    const debugData = getBoneCombatDebugData();
    
    if (!debugData) {
      return;
    }
    
    if (debugData.attackerBones.fighterId !== bones.fighterId) {
      return;
    }

    const ctx = this.ctx;
    const window = debugData.activeWindow;
    
    // Blink calculation (shared for all hitboxes)
    let isBlinking = false;
    if (window.isActive) {
      const blinkPhase = Math.floor(window.tickInAttack / 3) % 2;
      isBlinking = blinkPhase === 0;
    }

    // Render ALL hitboxes for multi-bone attacks
    if (debugData.allHitboxPositions && debugData.allHitboxPositions.length > 0) {
      // Multi-bone attack: render all hitboxes
      for (const { bone, position } of debugData.allHitboxPositions) {
        const canvasY = this.toCanvasY(position.y);
        const isHittingBone = bone === debugData.hitboxBone;
        
        // Active window visualization: different colors + thickness
        // Hitting bone is brighter, other bones are slightly dimmer
        if (isHittingBone && (debugData.collisionResult.headHit || debugData.collisionResult.chestHit)) {
          // This bone actually hit - bright yellow/orange
          ctx.strokeStyle = window.isActive
            ? (isBlinking ? 'rgba(255, 255, 0, 1)' : 'rgba(255, 100, 0, 1)')
            : 'rgba(0, 255, 100, 0.6)';
          ctx.lineWidth = (window.isActive && isBlinking) ? 6 : 3;
        } else {
          // Other hitboxes - slightly dimmer but still visible
          ctx.strokeStyle = window.isActive
            ? (isBlinking ? 'rgba(200, 200, 0, 0.8)' : 'rgba(200, 80, 0, 0.8)')
            : 'rgba(0, 200, 80, 0.5)';
          ctx.lineWidth = (window.isActive && isBlinking) ? 4 : 2;
        }

        ctx.beginPath();
        ctx.arc(position.x, canvasY, position.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Label each bone
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(bone, position.x - 20, canvasY - position.radius - 5);
      }
      
      // Show collision result once
      const result = debugData.collisionResult;
      const hit = result.headHit || result.chestHit;
      if (hit) {
        const hitText = result.headHit ? 'HEAD' : 'BODY';
        const hitbox = debugData.hitboxPosition as { x: number; y: number; radius: number };
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = 'rgba(0, 255, 0, 1)';
        ctx.fillText(`${debugData.hitboxBone}: ${hitText}`, hitbox.x + hitbox.radius + 10, this.toCanvasY(hitbox.y));
      }
    } else {
      // Single hitbox (original behavior)
      const hitbox = debugData.hitboxPosition;
      
      if ('x' in hitbox && 'y' in hitbox) {
        // Circle hitbox (point bone)
        const canvasY = this.toCanvasY(hitbox.y);
        
        ctx.strokeStyle = window.isActive
          ? (isBlinking ? 'rgba(255, 255, 0, 1)' : 'rgba(255, 100, 0, 1)')
          : 'rgba(0, 255, 100, 0.6)';
        ctx.lineWidth = (window.isActive && isBlinking) ? 6 : 3;

        ctx.beginPath();
        ctx.arc(hitbox.x, canvasY, hitbox.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Show collision result
        const result = debugData.collisionResult;
        const hit = result.headHit || result.chestHit;
        const hitText = hit ? (result.headHit ? 'HEAD' : 'BODY') : 'MISS';
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = hit ? 'rgba(0, 255, 0, 1)' : 'rgba(255, 100, 100, 1)';
        ctx.fillText(`${debugData.hitboxBone}: ${hitText}`, hitbox.x + hitbox.radius + 10, canvasY);
      } else if ('x1' in hitbox) {
        // Line hitbox (weapon)
        const y1 = this.toCanvasY(hitbox.y1);
        const y2 = this.toCanvasY(hitbox.y2);
        
        ctx.strokeStyle = window.isActive
          ? (isBlinking ? 'rgba(255, 255, 0, 1)' : 'rgba(255, 100, 0, 1)')
          : 'rgba(0, 255, 100, 0.6)';
        ctx.lineWidth = (window.isActive && isBlinking) ? 6 : 3;
        
        ctx.beginPath();
        ctx.moveTo(hitbox.x1, y1);
        ctx.lineTo(hitbox.x2, y2);
        ctx.stroke();

        // Thickness visualization (only when not blinking, to avoid clutter)
        if (!isBlinking) {
          const dx = hitbox.x2 - hitbox.x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const nx = -dy / len * hitbox.thickness;
            const ny = dx / len * hitbox.thickness;

            ctx.strokeStyle = 'rgba(255, 50, 50, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hitbox.x1 + nx, y1 + ny);
            ctx.lineTo(hitbox.x2 + nx, y2 + ny);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(hitbox.x1 - nx, y1 - ny);
            ctx.lineTo(hitbox.x2 - nx, y2 - ny);
            ctx.stroke();
          }
        }
      }
    }
  }

  private renderCollisionFeedback(): void {
    const debugData = getBoneCombatDebugData();
    if (!debugData) return;

    const result = debugData.collisionResult;
    if (!result.headHit && !result.chestHit) return;

    const ctx = this.ctx;
    const defender = debugData.defenderBones;
    const hitPoint = result.headHit ? defender.head : defender.chest;
    const canvasY = this.toCanvasY(hitPoint.y);

    // Flash effect
    ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(hitPoint.x, canvasY, 15, 0, Math.PI * 2);
    ctx.fill();

    // Impact text
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.fillText('HIT!', hitPoint.x + 20, canvasY - 20);
  }

  dispose(): void {
    // Nothing to dispose
  }
}
