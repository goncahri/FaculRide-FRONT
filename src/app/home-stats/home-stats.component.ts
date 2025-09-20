import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

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

  ngOnInit(): void {
    // nada aqui — carregamos os dados em ngAfterViewInit para garantir os canvases
  }

  ngAfterViewInit(): void {
    this.load().catch(err => {
      console.error(err);
      this.errorMsg = 'Erro ao carregar estatísticas';
    }).finally(() => {
      this.loading = false;
      this.renderCharts();
    });
  }

  ngOnDestroy(): void {
    this.usuariosChart?.destroy();
    this.viagensChart?.destroy();
    this.mediaChart?.destroy();
  }

  // ===================== DATA FETCH =====================
  private getAuthHeaders(): HttpHeaders | undefined {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    // Não colocamos Content-Type aqui — Chart não precisa.
  }

  private async load() {
    const [uc, vw, avg] = await Promise.all([
      this.fetchUsuariosCounts(),
      this.fetchViagensByWeekday(),
      this.fetchAvgRating()
    ]);
    this.usuariosCounts = uc;
    this.viagensWeek = vw;
    this.avg = avg;
  }

  private async fetchUsuariosCounts(): Promise<{ motoristas: number; passageiros: number }> {
    const headers = this.getAuthHeaders();
    if (headers) {
      const usuarios = await this.http.get<any[]>(`${this.baseURL}/usuario`, { headers }).toPromise();
      let m = 0, p = 0;
      (usuarios || []).forEach(u => {
        const t = (u.tipoUsuario || '').toString().toLowerCase();
        if (t === 'motorista') m++;
        else if (t === 'passageiro') p++;
      });
      return { motoristas: m, passageiros: p };
    } else {
      const viagens = await this.http.get<any[]>(`${this.baseURL}/viagem`).toPromise();
      let m = 0, p = 0;
      (viagens || []).forEach(v => {
        const t = (v.tipoUsuario || '').toString().toLowerCase();
        if (t.includes('motor')) m++;
        else if (t.includes('passag')) p++;
      });
      return { motoristas: m, passageiros: p };
    }
  }

  private async fetchViagensByWeekday(): Promise<number[]> {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // seg..dom
    try {
      const viagens = await this.http.get<any[]>(`${this.baseURL}/viagem`).toPromise();
      (viagens || []).forEach(v => {
        const raw = v.createdAt || v.data || v.dataViagem || v.dataCadastro;
        const d = raw ? new Date(raw) : null;
        if (d && !isNaN(d.getTime())) {
          const wd = d.getDay();            // 0 dom .. 6 sáb
          const idx = wd === 0 ? 6 : wd - 1; // 0 seg .. 6 dom
          counts[idx] += 1;
        }
      });
    } catch {}

    // fallback: log de acesso
    if (counts.every(n => n === 0)) {
      try {
        const logs = await this.http.get<any[]>(`${this.baseURL}/logacesso`).toPromise();
        (logs || []).forEach(l => {
          const d = l.dataAcesso ? new Date(l.dataAcesso) : null;
          if (d && !isNaN(d.getTime())) {
            const wd = d.getDay();
            const idx = wd === 0 ? 6 : wd - 1;
            counts[idx] += 1;
          }
        });
      } catch {}
    }
    return counts;
  }

  private async fetchAvgRating(): Promise<number> {
    try {
      const avs = await this.http.get<any[]>(`${this.baseURL}/avaliacao`).toPromise();
      const stars = (avs || []).map(a => Number(a.Estrelas)).filter(n => !isNaN(n));
      if (!stars.length) return 0;
      const sum = stars.reduce((acc, n) => acc + n, 0);
      return Math.round((sum / stars.length) * 10) / 10;
    } catch {
      return 0;
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
