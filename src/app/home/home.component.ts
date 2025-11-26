import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { HomeStatsComponent } from '../home-stats/home-stats.component';
import { ApoioComponent } from '../apoio/apoio.component'; 

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    RouterOutlet,
    HomeStatsComponent,
    ApoioComponent 
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {}





