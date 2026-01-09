// ============================================================================
// DUMMY TEST COMPONENT
// ============================================================================
// Test environment for dummy characters and hitbox visualization
// Shows selected dummy with animation + stickman for hit testing
// ============================================================================

import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DummyRenderer, type DummyInstance, getAllDummies, type DummyDefinition } from '../../dummies';

@Component({
  selector: 'app-dummy-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dummy-test.component.html',
  styleUrl: './dummy-test.component.css'
})
export class DummyTestComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: false }) canvasRef!: ElementRef<HTMLDivElement>;
  
  // Renderers
  private dummyRenderer?: DummyRenderer;
  private animationFrameId?: number;
  private lastFrameTime = 0;
  
  // Active dummy
  private activeDummy?: DummyInstance;
  
  // State
  status = signal<'loading' | 'ready' | 'error'>('loading');
  showHitboxes = signal(true);
  selectedDummyId = signal<string>('donald');
  
  // Dummy list for selection
  availableDummies = signal<DummyDefinition[]>([]);
  
  // Computed
  selectedDummy = computed(() => {
    const id = this.selectedDummyId();
    return this.availableDummies().find((d: DummyDefinition) => d.id === id);
  });
  
  constructor(private router: Router) {}
  
  ngOnInit(): void {
    // Load available dummies
    this.availableDummies.set(getAllDummies());
  }
  
  async ngAfterViewInit(): Promise<void> {
    if (!this.canvasRef?.nativeElement) {
      console.error('[DummyTest] Canvas container not found');
      this.status.set('error');
      return;
    }
    
    try {
      await this.initializeRenderers();
      this.status.set('ready');
      this.startRenderLoop();
    } catch (error) {
      console.error('[DummyTest] Initialization failed:', error);
      this.status.set('error');
    }
  }
  
  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.dummyRenderer?.dispose();
  }
  
  // ============================================================================
  // Initialization
  // ============================================================================
  
  private async initializeRenderers(): Promise<void> {
    const container = this.canvasRef.nativeElement;
    
    // Create canvas for dummy rendering
    const dummyCanvas = document.createElement('canvas');
    dummyCanvas.id = 'dummy-canvas';
    const dpr = window.devicePixelRatio || 1;
    dummyCanvas.width = Math.floor(container.clientWidth * dpr);
    dummyCanvas.height = Math.floor(container.clientHeight * dpr);
    dummyCanvas.style.width = '100%';
    dummyCanvas.style.height = '100%';
    dummyCanvas.style.position = 'absolute';
    dummyCanvas.style.top = '0';
    dummyCanvas.style.left = '0';
    container.appendChild(dummyCanvas);
    
    // Initialize dummy renderer
    this.dummyRenderer = new DummyRenderer(dummyCanvas);
    
    // Load first dummy
    const firstDummy = this.availableDummies()[0];
    if (firstDummy) {
      await this.dummyRenderer.loadDummy(firstDummy.id);
      this.spawnDummy(firstDummy.id);
    }
  }
  
  // ============================================================================
  // Dummy Management
  // ============================================================================
  
  private spawnDummy(dummyId: string): void {
    if (!this.dummyRenderer) return;
    
    // Clear existing
    this.dummyRenderer.clearInstances();
    
    // Spawn at left side, moving right
    this.activeDummy = this.dummyRenderer.spawnDummy(dummyId, 0, 0, 1);
  }
  
  async selectDummy(dummyId: string): Promise<void> {
    if (!this.dummyRenderer) return;
    
    this.selectedDummyId.set(dummyId);
    
    // Load if not cached
    if (!this.dummyRenderer.isLoaded(dummyId)) {
      await this.dummyRenderer.loadDummy(dummyId);
    }
    
    this.spawnDummy(dummyId);
  }
  
  // ============================================================================
  // Render Loop
  // ============================================================================
  
  private startRenderLoop(): void {
    this.lastFrameTime = performance.now();
    
    const loop = (timestamp: number) => {
      const deltaTime = (timestamp - this.lastFrameTime) / 1000;
      this.lastFrameTime = timestamp;
      
      // Update dummies
      this.dummyRenderer?.update(deltaTime);
      this.dummyRenderer?.setShowHitboxes(this.showHitboxes());
      
      // Clear and render dummies
      const canvas = this.canvasRef?.nativeElement?.querySelector('#dummy-canvas') as HTMLCanvasElement;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      this.dummyRenderer?.render();
      
      this.animationFrameId = requestAnimationFrame(loop);
    };
    
    this.animationFrameId = requestAnimationFrame(loop);
  }
  
  // ============================================================================
  // UI Controls
  // ============================================================================
  
  toggleHitboxes(): void {
    this.showHitboxes.update((v: boolean) => !v);
  }
  
  goBack(): void {
    this.router.navigate(['/']);
  }
}
