import {
  Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(...registerables, ChartDataLabels);

// Aceita os dois formatos de resposta para evitar quebra do front:
type PublicStatsResponse = {
  usuarios?: { motoristas: number; passageiros: number };
  mediaAval?: number; // 0..5
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

  // NOVO: valor exibido no centro do gráfico
  motoristasPercent = '0';

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
      const totals = stats.usuarios ?? stats.totais;
      if (totals) {
        this.usuariosCounts = {
          motoristas: totals.motoristas ?? 0,
          passageiros: totals.passageiros ?? 0,
        };
      }

      this.avg = stats.mediaAval ?? stats.satisfacaoMedia ?? 0;
      if (typeof this.avg !== 'number' || isNaN(this.avg)) this.avg = 0;
      this.avg = Math.max(0, Math.min(5, this.avg));
    }
  }

  // ===================== CHART RENDER =====================
  private renderCharts() {
    // destrói antigos (hot reload / navegação)
    this.usuariosChart?.destroy();
    this.mediaChart?.destroy();

    // total e % para o label central do doughnut
    const total =
      Math.max(
        1,
        (this.usuariosCounts.motoristas || 0) +
        (this.usuariosCounts.passageiros || 0)
      );

    this.motoristasPercent = (
      (this.usuariosCounts.motoristas / total) * 100
    ).toFixed(0);

    // ===== 1) Doughnut Motoristas x Passageiros (com % no gráfico) =====
    this.usuariosChart = new Chart(this.usuariosChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Motoristas', 'Passageiros'],
        datasets: [
          {
            data: [this.usuariosCounts.motoristas, this.usuariosCounts.passageiros],
            backgroundColor: ['#2b8cff', '#ff6384'],
            hoverOffset: 6,
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,               // tamanhos iguais
        cutout: '62%',                // melhora leitura do rótulo
        plugins: {
          legend: { position: 'bottom' },
          datalabels: {
            color: '#fff',
            font: { weight: 'bold', size: 14 },
            formatter: (value: number) => {
              const p = (value / total) * 100;
              return `${p.toFixed(0)}%`;
            }
          },
          tooltip: { enabled: true }
        }
      } as ChartConfiguration<'doughnut'>['options']
    });

    // ===== 2) Gauge da média (meia-lua) com nota no centro =====
    const centerText = {
      id: 'centerText',
      afterDraw: (chart: any) => {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const txt = `${this.avg.toFixed(1)} / 5`;
        ctx.save();
        ctx.font = '600 18px system-ui, -apple-system, Segoe UI, Roboto, Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, (chartArea.left + chartArea.right) / 2, chartArea.bottom - 10);
        ctx.restore();
      }
    };

    const filled = this.avg;
    const remain = Math.max(0, 5 - filled);

    this.mediaChart = new Chart(this.mediaChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Média', ''],
        datasets: [{
          data: [filled, remain],
          backgroundColor: ['#2b8cff', '#ff9db0'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,        // tamanhos iguais
        circumference: 180,    // meia-lua
        rotation: -90,         // começa à esquerda
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }, // sem hover; valor já aparece no centro
          datalabels: { display: false }
        }
      } as ChartConfiguration<'doughnut'>['options'],
      plugins: [centerText]
    });
  }
}
