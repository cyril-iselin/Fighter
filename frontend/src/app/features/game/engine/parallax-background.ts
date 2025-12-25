// ============================================
// Parallax Background System
// ============================================

import * as spine from '@esotericsoftware/spine-webgl';

// ============================================
// Parallax Layer Configuration
// ============================================

export interface ParallaxLayer {
  /** Path to the image file */
  imagePath: string;
  /** Parallax factor (0 = static, 1 = moves with camera) */
  factor: number;
  /** Vertical offset from bottom (in design pixels) */
  offsetY?: number;
  /** Optional scale override */
  scale?: number;
  /** Whether this layer should repeat horizontally for endless scrolling */
  repeat?: boolean;
}

export interface ParallaxConfig {
  /** Design width (reference) */
  designWidth: number;
  /** Design height (reference) */
  designHeight: number;
  /** Layers from back to front */
  layers: ParallaxLayer[];
}

// ============================================
// Preset Configurations
// ============================================

export const CITY1_PARALLAX: ParallaxConfig = {
  designWidth: 1920,
  designHeight: 1080,
  layers: [
    { imagePath: 'assets/background/City1/Sky.png', factor: 0.0, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City1/buildings.png', factor: 0.15, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City1/wall2.png', factor: 0.35, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City1/wall1.png', factor: 0.5, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City1/road&border.png', factor: 0.85, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City1/boxes&container.png', factor: 0.95, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City1/wheels&hydrant.png', factor: 0.9, offsetY: 0, repeat: true },
    
  ]
};

export const CITY2_PARALLAX: ParallaxConfig = {
  designWidth: 1920,
  designHeight: 1080,
  layers: [
    { imagePath: 'assets/background/City2/Sky.png', factor: 0.0, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City2/back.png', factor: 0.15, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City2/houses3.png', factor: 0.35, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City2/houses1.png', factor: 0.5, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City2/road&lamps.png', factor: 0.85, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City2/minishop&callbox.png', factor: 0.95, offsetY: 0 },
  ]
};

export const CITY3_PARALLAX: ParallaxConfig = {
  designWidth: 1920,
  designHeight: 1080,
  layers: [
    { imagePath: 'assets/background/City3/sky.png', factor: 0.0, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City3/houses3.png', factor: 0.15, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City3/houded2.png', factor: 0.3, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City3/houses1.png', factor: 0.5, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City3/road.png', factor: 0.85, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City3/crosswalk.png', factor: 0.95, offsetY: 0 },
  ]
};

export const CITY4_PARALLAX: ParallaxConfig = {
  designWidth: 1920,
  designHeight: 1080,
  layers: [
    { imagePath: 'assets/background/City4/Sky.png', factor: 0.0, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City4/houses2.png', factor: 0.15, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City4/houses1.png', factor: 0.3, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City4/houses.png', factor: 0.5, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City4/road.png', factor: 0.85, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City4/fountain&bush.png', factor: 0.9, offsetY: 0, repeat: true },
    { imagePath: 'assets/background/City4/umbrella&policebox.png', factor: 0.95, offsetY: 0 },
  ]
};

// ============================================
// Loaded Layer Data
// ============================================

interface LoadedLayer {
  config: ParallaxLayer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

// ============================================
// Parallax Background Manager
// ============================================

export class ParallaxBackground {
  private gl: WebGLRenderingContext;
  private config: ParallaxConfig;
  private layers: LoadedLayer[] = [];
  private isLoaded: boolean = false;
  
  // Shader for rendering textured quads
  private shaderProgram: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  
  // Camera position for parallax effect
  private cameraX: number = 0;
  
  constructor(gl: WebGLRenderingContext, config: ParallaxConfig) {
    this.gl = gl;
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    this.createShader();
    this.createBuffers();
    await this.loadTextures();
    this.isLoaded = true;
  }
  
  private createShader(): void {
    const gl = this.gl;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      uniform mat4 u_mvp;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = u_mvp * vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `);
    gl.compileShader(vertexShader);
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, `
      precision mediump float;
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;
      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
      }
    `);
    gl.compileShader(fragmentShader);
    
    this.shaderProgram = gl.createProgram()!;
    gl.attachShader(this.shaderProgram, vertexShader);
    gl.attachShader(this.shaderProgram, fragmentShader);
    gl.linkProgram(this.shaderProgram);
    
    if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
      console.error('[Parallax] Shader link failed:', gl.getProgramInfoLog(this.shaderProgram));
    }
  }
  
  private createBuffers(): void {
    const gl = this.gl;
    
    // Position buffer (will be updated per-layer)
    this.positionBuffer = gl.createBuffer();
    
    // Texture coordinate buffer (static quad)
    // Note: Image coordinates have Y=0 at top, WebGL has Y=0 at bottom
    // So we flip the Y coordinates: top of image (0) → bottom of quad, bottom of image (1) → top of quad
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,  // Top-left vertex → top-left of image (Y flipped)
      1, 0,  // Top-right vertex → top-right of image
      0, 1,  // Bottom-left vertex → bottom-left of image
      1, 1,  // Bottom-right vertex → bottom-right of image
    ]), gl.STATIC_DRAW);
  }
  
  private async loadTextures(): Promise<void> {
    const loadPromises = this.config.layers.map(async (layerConfig) => {
      try {
        const { texture, width, height } = await this.loadTexture(layerConfig.imagePath);
        return {
          config: layerConfig,
          texture,
          width,
          height
        };
      } catch (error) {
        console.warn(`[Parallax] Failed to load layer: ${layerConfig.imagePath}`, error);
        return null;
      }
    });
    
    const results = await Promise.all(loadPromises);
    this.layers = results.filter((r): r is LoadedLayer => r !== null);
  }
  
  private loadTexture(path: string): Promise<{ texture: WebGLTexture; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const gl = this.gl;
      const image = new Image();
      
      image.onload = () => {
        const texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Upload the image
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        
        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        resolve({ texture, width: image.width, height: image.height });
      };
      
      image.onerror = () => reject(new Error(`Failed to load image: ${path}`));
      image.src = path;
    });
  }
  
  /**
   * Set camera X position for parallax calculation
   * @param x Camera X position in world space
   */
  setCameraX(x: number): void {
    this.cameraX = x;
  }
  
  /**
   * Render all parallax layers
   * Call this BEFORE rendering game objects
   */
  render(mvp: spine.Matrix4, canvasWidth: number, canvasHeight: number, scale: number): void {
    if (!this.isLoaded || !this.shaderProgram) return;
    
    const gl = this.gl;
    
    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    gl.useProgram(this.shaderProgram);
    
    // Get uniform/attribute locations
    const mvpLocation = gl.getUniformLocation(this.shaderProgram, 'u_mvp');
    const textureLocation = gl.getUniformLocation(this.shaderProgram, 'u_texture');
    const positionLocation = gl.getAttribLocation(this.shaderProgram, 'a_position');
    const texCoordLocation = gl.getAttribLocation(this.shaderProgram, 'a_texCoord');
    
    // Set MVP matrix
    gl.uniformMatrix4fv(mvpLocation, false, mvp.values);
    
    // Set texture unit
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(textureLocation, 0);
    
    // Setup texture coordinates (same for all layers)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Render each layer from back to front
    for (const layer of this.layers) {
      this.renderLayer(layer, positionLocation, scale);
    }
    
    gl.disableVertexAttribArray(positionLocation);
    gl.disableVertexAttribArray(texCoordLocation);
  }
  
  private renderLayer(layer: LoadedLayer, positionLocation: number, scale: number): void {
    const gl = this.gl;
    
    // Calculate parallax offset
    // Center of the world is at designWidth/2
    const worldCenter = this.config.designWidth / 2;
    const parallaxOffset = (this.cameraX - worldCenter) * layer.config.factor;
    
    // Layer positioning in design coordinates
    // Images are 1920x1080, we want them to cover the full design space
    const layerScale = layer.config.scale ?? 1;
    const width = this.config.designWidth * layerScale;
    const height = this.config.designHeight * layerScale;
    
    // Check if this layer should repeat (endless scrolling)
    const shouldRepeat = layer.config.repeat ?? false;
    
    if (shouldRepeat) {
      // Draw multiple copies for endless scrolling
      // Calculate how many copies we need on each side
      const baseX = (this.config.designWidth - width) / 2 - parallaxOffset;
      
      // Wrap the offset to keep the tiles cycling
      const wrappedOffset = ((baseX % width) + width) % width;
      const startX = wrappedOffset - width;
      
      // Draw enough tiles to cover the viewport plus buffer
      const numTiles = Math.ceil(this.config.designWidth / width) + 2;
      
      for (let i = 0; i < numTiles; i++) {
        const tileX = startX + (i * width);
        const y = layer.config.offsetY ?? 0;
        
        this.drawQuad(layer, positionLocation, tileX, y, width, height);
      }
    } else {
      // Single layer (no repeat)
      const x = (this.config.designWidth - width) / 2 - parallaxOffset;
      const y = layer.config.offsetY ?? 0;
      
      this.drawQuad(layer, positionLocation, x, y, width, height);
    }
  }
  
  private drawQuad(layer: LoadedLayer, positionLocation: number, x: number, y: number, width: number, height: number): void {
    const gl = this.gl;
    
    // Create quad vertices (bottom-left origin, Y-up)
    const vertices = new Float32Array([
      x, y + height,          // Top-left
      x + width, y + height,  // Top-right
      x, y,                   // Bottom-left
      x + width, y,           // Bottom-right
    ]);
    
    // Update position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Bind texture and draw
    gl.bindTexture(gl.TEXTURE_2D, layer.texture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  
  dispose(): void {
    const gl = this.gl;
    
    // Delete textures
    for (const layer of this.layers) {
      gl.deleteTexture(layer.texture);
    }
    
    // Delete buffers
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);
    
    // Delete shader
    if (this.shaderProgram) gl.deleteProgram(this.shaderProgram);
    
    this.layers = [];
    this.isLoaded = false;
  }
}
