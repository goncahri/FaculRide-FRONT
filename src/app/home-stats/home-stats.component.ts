import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

// Aceita os dois formatos de resposta para evitar quebra do front:
type PublicStatsResponse = {
  // formato antigo
  usuarios?: { motoristas: number; passageiros: number };
  mediaAval?: number; // 0..5

  // formato novo (sugerido)
  totais?: { motoristas: number; passageiros: number };
  satisfacaoMedia?: number; // 0..5
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
  @ViewChild('mediaChart')    mediaChartRef!: ElementRef<HTMLCanvasElement>;

  baseURL =
    typeof window !== 'undefined' && window.location.hostname.includes('localhost')
      ? 'http://localhost:3000/api'
      : 'https://projeto-faculride.onrender.com/api';

  usuariosChart?: Chart;
  mediaChart?: Chart;

  loading = true;
  errorMsg = '';
  avg = 0;

  private usuariosCounts = { motoristas: 0, passageiros: 0 };

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
    this.mediaChart?.destroy();
  }

  // ===================== DATA FETCH (público) =====================
  private async load() {
    const stats = await this.http
      .get<PublicStatsResponse>(`${this.baseURL}/public/stats`)
      .toPromise();

    if (stats) {
      // Suporta os dois formatos (usuarios ou totais)
      const totals = stats.usuarios ?? stats.totais;
      if (totals) {
        this.usuariosCounts = {
          motoristas: totals.motoristas ?? 0,
          passageiros: totals.passageiros ?? 0,
        };
      }

      // média 0..5 (mediaAval ou satisfacaoMedia)
      this.avg = stats.mediaAval ?? stats.satisfacaoMedia ?? 0;
      // saneamento: limita a faixa pra evitar render estranho no gauge
      if (typeof this.avg !== 'number' || isNaN(this.avg)) this.avg = 0;
      this.avg = Math.max(0, Math.min(5, this.avg));
    }
  }

  // ===================== CHART RENDER =====================
  private renderCharts() {
    // destrói antigos (hot reload / navegação)
    this.usuariosChart?.destroy();
    this.mediaChart?.destroy();

    // 1) Doughnut Motoristas x Passageiros
    this.usuariosChart = new Chart(this.usuariosChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Motoristas', 'Passageiros'],
        datasets: [
          {
            data: [this.usuariosCounts.motoristas, this.usuariosCounts.passageiros]
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      } as ChartConfiguration<'doughnut'>['options']
    });

    // 3) Gauge da média (meia-lua)
    const filled = this.avg;
    const remain = Math.max(0, 5 - filled);

    this.mediaChart = new Chart(this.mediaChartRef.nativeElement, {
      type: 'doughnut',
      data: { labels: ['Média', ''], datasets: [{ data: [filled, remain] }] },
      options: {
        responsive: true,
        circumference: 180,  // meia-lua
        rotation: -90,       // começa à esquerda
        cutout: '70%',
        plugins: { legend: { display: false } }
      } as ChartConfiguration<'doughnut'>['options']
    });
  }
}
