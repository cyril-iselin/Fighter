// ============================================
// Debug Renderer - Hitbox Visualization
// ============================================

import * as spine from '@esotericsoftware/spine-webgl';
import { FighterController } from './fighter-controller';
import { FighterState } from './types';
import { AttackHitbox } from './hitbox-provider';

// ============================================
// Debug Renderer Configuration
// ============================================

export interface DebugConfig {
  showHurtboxes: boolean;
  showHitboxes: boolean;
  showPositions: boolean;
  showBoundaries: boolean;
  hurtboxColor: number[];  // RGBA 0-1
  hitboxColor: number[];   // RGBA 0-1
  boundaryColor: number[]; // RGBA 0-1
}

const DEFAULT_CONFIG: DebugConfig = {
  showHurtboxes: true,
  showHitboxes: true,
  showPositions: true,
  showBoundaries: true,
  hurtboxColor: [0, 1, 0, 0.4],    // Green
  hitboxColor: [1, 0, 0, 0.5],     // Red
  boundaryColor: [1, 1, 0, 0.3],   // Yellow
};

// ============================================
// Debug Renderer Class
// ============================================

export class DebugRenderer {
  private gl: WebGLRenderingContext;
  private shaderProgram: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private config: DebugConfig;
  
  // Fighter references
  private player1: FighterController | null = null;
  private player2: FighterController | null = null;
  
  // World boundaries
  private minX: number = 100;
  private maxX: number = 1820;
  
  // Enable/disable debug mode
  private _enabled: boolean = false;
  
  constructor(gl: WebGLRenderingContext, config: Partial<DebugConfig> = {}) {
    this.gl = gl;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initShader();
    this.createBuffers();
  }
  
  get enabled(): boolean {
    return this._enabled;
  }
  
  set enabled(value: boolean) {
    this._enabled = value;
  }
  
  toggle(): void {
    this.enabled = !this.enabled;
  }
  
  setPlayers(player1: FighterController, player2: FighterController): void {
    this.player1 = player1;
    this.player2 = player2;
  }
  
  setBoundaries(minX: number, maxX: number): void {
    this.minX = minX;
    this.maxX = maxX;
  }
  
  private initShader(): void {
    const gl = this.gl;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, `
      attribute vec2 a_position;
      uniform mat4 u_mvp;
      void main() {
        gl_Position = u_mvp * vec4(a_position, 0.0, 1.0);
      }
    `);
    gl.compileShader(vertexShader);
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, `
      precision mediump float;
      uniform vec4 u_color;
      void main() {
        gl_FragColor = u_color;
      }
    `);
    gl.compileShader(fragmentShader);
    
    this.shaderProgram = gl.createProgram()!;
    gl.attachShader(this.shaderProgram, vertexShader);
    gl.attachShader(this.shaderProgram, fragmentShader);
    gl.linkProgram(this.shaderProgram);
  }
  
  private createBuffers(): void {
    this.positionBuffer = this.gl.createBuffer();
  }
  
  /**
   * Render debug overlays
   * Call this AFTER rendering game objects
   */
  render(mvp: spine.Matrix4): void {
    if (!this._enabled || !this.shaderProgram) return;
    
    const gl = this.gl;
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    gl.useProgram(this.shaderProgram);
    
    const mvpLocation = gl.getUniformLocation(this.shaderProgram, 'u_mvp');
    const colorLocation = gl.getUniformLocation(this.shaderProgram, 'u_color');
    const positionLocation = gl.getAttribLocation(this.shaderProgram, 'a_position');
    
    gl.uniformMatrix4fv(mvpLocation, false, mvp.values);
    
    // Draw boundaries
    if (this.config.showBoundaries) {
      this.drawBoundaries(positionLocation, colorLocation);
    }
    
    // Draw player hitboxes
    if (this.player1) {
      this.drawFighterDebug(this.player1, positionLocation, colorLocation, 1);
    }
    if (this.player2) {
      this.drawFighterDebug(this.player2, positionLocation, colorLocation, 2);
    }
    
    gl.disableVertexAttribArray(positionLocation);
  }
  
  private drawFighterDebug(fighter: FighterController, positionLocation: number, colorLocation: WebGLUniformLocation | null, playerNum: 1 | 2): void {
    const gl = this.gl;
    const pos = fighter.getPosition();
    const facingRight = fighter.isFacingRight();
    
    // Draw position marker
    if (this.config.showPositions) {
      const markerColor = playerNum === 1 ? [0, 0, 1, 1] : [1, 0.5, 0, 1]; // Blue / Orange
      this.drawCross(pos.x, pos.y, 20, positionLocation, colorLocation, markerColor);
    }
    
    // Draw dynamic hurtboxes (head and body) based on skeleton bones
    if (this.config.showHurtboxes) {
      const hurtboxes = fighter.getHurtboxPositions();
      
      // Head hurtbox (circle approximated as box) - Yellow/Orange for head
      if (hurtboxes.head) {
        const headColor = [1, 0.8, 0, 0.4]; // Orange-yellow for head
        const headBox = {
          x: hurtboxes.head.x - hurtboxes.head.radius,
          y: hurtboxes.head.y - hurtboxes.head.radius,
          width: hurtboxes.head.radius * 2,
          height: hurtboxes.head.radius * 2
        };
        this.drawBox(headBox.x, headBox.y, headBox.width, headBox.height,
                     positionLocation, colorLocation, headColor);
        // Mark head center
        this.drawCross(hurtboxes.head.x, hurtboxes.head.y, 8, positionLocation, colorLocation, [1, 0.5, 0, 1]);
      }
      
      // Body hurtbox - Green
      if (hurtboxes.body) {
        const bodyBox = {
          x: hurtboxes.body.x - hurtboxes.body.width / 2,
          y: hurtboxes.body.y - hurtboxes.body.height / 2,
          width: hurtboxes.body.width,
          height: hurtboxes.body.height
        };
        this.drawBox(bodyBox.x, bodyBox.y, bodyBox.width, bodyBox.height,
                     positionLocation, colorLocation, this.config.hurtboxColor);
      }
    }
    
    // Draw hitbox (only when attacking) - using HitboxProvider
    if (this.config.showHitboxes && fighter.getState() === FighterState.Attack) {
      const hitbox = fighter.getActiveHitbox();
      
      if (hitbox) {
        if (hitbox.type === 'point') {
          // Point hitbox - draw circle
          const radius = hitbox.radius;
          this.drawBox(
            hitbox.position.x - radius,
            hitbox.position.y - radius,
            radius * 2,
            radius * 2,
            positionLocation, colorLocation, this.config.hitboxColor
          );
          this.drawCross(hitbox.position.x, hitbox.position.y, 15, positionLocation, colorLocation, [1, 1, 0, 1]);
        } else {
          // Line hitbox - draw thick line (weapon)
          this.drawLine(
            hitbox.line.start.x, hitbox.line.start.y,
            hitbox.line.end.x, hitbox.line.end.y,
            positionLocation, colorLocation, this.config.hitboxColor
          );
          this.drawCross(hitbox.line.end.x, hitbox.line.end.y, 15, positionLocation, colorLocation, [1, 1, 0, 1]);
        }
      }
    }
    
    // Always draw weapon line when available (sword loadout)
    if (this.config.showHitboxes) {
      const bones = fighter.getAttackBonePositions();
      const weaponColor = [1, 0.5, 0, 1]; // Orange for weapon
      
      if (bones.weapon) {
        this.drawCross(bones.weapon.x, bones.weapon.y, 15, positionLocation, colorLocation, weaponColor);
      }
      
      // Draw weapon line (full blade)
      if (bones.weaponLine) {
        this.drawLine(bones.weaponLine.start.x, bones.weaponLine.start.y,
                      bones.weaponLine.end.x, bones.weaponLine.end.y,
                      positionLocation, colorLocation, weaponColor);
      }
    }
    
    // Draw jump kick hitbox (active during entire jump)
    if (this.config.showHitboxes && fighter.getState() === FighterState.Jump) {
      const bones = fighter.getAttackBonePositions();
      const kickColor = [1, 0, 1, 0.7]; // Purple for jump kick - always active
      const footRadius = 120; // Large hitbox for backflip kick (matches JUMP_STOMP_FOOT_RADIUS)
      
      // Draw feet positions (always during jump)
      if (bones.rightFoot) {
        this.drawBox(
          bones.rightFoot.x - footRadius,
          bones.rightFoot.y - footRadius,
          footRadius * 2,
          footRadius * 2,
          positionLocation, colorLocation, kickColor
        );
        this.drawCross(bones.rightFoot.x, bones.rightFoot.y, 15, positionLocation, colorLocation, [1, 0, 1, 1]);
      }
      
      if (bones.leftFoot) {
        this.drawBox(
          bones.leftFoot.x - footRadius,
          bones.leftFoot.y - footRadius,
          footRadius * 2,
          footRadius * 2,
          positionLocation, colorLocation, kickColor
        );
        this.drawCross(bones.leftFoot.x, bones.leftFoot.y, 15, positionLocation, colorLocation, [1, 0, 1, 1]);
      }
    }
  }
  
  private drawLine(x1: number, y1: number, x2: number, y2: number,
                   positionLocation: number, colorLocation: WebGLUniformLocation | null, color: number[]): void {
    const gl = this.gl;
    
    const vertices = new Float32Array([x1, y1, x2, y2]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    gl.uniform4fv(colorLocation, color);
    gl.drawArrays(gl.LINES, 0, 2);
  }
  
  private drawBox(x: number, y: number, width: number, height: number, 
                  positionLocation: number, colorLocation: WebGLUniformLocation | null, color: number[]): void {
    const gl = this.gl;
    
    // Create quad vertices for filled box
    const vertices = new Float32Array([
      x, y + height,
      x + width, y + height,
      x, y,
      x + width, y,
    ]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    gl.uniform4fv(colorLocation, color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    // Draw outline
    const outlineVertices = new Float32Array([
      x, y,
      x + width, y,
      x + width, y + height,
      x, y + height,
      x, y,
    ]);
    
    gl.bufferData(gl.ARRAY_BUFFER, outlineVertices, gl.DYNAMIC_DRAW);
    gl.uniform4fv(colorLocation, [color[0], color[1], color[2], 1]); // Full opacity for outline
    gl.drawArrays(gl.LINE_STRIP, 0, 5);
  }
  
  private drawCross(x: number, y: number, size: number, 
                    positionLocation: number, colorLocation: WebGLUniformLocation | null, color: number[]): void {
    const gl = this.gl;
    
    const vertices = new Float32Array([
      x - size, y,
      x + size, y,
      x, y - size,
      x, y + size,
    ]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    gl.uniform4fv(colorLocation, color);
    gl.drawArrays(gl.LINES, 0, 4);
  }
  
  private drawBoundaries(positionLocation: number, colorLocation: WebGLUniformLocation | null): void {
    const gl = this.gl;
    
    // Draw left boundary
    this.drawVerticalLine(this.minX, 0, 1080, positionLocation, colorLocation, this.config.boundaryColor);
    
    // Draw right boundary
    this.drawVerticalLine(this.maxX, 0, 1080, positionLocation, colorLocation, this.config.boundaryColor);
    
    // Draw ground line
    this.drawHorizontalLine(0, 150, 1920, positionLocation, colorLocation, [1, 1, 1, 0.2]);
  }
  
  private drawVerticalLine(x: number, y1: number, y2: number,
                           positionLocation: number, colorLocation: WebGLUniformLocation | null, color: number[]): void {
    const gl = this.gl;
    
    const vertices = new Float32Array([x, y1, x, y2]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    gl.uniform4fv(colorLocation, color);
    gl.lineWidth(2);
    gl.drawArrays(gl.LINES, 0, 2);
  }
  
  private drawHorizontalLine(x1: number, y: number, x2: number,
                             positionLocation: number, colorLocation: WebGLUniformLocation | null, color: number[]): void {
    const gl = this.gl;
    
    const vertices = new Float32Array([x1, y, x2, y]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    gl.uniform4fv(colorLocation, color);
    gl.drawArrays(gl.LINES, 0, 2);
  }
  
  dispose(): void {
    const gl = this.gl;
    
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.shaderProgram) gl.deleteProgram(this.shaderProgram);
  }
}
