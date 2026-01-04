import { Component, Input, HostBinding } from '@angular/core';

@Component({
  selector: 'app-controls-info',
  standalone: true,
  imports: [],
  templateUrl: './controls-info.component.html',
  styleUrl: './controls-info.component.css'
})
export class ControlsInfoComponent {
  @Input() compact = false;
  
  @HostBinding('class.compact') 
  get isCompact() { return this.compact; }
}
