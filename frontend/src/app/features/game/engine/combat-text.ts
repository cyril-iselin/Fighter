// ============================================
// Combat Text - Floating Damage Numbers
// ============================================

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  opacity: number;
  velocityY: number;
  lifetime: number;
  maxLifetime: number;
}

export interface CombatTextConfig {
  canvas: HTMLCanvasElement;
  damageColor?: string;
  healColor?: string;
  blockColor?: string;
  perfectBlockColor?: string;
  headshotColor?: string;
}

export class CombatTextRenderer {
  private overlayCanvas: HTMLCanvasElement;
  private parentCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texts: FloatingText[] = [];
  
  // Design viewport (from spine-manager)
  private readonly DESIGN_WIDTH = 1920;
  private readonly DESIGN_HEIGHT = 1080;
  
  // Colors
  private damageColor: string;
  private healColor: string;
  private blockColor: string;
  private perfectBlockColor: string;
  private headshotColor: string;
  
  constructor(config: CombatTextConfig) {
    // Create overlay canvas on top of WebGL canvas
    this.parentCanvas = config.canvas;
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.top = this.parentCanvas.offsetTop + 'px';
    this.overlayCanvas.style.left = this.parentCanvas.offsetLeft + 'px';
    this.overlayCanvas.style.pointerEvents = 'none'; // Don't block mouse events
    this.overlayCanvas.width = this.parentCanvas.width;
    this.overlayCanvas.height = this.parentCanvas.height;
    
    // Insert overlay after the WebGL canvas
    this.parentCanvas.parentElement?.appendChild(this.overlayCanvas);
    
    this.ctx = this.overlayCanvas.getContext('2d')!;
    
    // Resize overlay when window resizes
    const resizeObserver = new ResizeObserver(() => {
      this.overlayCanvas.width = this.parentCanvas.width;
      this.overlayCanvas.height = this.parentCanvas.height;
      this.overlayCanvas.style.top = this.parentCanvas.offsetTop + 'px';
      this.overlayCanvas.style.left = this.parentCanvas.offsetLeft + 'px';
    });
    resizeObserver.observe(this.parentCanvas);
    
    // Set colors with defaults
    this.damageColor = config.damageColor ?? '#ff4444';
    this.healColor = config.healColor ?? '#44ff44';
    this.blockColor = config.blockColor ?? '#ffaa00';
    this.perfectBlockColor = config.perfectBlockColor ?? '#00ffff';
    this.headshotColor = config.headshotColor ?? '#ff0000';
  }
  
  /**
   * Convert design coordinates to pixel coordinates
   */
  private designToPixel(x: number, y: number): { x: number; y: number } {
    // Calculate scale (same as spine-manager)
    const scaleX = this.overlayCanvas.width / this.DESIGN_WIDTH;
    const scaleY = this.overlayCanvas.height / this.DESIGN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    
    const scaledWidth = this.DESIGN_WIDTH * scale;
    const scaledHeight = this.DESIGN_HEIGHT * scale;
    const offsetX = (this.overlayCanvas.width - scaledWidth) / 2;
    const offsetY = (this.overlayCanvas.height - scaledHeight) / 2;
    
    return {
      x: x * scale + offsetX,
      y: y * scale + offsetY
    };
  }
  
  /**
   * Show damage number at position
   */
  showDamage(damage: number, x: number, y: number, isHeadshot: boolean = false): void {
    const text = `-${damage}`;
    const color = isHeadshot ? this.headshotColor : this.damageColor;
    const fontSize = isHeadshot ? 42 : 32;
    
    this.addText(text, x, y, color, fontSize);
    
    // Show hit zone icon above damage number
    const icon = isHeadshot ? '🎯' : '👊'; // Target for headshot, fist for body
    this.addText(icon, x, y + 35, color, 24);
  }
  
  /**
   * Show block text
   */
  showBlock(x: number, y: number, isPerfect: boolean = false): void {
    const text = isPerfect ? 'PERFEKT!' : 'BLOCK';
    const color = isPerfect ? this.perfectBlockColor : this.blockColor;
    const fontSize = isPerfect ? 38 : 28;
    
    this.addText(text, x, y, color, fontSize);
  }
  
  /**
   * Show stomp text (jump attack)
   */
  showStomp(x: number, y: number): void {
    this.addText('STAMPFER!', x, y, '#ff66ff', 32); // Purple/pink
    this.addText('🦶', x, y + 35, '#ff66ff', 24);
  }
  
  /**
   * Show custom text (for combos, etc.)
   */
  showText(text: string, x: number, y: number, color: string = '#ffffff', fontSize: number = 28): void {
    this.addText(text, x, y, color, fontSize);
  }
  
  private addText(text: string, x: number, y: number, color: string, fontSize: number): void {
    // Add some random horizontal offset for variety
    const offsetX = (Math.random() - 0.5) * 40;
    
    this.texts.push({
      text,
      x: x + offsetX,
      y,
      color,
      fontSize,
      opacity: 1,
      velocityY: -120, // Float upward
      lifetime: 0,
      maxLifetime: 1.2 // 1.2 seconds
    });
  }
  
  /**
   * Update and render all floating texts
   * Call this every frame
   */
  update(deltaTime: number): void {
    // Update texts
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      
      // Update position
      t.y += t.velocityY * deltaTime;
      t.velocityY *= 0.95; // Slow down
      
      // Update lifetime
      t.lifetime += deltaTime;
      
      // Fade out in last 30% of lifetime
      const fadeStart = t.maxLifetime * 0.7;
      if (t.lifetime > fadeStart) {
        t.opacity = 1 - ((t.lifetime - fadeStart) / (t.maxLifetime - fadeStart));
      }
      
      // Remove expired texts
      if (t.lifetime >= t.maxLifetime) {
        this.texts.splice(i, 1);
      }
    }
  }
  
  /**
   * Render all floating texts
   * Call after WebGL rendering, before presenting
   */
  render(): void {
    if (this.texts.length === 0) return;
    
    const ctx = this.ctx;
    
    // Clear overlay canvas
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    
    // Save context state
    ctx.save();
    
    for (const t of this.texts) {
      // Convert design coordinates to pixel coordinates
      const pixelCoords = this.designToPixel(t.x, t.y);
      const screenY = this.overlayCanvas.height - pixelCoords.y;
      
      ctx.globalAlpha = t.opacity;
      ctx.font = `bold ${t.fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw text shadow/outline for better visibility
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(t.text, pixelCoords.x, screenY);
      
      // Draw text
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, pixelCoords.x, screenY);
    }
    
    // Restore context state
    ctx.restore();
  }
  
  /**
   * Clear all floating texts
   */
  clear(): void {
    this.texts = [];
  }
}
