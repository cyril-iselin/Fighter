// ============================================================================
// BOSS EVENT RENDERER
// ============================================================================
// Renders boss event overlays: circles, markers, timer rings, energy effects
// Creates its own overlay canvas positioned over the game canvas
// ============================================================================

import type { ActiveBossEvent } from './boss-event.types';
import { TICK_RATE } from '../../../core/config';

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
// SpineRenderer uses: skeleton.y = GROUND_Y - gameY = 250 - gameY
// Then screen: DESIGN_HEIGHT - skeleton.y = 1080 - (250 - gameY) = 830 + gameY
// So: screenY = 830 + gameY (when gameY=0 at ground, screenY=830)


export class BossEventRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pulseTime: number = 0;

  /** Left edge of camera viewport for coordinate conversion */
  private cameraLeft: number = 0;

  constructor(container: HTMLElement) {
    // Create overlay canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = DESIGN_WIDTH;
    this.canvas.height = DESIGN_HEIGHT;
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    `;

    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context for event overlay');
    this.ctx = ctx;
  }

  /**
   * Update camera left edge for coordinate conversion
   * @param x Left edge of camera viewport (cameraLeft)
   */
  setCameraLeft(x: number): void {
    this.cameraLeft = x;
  }

  /**
   * Main render function - call every frame
   */
  render(event: ActiveBossEvent | null, deltaMs: number, groundY: number): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

    if (!event) return;

    // Update animation time
    this.pulseTime += deltaMs / 1000;

    // Render based on event type
    switch (event.definition.type) {
      case 'ground-circle':
        this.renderGroundCircle(event, groundY);
        break;
      case 'quick-dash':
        this.renderQuickDash(event, groundY);
        break;
      case 'dummy-wave':
        this.renderDummyWave(event, groundY);
        break;
    }

    // Boss is completely invisible during events (no energy effect)
    // this.renderBossEnergy(deltaMs);

    // Render countdown timer
    this.renderTimer(event);


  }

  /**
   * Render ground circle event
   */
  private renderGroundCircle(event: ActiveBossEvent, groundY: number): void {
    if (event.definition.type !== 'ground-circle') return;

    const { targetPosition, conditionMet, phase } = event;
    const { radius } = event.definition;
    const evt = event as any;
    const holdTime = evt.holdTime || 0;
    const REQUIRED_HOLD_TICKS = 30;
    const holdProgress = Math.min(holdTime / REQUIRED_HOLD_TICKS, 1);

    const screen = {
      x: targetPosition.x - this.cameraLeft,
      y: groundY + targetPosition.y,
    };

    const isActive = phase === 'active';

    // Pulsing effect
    const pulse = Math.sin(this.pulseTime * 3) * 0.05 + 1;
    const displayRadius = radius * pulse;

    this.ctx.save();

    // === OUTER GLOW RINGS (multiple layers) ===
    for (let i = 3; i >= 0; i--) {
      const glowRadius = displayRadius + i * 15;
      const glowOpacity = 0.1 - i * 0.02;
      const gradient = this.ctx.createRadialGradient(
        screen.x, screen.y, displayRadius,
        screen.x, screen.y, glowRadius
      );
      gradient.addColorStop(0, `rgba(57, 255, 20, ${glowOpacity})`);
      gradient.addColorStop(1, 'rgba(57, 255, 20, 0)');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, glowRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // === INNER FILL (gradient from center) ===
    const fillGradient = this.ctx.createRadialGradient(
      screen.x, screen.y, 0,
      screen.x, screen.y, displayRadius
    );
    if (conditionMet) {
      fillGradient.addColorStop(0, 'rgba(57, 255, 20, 0.4)');
      fillGradient.addColorStop(1, 'rgba(57, 255, 20, 0.1)');
    } else {
      fillGradient.addColorStop(0, 'rgba(255, 200, 0, 0.3)');
      fillGradient.addColorStop(1, 'rgba(255, 200, 0, 0.05)');
    }
    this.ctx.fillStyle = fillGradient;
    this.ctx.beginPath();
    this.ctx.arc(screen.x, screen.y, displayRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // === HOLD PROGRESS RING (fills as player stands inside) ===
    if (holdProgress > 0 && !conditionMet) {
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, displayRadius - 10, -Math.PI / 2, -Math.PI / 2 + holdProgress * Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(57, 255, 20, 0.9)';
      this.ctx.lineWidth = 12;
      this.ctx.lineCap = 'round';
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = 'rgba(57, 255, 20, 0.8)';
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }

    // === OUTER BORDER (rotating dashed line) ===
    const dashRotation = this.pulseTime * 2;
    this.ctx.save();
    this.ctx.translate(screen.x, screen.y);
    this.ctx.rotate(dashRotation);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, displayRadius, 0, Math.PI * 2);
    this.ctx.setLineDash([15, 10]);
    this.ctx.strokeStyle = conditionMet ? 'rgba(57, 255, 20, 0.8)' : 'rgba(255, 200, 0, 0.8)';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();

    // === PARTICLE EFFECTS (floating upward) ===
    if (isActive) {
      const particleCount = conditionMet ? 12 : 6;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + this.pulseTime;
        const distance = displayRadius * 0.8;
        const particleX = screen.x + Math.cos(angle) * distance;
        const particleY = screen.y + Math.sin(angle) * distance - (this.pulseTime * 20) % 30;
        const particleSize = 4;
        
        this.ctx.fillStyle = conditionMet ? 'rgba(57, 255, 20, 0.6)' : 'rgba(255, 200, 0, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // === SUCCESS COUNTER ===
    const requiredSuccesses = event.definition.requiredSuccesses ?? 1;
    if (requiredSuccesses > 1) {
      this.ctx.font = 'bold 36px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.lineWidth = 5;
      const counterText = `${event.successCount + 1}/${requiredSuccesses}`;
      this.ctx.strokeText(counterText, screen.x, screen.y + displayRadius + 50);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this.ctx.fillText(counterText, screen.x, screen.y + displayRadius + 50);
    }

    // === CENTER ICON/TEXT ===
    if (conditionMet) {
      // Success checkmark with glow
      this.ctx.font = 'bold 64px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = 'rgba(57, 255, 20, 0.9)';
      this.ctx.fillStyle = 'rgba(57, 255, 20, 1)';
      this.ctx.fillText('✓', screen.x, screen.y);
      this.ctx.shadowBlur = 0;
    } else if (holdProgress > 0) {
      // Show hold percentage
      this.ctx.font = 'bold 48px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = 'rgba(57, 255, 20, 0.9)';
      const percentage = Math.floor(holdProgress * 100);
      this.ctx.fillText(`${percentage}%`, screen.x, screen.y);
    } else {
      // Arrow pointing down
      this.ctx.font = 'bold 56px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
      this.ctx.fillText('↓', screen.x, screen.y);
    }

    this.ctx.restore();
  }

  /**
   * Render quick dash event - floating orb to catch
   */
  private renderQuickDash(event: ActiveBossEvent, groundY: number): void {
    if (event.definition.type !== 'quick-dash') return;

    const { targetPosition, conditionMet, phase } = event;
    const { targetRadius, spawnHeight } = event.definition;

    // Use the actual Y position (includes spawnHeight)
    const screen = {
      x: targetPosition.x - this.cameraLeft,
      y: groundY + targetPosition.y,
    };

    const isActive = phase === 'active';
    const pulse = Math.sin(this.pulseTime * 6) * 0.15 + 1;

    // Floating bob animation
    const bobOffset = Math.sin(this.pulseTime * 3) * 15;
    const orbY = screen.y + bobOffset;

    this.ctx.save();

    const orbRadius = (targetRadius * 0.4) * pulse;

    // Determine if this is an aerial orb (negative spawnHeight = in the air)
    const isAerial = (spawnHeight ?? 0) < 0;

    // Colors based on state
    const baseColor = conditionMet ? '#00ff64' : (isAerial ? '#00d4ff' : '#ffcc00');

    // Outer glow
    this.ctx.shadowColor = baseColor;
    this.ctx.shadowBlur = 30;

    // Glow rings (pulsing)
    for (let i = 3; i > 0; i--) {
      const ringRadius = orbRadius * (1 + i * 0.5) * pulse;
      const alpha = 0.15 / i;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, orbY, ringRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = `${baseColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      this.ctx.fill();
    }

    // Main orb with gradient
    const gradient = this.ctx.createRadialGradient(
      screen.x - orbRadius * 0.3, orbY - orbRadius * 0.3, 0,
      screen.x, orbY, orbRadius
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, baseColor);
    gradient.addColorStop(1, conditionMet ? '#006622' : (isAerial ? '#0066aa' : '#cc8800'));

    this.ctx.beginPath();
    this.ctx.arc(screen.x, orbY, orbRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Sparkle effect
    const sparkleCount = 6;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (this.pulseTime * 2 + i * (Math.PI * 2 / sparkleCount)) % (Math.PI * 2);
      const sparkleX = screen.x + Math.cos(angle) * orbRadius * 1.8;
      const sparkleY = orbY + Math.sin(angle) * orbRadius * 1.8;
      const sparkleSize = 3 + Math.sin(this.pulseTime * 8 + i) * 2;

      this.ctx.beginPath();
      this.ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.fill();
    }

    // Draw success counter
    const requiredSuccesses = event.definition.requiredSuccesses ?? 1;
    if (requiredSuccesses > 1) {
      this.ctx.font = 'bold 32px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.lineWidth = 4;
      const counterText = `${event.successCount + 1}/${requiredSuccesses}`;
      this.ctx.strokeText(counterText, screen.x, orbY + orbRadius + 50);
      this.ctx.fillText(counterText, screen.x, orbY + orbRadius + 50);
    }

    // Success indicator
    if (conditionMet && isActive) {
      this.ctx.font = 'bold 48px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = 'rgba(100, 255, 150, 0.9)';
      this.ctx.shadowBlur = 0;
      this.ctx.fillText('✓', screen.x, orbY);
    }

    this.ctx.restore();
  }

  /**
   * Render dummy wave event
   */
  private renderDummyWave(event: ActiveBossEvent, groundY: number): void {
    if (event.definition.type !== 'dummy-wave') return;

    const evt = event as any;
    const dummy = evt.currentDummy;
    const def = event.definition;

    // Render death animation if dummy is dying
    if (dummy && !dummy.alive && dummy.deathAnimationTicks > 0) {
      this.renderDummyDeathAnimation(dummy, groundY);
    }

    // Render kill counter
    const killed = evt.dummyKilledCount || 0;
    const total = def.totalDummies;

    this.ctx.save();
    
    // Counter background
    const counterX = DESIGN_WIDTH / 2;
    const counterY = 250;

    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Shadow
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetX = 3;
    this.ctx.shadowOffsetY = 3;

    // Text
    const counterText = `DUMMIES: ${killed}/${total}`;
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    this.ctx.lineWidth = 6;
    this.ctx.strokeText(counterText, counterX, counterY);
    
    this.ctx.fillStyle = killed === total ? 'rgba(57, 255, 20, 1)' : 'rgba(255, 200, 0, 1)';
    this.ctx.shadowBlur = 0;
    this.ctx.fillText(counterText, counterX, counterY);

    this.ctx.restore();
  }

  /**
   * Render dummy death animation (shrink and fade)
   */
  private renderDummyDeathAnimation(dummy: any, groundY: number): void {
    const DEATH_DURATION = 25; // Total ticks
    const progress = 1 - (dummy.deathAnimationTicks / DEATH_DURATION);

    // Convert dummy world position to screen coordinates
    // groundY is canvas Y where ground is (e.g., 830 for City1)
    // dummy.x is world X, dummy.y is Spine world Y (e.g., 100 for City1 ground)
    const screenX = dummy.x - this.cameraLeft;
    const screenY = groundY; // Dummy is on ground, so use groundY directly

    // Scale effect: 1.0 -> 0.0 (shrink to nothing)
    const scale = 1.0 - progress;

    // Fade effect: 1.0 -> 0.0
    const alpha = 1.0 - progress;

    this.ctx.save();
    this.ctx.translate(screenX, screenY);

    // Large visible circle
    const baseRadius = 150;
    const radius = baseRadius * scale;

    // Bright red circle that's easy to see
    this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Outline for visibility
    this.ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
    this.ctx.lineWidth = 5;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Render countdown timer at top of screen
   */
  private renderTimer(event: ActiveBossEvent): void {
    const INTRO_TICKS = TICK_RATE; // Must match boss-event-manager
    const elapsed = event.currentTick - event.startTick - INTRO_TICKS;
    const duration = event.definition.durationTicks;
    const remaining = Math.max(0, duration - elapsed);
    const seconds = (remaining / 60).toFixed(1);

    const isActive = event.phase === 'active';
    const isLow = remaining < 60; // Less than 1 second

    this.ctx.save();

    // Timer background
    const timerWidth = 200;
    const timerHeight = 50;
    const timerX = DESIGN_WIDTH / 2 - timerWidth / 2;
    const timerY = 120; // Below level display

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.roundRect(timerX, timerY, timerWidth, timerHeight, 10);
    this.ctx.fill();

    // Progress bar
    if (isActive) {
      const progress = 1 - elapsed / duration;
      const barWidth = (timerWidth - 20) * Math.max(0, progress);

      this.ctx.fillStyle = isLow ? 'rgba(255, 50, 50, 0.8)' : 'rgba(255, 200, 0, 0.8)';
      this.ctx.roundRect(timerX + 10, timerY + timerHeight - 15, barWidth, 8, 4);
      this.ctx.fill();
    }

    // Timer text
    this.ctx.font = 'bold 28px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = isLow && isActive ? '#ff5050' : '#ffffff';
    this.ctx.fillText(isActive ? `${seconds}s` : 'Bereit!', DESIGN_WIDTH / 2, timerY + 22);

    this.ctx.restore();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.canvas.remove();
  }

  /**
   * Clear the overlay
   */
  clear(): void {
    this.ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  }
}
