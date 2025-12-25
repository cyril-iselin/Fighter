// ============================================
// Story Intro Component - Level Entry Screen
// ============================================

import { Component, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CampaignLevel } from './campaign-levels';

@Component({
  selector: 'app-story-intro',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './story-intro.component.html',
  styleUrl: './story-intro.component.css'
})
export class StoryIntroComponent implements OnInit, OnDestroy {
  level = input.required<CampaignLevel>();
  continue = output<void>();
  
  showLevel = signal(false);
  showTitle = signal(false);
  showContinue = signal(false);
  displayedText = signal('');
  isTyping = signal(false);
  
  private typewriterTimeout: ReturnType<typeof setTimeout> | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  
  ngOnInit(): void {
    this.startSequence();
    
    // Add keyboard listener for skip and continue
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        // If continue button is shown, emit continue. Otherwise skip animation.
        if (this.showContinue()) {
          this.continue.emit();
        } else {
          this.skipToEnd();
        }
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }
  
  ngOnDestroy(): void {
    if (this.typewriterTimeout) {
      clearTimeout(this.typewriterTimeout);
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
  }
  
  private async startSequence(): Promise<void> {
    // Wait a moment, then show level
    await this.delay(300);
    this.showLevel.set(true);
    
    // Show title
    await this.delay(600);
    this.showTitle.set(true);
    
    // Start typewriter for story text
    await this.delay(800);
    await this.typewriterEffect(this.level().storyText);
    
    // Show continue button
    await this.delay(300);
    this.showContinue.set(true);
  }
  
  private typewriterEffect(text: string): Promise<void> {
    return new Promise(resolve => {
      this.isTyping.set(true);
      let index = 0;
      
      const type = () => {
        if (index <= text.length) {
          this.displayedText.set(text.slice(0, index));
          index++;
          this.typewriterTimeout = setTimeout(type, 40 + Math.random() * 30);
        } else {
          this.isTyping.set(false);
          resolve();
        }
      };
      
      type();
    });
  }
  
  private skipToEnd(): void {
    // Clear any pending animations
    if (this.typewriterTimeout) {
      clearTimeout(this.typewriterTimeout);
      this.typewriterTimeout = null;
    }
    
    // Show everything immediately
    this.showLevel.set(true);
    this.showTitle.set(true);
    this.displayedText.set(this.level().storyText);
    this.isTyping.set(false);
    this.showContinue.set(true);
  }
  
  onContinue(): void {
    this.continue.emit();
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.typewriterTimeout = setTimeout(resolve, ms);
    });
  }
}
