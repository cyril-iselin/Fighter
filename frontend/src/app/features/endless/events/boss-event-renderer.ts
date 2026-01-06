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

  /** Boss position for energy effect */




  /** Particles for energy effect */
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }> = [];

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

    const screen = {
      x: targetPosition.x - this.cameraLeft,
      y: groundY + targetPosition.y,
    };

    // Calculate progress for visual feedback
    const progress = this.calculateProgress(event);
    const isActive = phase === 'active';

    // Pulsing effect
    const pulse = Math.sin(this.pulseTime * 4) * 0.1 + 1;
    const displayRadius = radius * pulse * (isActive ? 1 : 0.5 + progress * 0.5);

    // Colors based on state
    const baseColor = conditionMet ? 'rgba(0, 255, 100, ' : 'rgba(255, 200, 0, ';
    const fillOpacity = isActive ? 0.3 : 0.1;
    const strokeOpacity = isActive ? 0.9 : 0.4;

    // Draw filled circle
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(screen.x, screen.y, displayRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = baseColor + fillOpacity + ')';
    this.ctx.fill();

    // Draw border
    this.ctx.strokeStyle = baseColor + strokeOpacity + ')';
    this.ctx.lineWidth = conditionMet ? 6 : 4;
    this.ctx.stroke();

    // Draw inner ring (progress indicator)
    if (isActive) {
      const elapsed = event.currentTick - event.startTick;
      const duration = event.definition.durationTicks;
      const timeProgress = elapsed / duration;

      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, displayRadius * 0.7, -Math.PI / 2, -Math.PI / 2 + (1 - timeProgress) * Math.PI * 2);
      this.ctx.strokeStyle = conditionMet ? 'rgba(100, 255, 150, 0.8)' : 'rgba(255, 100, 100, 0.8)';
      this.ctx.lineWidth = 8;
      this.ctx.stroke();
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
      const counterText = `${event.successCount}/${requiredSuccesses}`;
      this.ctx.strokeText(counterText, screen.x, screen.y + displayRadius + 40);
      this.ctx.fillText(counterText, screen.x, screen.y + displayRadius + 40);
    }

    // Draw checkmark if condition met
    if (conditionMet && isActive) {
      this.ctx.font = 'bold 48px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = 'rgba(100, 255, 150, 0.9)';
      this.ctx.fillText('✓', screen.x, screen.y);
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

    // Draw actual HITZONE for debugging (shows where player needs to be)
    if (isActive) {
      // X hitzone: targetRadius * 2.0 on each side (must match boss-event-manager.ts!)
      const hitboxHalfWidth = targetRadius * 2.0;

      // Y hitzone: player must be at orbY + 80 or higher (more negative)
      // So hitzone goes from orbY + 80 (bottom) to top of screen
      const hitboxBottom = screen.y + 80; // screen Y where player Y would be orbY + 80
      const hitboxTop = 0; // extends to top

      // Draw hitzone box (green = where you need to be)
      this.ctx.beginPath();
      this.ctx.rect(
        screen.x - hitboxHalfWidth,
        hitboxTop,
        hitboxHalfWidth * 2,
        hitboxBottom - hitboxTop
      );
      this.ctx.fillStyle = 'rgba(0, 255, 100, 0.15)';
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.5)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Draw X-range indicator at orb height
      this.ctx.beginPath();
      this.ctx.moveTo(screen.x - hitboxHalfWidth, orbY);
      this.ctx.lineTo(screen.x + hitboxHalfWidth, orbY);
      this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
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
      const counterText = `${event.successCount}/${requiredSuccesses}`;
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
   * Calculate intro progress (0-1)
   */
  private calculateProgress(event: ActiveBossEvent): number {
    const INTRO_TICKS = 60; // Must match boss-event-manager
    const elapsed = event.currentTick - event.startTick;
    return Math.min(1, elapsed / INTRO_TICKS);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.canvas.remove();
    this.particles = [];
  }

  /**
   * Clear the overlay
   */
  clear(): void {
    this.ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.particles = [];
  }
}
