import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ControlsInfoComponent } from '../../../../shared/components/controls-info/controls-info.component';

@Component({
  selector: 'app-level-intro',
  standalone: true,
  imports: [ControlsInfoComponent],
  template: `
    <div class="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden">
      <!-- Matrix rain background -->
      <div class="absolute inset-0 overflow-hidden opacity-20">
        @for (col of matrixColumns; track col.id) {
          <div 
            class="absolute top-0 text-green-500 font-mono text-sm whitespace-pre animate-matrix-fall"
            [style.left.px]="col.x"
            [style.animation-duration.s]="col.speed"
            [style.animation-delay.s]="col.delay">
            {{ col.chars }}
          </div>
        }
      </div>
      
      <!-- Content -->
      <div class="relative z-10 text-center px-8 max-w-2xl">
        <!-- Level number -->
        <div 
          class="text-6xl font-bold text-white/30 mb-4 tracking-widest"
          [class.animate-fade-in]="showLevel">
          LEVEL {{ level }}
        </div>
        
        <!-- Title with typewriter effect -->
        <h1 
          class="text-5xl md:text-6xl font-game text-white mb-6 tracking-wider"
          [class.animate-glow-pulse]="showTitle">
          {{ displayedTitle }}
          <span class="animate-blink" [class.opacity-0]="titleComplete">|</span>
        </h1>
        
        <!-- Description -->
        <p 
          class="text-xl text-white/70 mb-12 leading-relaxed"
          [class.opacity-0]="!showDescription"
          [class.animate-fade-in-up]="showDescription">
          {{ description }}
        </p>
        
        <!-- Fight button -->
        @if (showButton) {
          <button 
            (click)="onStart()"
            class="px-12 py-4 text-2xl font-game text-black bg-white rounded-lg 
                   hover:bg-neon-green hover:scale-105 transition-all duration-300
                   animate-fade-in-up shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            KÄMPFEN
          </button>
          
          <!-- Controls Toggle -->
          <div class="mt-6 animate-fade-in-up" style="animation-delay: 0.2s;">
            <button 
              (click)="toggleControls($event)"
              class="text-white/50 hover:text-white/80 transition-colors text-sm flex items-center gap-2 mx-auto">
              <span class="transition-transform duration-200" [class.rotate-90]="showControls">▶</span>
              Steuerung anzeigen
            </button>
            
            <!-- Collapsible Controls -->
            <div 
              class="overflow-hidden transition-all duration-300 ease-out"
              [style.max-height]="showControls ? '300px' : '0px'"
              [style.opacity]="showControls ? '1' : '0'"
              [style.margin-top]="showControls ? '1rem' : '0'">
              <div class="max-w-xl mx-auto">
                <app-controls-info [compact]="true"></app-controls-info>
              </div>
            </div>
          </div>
        }
      </div>
      
      <!-- Corner decorations -->
      <div class="absolute top-8 left-8 w-20 h-20 border-l-2 border-t-2 border-white/20"></div>
      <div class="absolute top-8 right-8 w-20 h-20 border-r-2 border-t-2 border-white/20"></div>
      <div class="absolute bottom-8 left-8 w-20 h-20 border-l-2 border-b-2 border-white/20"></div>
      <div class="absolute bottom-8 right-8 w-20 h-20 border-r-2 border-b-2 border-white/20"></div>
    </div>
  `,
  styles: [`
    @keyframes matrix-fall {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }
    
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes fade-in-up {
      from { 
        opacity: 0; 
        transform: translateY(20px); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0); 
      }
    }
    
    @keyframes glow-pulse {
      0%, 100% { text-shadow: 0 0 20px rgba(255,255,255,0.5); }
      50% { text-shadow: 0 0 40px rgba(255,255,255,0.8), 0 0 60px rgba(255,255,255,0.4); }
    }
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
    
    .animate-matrix-fall {
      animation: matrix-fall linear infinite;
    }
    
    .animate-fade-in {
      animation: fade-in 0.5s ease-out forwards;
    }
    
    .animate-fade-in-up {
      animation: fade-in-up 0.6s ease-out forwards;
    }
    
    .animate-glow-pulse {
      animation: glow-pulse 2s ease-in-out infinite;
    }
    
    .animate-blink {
      animation: blink 1s step-end infinite;
    }
  `]
})
export class LevelIntroComponent implements OnInit, OnDestroy {
  @Input() level = 1;
  @Input() title = '';
  @Input() description = '';
  @Output() start = new EventEmitter<void>();
  
  // Listen for spacebar to start fight
  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.code === 'Space' && this.showButton) {
      event.preventDefault();
      this.onStart();
    }
  }
  
  // Animation state
  showLevel = false;
  showTitle = false;
  showDescription = false;
  showButton = false;
  showControls = false;
  displayedTitle = '';
  titleComplete = false;
  
  // Matrix rain
  matrixColumns: { id: number; x: number; speed: number; delay: number; chars: string }[] = [];
  
  private typewriterInterval: ReturnType<typeof setInterval> | null = null;
  private animationTimeouts: ReturnType<typeof setTimeout>[] = [];
  
  ngOnInit(): void {
    this.generateMatrixRain();
    this.startAnimationSequence();
  }
  
  ngOnDestroy(): void {
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
    }
    this.animationTimeouts.forEach(t => clearTimeout(t));
  }
  
  private generateMatrixRain(): void {
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';
    const columnCount = Math.floor(window.innerWidth / 20);
    
    for (let i = 0; i < columnCount; i++) {
      const charCount = Math.floor(Math.random() * 20) + 10;
      let columnChars = '';
      for (let j = 0; j < charCount; j++) {
        columnChars += chars[Math.floor(Math.random() * chars.length)] + '\n';
      }
      
      this.matrixColumns.push({
        id: i,
        x: i * 20,
        speed: Math.random() * 10 + 5,
        delay: Math.random() * 5,
        chars: columnChars,
      });
    }
  }
  
  private startAnimationSequence(): void {
    // Show level number
    this.animationTimeouts.push(setTimeout(() => {
      this.showLevel = true;
    }, 200));
    
    // Start typewriter for title
    this.animationTimeouts.push(setTimeout(() => {
      this.showTitle = true;
      this.startTypewriter();
    }, 600));
    
    // Show description after title completes
    const titleDuration = this.title.length * 50 + 500;
    this.animationTimeouts.push(setTimeout(() => {
      this.showDescription = true;
    }, 600 + titleDuration));
    
    // Show button
    this.animationTimeouts.push(setTimeout(() => {
      this.showButton = true;
    }, 600 + titleDuration + 400));
  }
  
  private startTypewriter(): void {
    let index = 0;
    this.typewriterInterval = setInterval(() => {
      if (index < this.title.length) {
        this.displayedTitle = this.title.substring(0, index + 1);
        index++;
      } else {
        this.titleComplete = true;
        if (this.typewriterInterval) {
          clearInterval(this.typewriterInterval);
        }
      }
    }, 50);
  }
  
  onStart(): void {
    this.start.emit();
  }
  
  toggleControls(event: Event): void {
    event.stopPropagation();
    this.showControls = !this.showControls;
  }
}
