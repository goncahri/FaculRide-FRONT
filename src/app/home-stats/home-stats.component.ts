import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

type PublicStatsResponse = {
  usuarios: { motoristas: number; passageiros: number };
  viagensSemana: number[];   // [seg..dom]
  mediaAval: number;         // 0..5
};

@Component({
  selector: 'app-home-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home-stats.component.html',
  styleUrls: ['./home-stats.component.css']
})
export class HomeStatsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('usuariosChart') usuariosChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viagensChart')  viagensChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('mediaChart')    mediaChartRef!: ElementRef<HTMLCanvasElement>;

  baseURL =
    typeof window !== 'undefined' && window.location.hostname.includes('localhost')
      ? 'http://localhost:3000/api'
      : 'https://projeto-faculride.onrender.com/api';

  usuariosChart?: Chart;
  viagensChart?: Chart;
  mediaChart?: Chart;

  loading = true;
  errorMsg = '';
  avg = 0;

  private usuariosCounts = { motoristas: 0, passageiros: 0 };
  private viagensWeek = [0, 0, 0, 0, 0, 0, 0]; // seg..dom

  constructor(private http: HttpClient) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.load()
      .catch(err => {
        console.error(err);
        this.errorMsg = 'Erro ao carregar estatísticas';
      })
      .finally(() => {
        this.loading = false;
        this.renderCharts();
      });
  }

  ngOnDestroy(): void {
    this.usuariosChart?.destroy();
    this.viagensChart?.destroy();
    this.mediaChart?.destroy();
  }

  // ===================== DATA FETCH (público) =====================
  private async load() {
    const stats = await this.http
      .get<PublicStatsResponse>(`${this.baseURL}/public/stats`)
      .toPromise();

    if (stats) {
      this.usuariosCounts = stats.usuarios ?? this.usuariosCounts;
      this.viagensWeek    = (stats.viagensSemana ?? this.viagensWeek).slice(0, 7);
      this.avg            = stats.mediaAval ?? 0;
    }
  }

  // ===================== CHART RENDER =====================
  private renderCharts() {
    // destrói antigos (hot reload / navegação)
    this.usuariosChart?.destroy();
    this.viagensChart?.destroy();
    this.mediaChart?.destroy();

    // 1) Doughnut Motoristas x Passageiros
    this.usuariosChart = new Chart(this.usuariosChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Motoristas', 'Passageiros'],
        datasets: [{ data: [this.usuariosCounts.motoristas, this.usuariosCounts.passageiros] }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      } as ChartConfiguration<'doughnut'>['options']
    });

    // 2) Barras Viagens por dia da semana
    this.viagensChart = new Chart(this.viagensChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        datasets: [{ data: this.viagensWeek, label: 'Viagens' }]
      },
      options: {
        responsive: true,
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        },
        plugins: { legend: { display: false } }
      } as ChartConfiguration<'bar'>['options']
    });

    // 3) Gauge da média (meia-lua)
    const remain = Math.max(0, 5 - this.avg);
    this.mediaChart = new Chart(this.mediaChartRef.nativeElement, {
      type: 'doughnut',
      data: { labels: ['Média', ''], datasets: [{ data: [this.avg, remain] }] },
      options: {
        responsive: true,
        circumference: 180,
        rotation: -90,
        cutout: '70%',
        plugins: { legend: { display: false } }
      } as ChartConfiguration<'doughnut'>['options']
    });
  }
}
