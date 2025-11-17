import { Component, ElementRef, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { isBrowser } from '../utils/is-browser';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.css']
})
export class MapaComponent implements AfterViewInit, OnInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  map!: google.maps.Map;
  directionsRenderer!: google.maps.DirectionsRenderer;

  // ===== marcadores no mapa =====
  markers: google.maps.Marker[] = [];
  infoWindow!: google.maps.InfoWindow;
  // ==============================

  // ===== Spinner/estado de carregamento =====
  carregando: boolean = true;
  private _loads = { usuarios: false, viagens: false, avaliacoes: false };
  private markLoaded(key: 'usuarios' | 'viagens' | 'avaliacoes') {
    this._loads[key] = true;
    if (this._loads.usuarios && this._loads.viagens && this._loads.avaliacoes) {
      this.carregando = false;
    }
  }
  // =========================================

  // Dados do formulário
  tipoCarona: string = 'oferecer';
  origem: string = '';
  destino: string = '';
  entradaFatec: string = '';
  saidaFatec: string = '';
  ajudaCusto: number | null = null;

  // ===== Calendário simples =====
  private hoje = new Date();
  private mesAtual = this.hoje.getMonth();       // 0 = janeiro
  private anoAtual = this.hoje.getFullYear();

  // limites do mês atual (usados no [min]/[max] do input)
  primeiroDiaMesISO: string = this.toISO(new Date(this.anoAtual, this.mesAtual, 1));
  ultimoDiaMesISO: string = this.toISO(new Date(this.anoAtual, this.mesAtual + 1, 0));

  dataRota: string = '';          // valor do input <input type="date">
  datasRota: string[] = [];       // lista de datas selecionadas (YYYY-MM-DD)
  datasConfirmadas: boolean = false;
  // ====================================================

  // Dados das viagens
  viagens: any[] = [];
  caronasOferecidas: any[] = [];
  caronasProcuradas: any[] = [];

  // Dados das avaliações
  mostrarAvaliacao: boolean = false;
  nomeUsuarioSelecionado: string = '';
  idUsuarioSelecionado: number | null = null;
  avaliacaoSelecionada: number = 0;
  comentarioAvaliacao: string = '';

  avaliacoesRecebidas: any[] = [];
  avaliacoesEnviadas: any[] = [];
  usuarios: any[] = [];

  // Configuração da API
  baseURL = isBrowser() && window.location.hostname.includes('localhost')
    ? 'http://localhost:3000/api'
    : 'https://projeto-faculride.onrender.com/api';

  usuarioLogado = isBrowser() ? JSON.parse(localStorage.getItem('usuarioLogado') || '{}') : {};
  // Normaliza para número (evita comparação string vs number)
  meuId = Number(this.usuarioLogado.idUsuario || this.usuarioLogado.id);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.carregando = true;
    this._loads = { usuarios: false, viagens: false, avaliacoes: false };

    this.carregarUsuarios();
    this.carregarViagens();
    this.carregarAvaliacoes();
  }

  ngAfterViewInit(): void {
    this.inicializarMapa();
  }

  inicializarMapa(): void {
    if (!isBrowser() || !this.mapContainer?.nativeElement) return;

    const mapOptions = {
      center: new google.maps.LatLng(-23.5015, -47.4526),
      zoom: 12,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    this.map = new google.maps.Map(this.mapContainer.nativeElement, mapOptions);
    this.directionsRenderer = new google.maps.DirectionsRenderer();
    this.directionsRenderer.setMap(this.map);

    this.infoWindow = new google.maps.InfoWindow();
    this.atualizarMarcadoresViagens(); // caso as viagens já tenham carregado
  }

  // Helper para obter tipo normalizado.
  public tipoNormalizado(v: any): 'motorista' | 'passageiro' {
    const fromViagem = (v?.usuario?.tipoUsuario ?? v?.tipoUsuario ?? '')
      .toString()
      .trim()
      .toLowerCase();

    if (fromViagem === 'motorista' || fromViagem === 'passageiro') {
      return fromViagem as 'motorista' | 'passageiro';
    }

    const uid = Number(v?.idUsuario);
    const u = this.usuarios.find(x => Number(x?.idUsuario ?? x?.id) === uid);

    const fromUsuario = (u?.tipoUsuario ?? u?.tipo_usuario ?? '')
      .toString()
      .trim()
      .toLowerCase();

    return fromUsuario === 'motorista' ? 'motorista' : 'passageiro';
  }

  // Normalização de usuários
  private normalizeUsuario(u: any) {
    const bruto = (u?.tipoUsuario ?? u?.tipo_usuario ?? u?.tipo ?? '')
      .toString()
      .toLowerCase()
      .trim();

    const tipoUsuario =
      bruto === 'motorista' || bruto === 'passageiro'
        ? bruto
        : (u?.tipoUsuario ?? u?.tipo_usuario ?? '').toString().toLowerCase();

    return {
      ...u,
      tipoUsuario
    };
  }

  // ====== NORMALIZA AS DATAS VINDAS DO BACK (inclusive viajem_agendada) ======
  private normalizarDatasViagem(v: any): string[] {
    const datas: string[] = [];

    // 1) se já vier direto na viagem
    if (Array.isArray(v?.diasAgendados)) {
      datas.push(...v.diasAgendados);
    }
    if (Array.isArray(v?.datasAgendadas)) {
      datas.push(...v.datasAgendadas);
    }
    if (Array.isArray(v?.datasRota)) {
      datas.push(...v.datasRota);
    }

    // 2) se vier da tabela viajem_agendada (associação)
    const ag1 = (v as any).viajem_agendada;
    const ag2 = (v as any).viajemAgendada;
    const ag3 = (v as any).agendamentos;

    const agendamentos: any[] | undefined =
      Array.isArray(ag1) ? ag1 :
      Array.isArray(ag2) ? ag2 :
      Array.isArray(ag3) ? ag3 :
      undefined;

    if (agendamentos) {
      agendamentos.forEach((a: any) => {
        if (a?.data) {
          // garantimos só a parte YYYY-MM-DD
          const d = a.data.toString().slice(0, 10);
          datas.push(d);
        }
      });
    }

    // remove duplicados
    return [...new Set(datas)];
  }

  carregarViagens(): void {
    this.http.get<any[]>(`${this.baseURL}/viagem`).subscribe({
      next: (res) => {
        // Normaliza TODAS as viagens para terem sempre v.diasAgendados como array
        this.viagens = (res || []).map(v => {
          const diasAgendados = this.normalizarDatasViagem(v);
          return { ...v, diasAgendados };
        });

        // === Minhas Caronas (oferecidas/procuradas) ===
        this.caronasOferecidas = this.viagens
          .filter(v => Number(v.idUsuario) === this.meuId && this.tipoNormalizado(v) === 'motorista')
          .map(v => ({
            partida: v.partida,
            destino: v.destino,
            entrada: v.horarioEntrada,
            saida: v.horarioSaida,
            ajuda: v.ajudaDeCusto,
            diasAgendados: v.diasAgendados
          }));

        this.caronasProcuradas = this.viagens
          .filter(v => Number(v.idUsuario) === this.meuId && this.tipoNormalizado(v) === 'passageiro')
          .map(v => ({
            partida: v.partida,
            destino: v.destino,
            entrada: v.horarioEntrada,
            saida: v.horarioSaida,
            ajuda: v.ajudaDeCusto,
            diasAgendados: v.diasAgendados
          }));

        this.atualizarMarcadoresViagens();
        this.markLoaded('viagens');
      },
      error: (err) => {
        console.error('Erro ao carregar viagens:', err);
        this.markLoaded('viagens');
      }
    });
  }

  carregarUsuarios(): void {
    this.http.get<any[]>(`${this.baseURL}/usuario`).subscribe({
      next: (res) => {
        this.usuarios = Array.isArray(res) ? res.map(u => this.normalizeUsuario(u)) : [];

        if (this.avaliacoesRecebidas?.length) {
          this.avaliacoesRecebidas = this.avaliacoesRecebidas.map((a: any) => ({
            ...a,
            nomeAvaliador: this.pegarNomeUsuario(a.ID_Avaliador),
          }));
        }

        if (this.avaliacoesEnviadas?.length) {
          this.avaliacoesEnviadas = this.avaliacoesEnviadas.map((a: any) => ({
            ...a,
            nomeAvaliado: this.pegarNomeUsuario(a.ID_Avaliado),
          }));
        }

        this.markLoaded('usuarios');
      },
      error: (err) => {
        console.error('Erro ao carregar usuários:', err);
        this.markLoaded('usuarios');
      },
    });
  }

  // =============== LÓGICA DO CALENDÁRIO SIMPLES (INPUT DATE) ===============

  private toISO(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  adicionarDataRota(): void {
    if (!this.dataRota) return;

    // mudou a seleção, precisa confirmar de novo
    this.datasConfirmadas = false;

    const dataStr = this.dataRota; // formato YYYY-MM-DD
    const data = new Date(dataStr + 'T00:00:00');

    if (isNaN(data.getTime())) {
      alert('Data inválida.');
      this.dataRota = '';
      return;
    }

    // trava só no mês atual (mesmo ano e mês)
    if (data.getFullYear() !== this.anoAtual || data.getMonth() !== this.mesAtual) {
      alert('Selecione apenas dias do mês atual.');
      this.dataRota = '';
      return;
    }

    // só datas futuras
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (data <= hoje) {
      alert('Escolha apenas datas futuras.');
      this.dataRota = '';
      return;
    }

    // libera sábado, bloqueia apenas domingo
    const diaSemana = data.getDay(); // 0 dom, 6 sáb
    if (diaSemana === 0) {
      alert('Domingo não é permitido.');
      this.dataRota = '';
      return;
    }

    // adiciona se ainda não tiver e ordena
    if (!this.datasRota.includes(dataStr)) {
      this.datasRota.push(dataStr);
      this.datasRota.sort(); // YYYY-MM-DD => já fica em ordem cronológica
    }

    // limpa o input
    this.dataRota = '';
  }

  removerDataRota(data: string): void {
    this.datasRota = this.datasRota.filter(d => d !== data);
    this.datasConfirmadas = false;
  }

  confirmarDatasRota(): void {
    if (!this.datasRota.length) {
      alert('Selecione pelo menos um dia antes de confirmar.');
      return;
    }
    this.datasConfirmadas = true;
  }

  formatarDataTag(d: string): string {
    if (!d || d.length < 10) return d;
    const [ano, mes, dia] = d.split('-');
    return `${dia}/${mes}`;
  }

  // ===================================================================

  tracarRota(): void {
    if (!this.origem || !this.destino || !this.entradaFatec || !this.saidaFatec) {
      alert('Preencha todos os campos.');
      return;
    }

    const datasSelecionadas = this.datasRota;
    if (!datasSelecionadas.length) {
      const continuar = confirm(
        'Você não selecionou nenhuma data.\n' +
        'Deseja cadastrar a rota mesmo assim?'
      );
      if (!continuar) return;
    }

    const dadosViagem: any = {
      tipoUsuario: this.tipoCarona === 'oferecer' ? 'motorista' : 'passageiro',
      partida: this.origem,
      destino: this.destino,
      horarioEntrada: this.entradaFatec,
      horarioSaida: this.saidaFatec,
      ajudaDeCusto: this.ajudaCusto ? this.ajudaCusto.toString() : '0',
      idUsuario: this.meuId,
      // ainda mando pro back, ele distribui para viajem_agendada
      datasAgendadas: datasSelecionadas
    };

    this.http.post(`${this.baseURL}/viagem`, dadosViagem).subscribe({
      next: () => {
        alert('Rota cadastrada com sucesso!');
        this.carregarViagens();
      },
      error: (err) => {
        console.error('Erro ao cadastrar viagem:', err);
        alert('Erro ao cadastrar rota.');
      }
    });

    if (isBrowser()) {
      const request: google.maps.DirectionsRequest = {
        origin: this.origem,
        destination: this.destino,
        travelMode: google.maps.TravelMode.DRIVING
      };
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(request, (result, status) => {
        if (status === 'OK' && result) this.directionsRenderer.setDirections(result);
      });
    }
  }

  mostrarRota(partida: string, destino: string): void {
    if (isBrowser()) {
      const directionsService = new google.maps.DirectionsService();
      const request: google.maps.DirectionsRequest = {
        origin: partida,
        destination: destino,
        travelMode: google.maps.TravelMode.DRIVING
      };
      directionsService.route(request, (result, status) => {
        if (status === 'OK' && result) this.directionsRenderer.setDirections(result);
      });
      setTimeout(
        () => this.mapContainer.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        100
      );
    }
  }

  abrirWhatsapp(nome: string, idUsuario: number, numeroWhatsapp: string) {
    if (!numeroWhatsapp) return alert('Número de WhatsApp não disponível');
    if (isBrowser()) window.open(`https://wa.me/${numeroWhatsapp}`, '_blank');
    setTimeout(() => {
      if (confirm(`A carona com ${nome} foi realizada? Deseja avaliar?`)) {
        this.nomeUsuarioSelecionado = nome;
        this.idUsuarioSelecionado = idUsuario;
        this.mostrarAvaliacao = true;
      }
    }, 1000);
  }

  enviarAvaliacao() {
    if (!this.avaliacaoSelecionada) return alert('Por favor, selecione uma nota.');
    const avaliacao = {
      ID_Avaliador: this.meuId,
      ID_Avaliado: this.idUsuarioSelecionado,
      Comentario: this.comentarioAvaliacao,
      Estrelas: this.avaliacaoSelecionada
    };
    this.http.post(`${this.baseURL}/avaliacao`, avaliacao).subscribe({
      next: () => {
        alert(`✅ Avaliação enviada! Você avaliou ${this.nomeUsuarioSelecionado} com ${this.avaliacaoSelecionada} ⭐`);
        this.mostrarAvaliacao = false;
        this.avaliacaoSelecionada = 0;
        this.comentarioAvaliacao = '';
        this.carregarAvaliacoes();
      },
      error: (err) => {
        console.error(err);
        alert('Erro ao enviar avaliação.');
      }
    });
  }

  carregarAvaliacoes(): void {
    this.http.get<any[]>(`${this.baseURL}/avaliacao`).subscribe({
      next: (res) => {
        this.avaliacoesRecebidas = res
          .filter(a => a.ID_Avaliado === this.meuId)
          .map(a => ({ ...a, nomeAvaliador: this.pegarNomeUsuario(a.ID_Avaliador) }));
        this.avaliacoesEnviadas = res
          .filter(a => a.ID_Avaliador === this.meuId)
          .map(a => ({ ...a, nomeAvaliado: this.pegarNomeUsuario(a.ID_Avaliado) }));

        this.markLoaded('avaliacoes');
      },
      error: (err) => {
        console.error('Erro ao carregar avaliações:', err);
        this.markLoaded('avaliacoes');
      }
    });
  }

  pegarNomeUsuario(id: number): string {
    const usuario = this.usuarios.find(u => u.id === id || u.idUsuario === id);
    return usuario ? usuario.nome : 'Usuário';
  }

  obterFotoUsuario(email: string, genero: any): string {
    const u = this.usuarios.find(x => x?.email?.trim().toLowerCase() === (email || '').trim().toLowerCase());
    const url = u?.foto || u?.fotoUrl;
    if (url) return url;
    if (genero === true) return 'assets/profile_man.jpeg';
    if (genero === false) return 'assets/profile_woman.jpeg';
    return 'assets/usuario.png';
  }

  excluirCarona(idViagem: number) {
    if (!confirm('Tem certeza que deseja excluir esta carona?')) return;
    this.http.delete(`${this.baseURL}/viagem/${idViagem}`).subscribe({
      next: () => {
        alert('Carona excluída com sucesso!');
        this.carregarViagens();
      },
      error: (err) => {
        console.error('Erro ao excluir carona:', err);
        alert('Erro ao excluir carona. Tente novamente.');
      }
    });
  }

  // ========= Exibir dias da rota no card (usado no HTML) =========
  formatDiasViagem(v: any): string {
    if (Array.isArray(v?.diasAgendados) && v.diasAgendados.length) {
      return v.diasAgendados.map((d: string) => this.formatarDataTag(d)).join(', ');
    }

    if (Array.isArray(v?.datasAgendadas) && v.datasAgendadas.length) {
      return v.datasAgendadas.map((d: string) => this.formatarDataTag(d)).join(', ');
    }

    if (Array.isArray(v?.datasRota) && v.datasRota.length) {
      return v.datasRota.map((d: string) => this.formatarDataTag(d)).join(', ');
    }

    if (typeof v?.dias === 'string' && v.dias.trim().length) {
      return v.dias;
    }

    return '';
  }

  // ===================== Marcadores de viagens no mapa =====================

  private atualizarMarcadoresViagens(): void {
    if (!isBrowser()) return;
    if (!this.map) return;
    if (!this.viagens || !this.viagens.length) return;

    this.markers.forEach(m => m.setMap(null));
    this.markers = [];

    const geocoder = new google.maps.Geocoder();

    this.viagens.forEach((v) => {
      const partida = v.partida;
      const destino = v.destino;

      if (!partida) return;

      geocoder.geocode({ address: partida }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const pos = results[0].geometry.location;
          const nome = this.pegarNomeUsuario(Number(v.idUsuario));
          const tipo = this.tipoNormalizado(v);

          const marker = new google.maps.Marker({
            map: this.map,
            position: pos,
            label: nome && nome.length ? nome[0].toUpperCase() : undefined,
          });

          marker.addListener('click', () => {
            const partidaLabel = partida || '';
            const destinoLabel = destino || '';
            const entrada = v.horarioEntrada || v.horario_entrada || '';
            const saida = v.horarioSaida || v.horario_saida || '';
            const tipoLegivel = tipo === 'motorista'
              ? 'Motorista (oferece carona)'
              : 'Passageiro (procura carona)';

            const diasLabel = this.formatDiasViagem(v);
            const diasHtml = diasLabel
              ? `<div><strong>Dias:</strong> ${diasLabel}</div>`
              : '';

            const conteudo =
              `<div style="min-width:220px;font-family:Arial, sans-serif;font-size:12px;">
                <div style="font-weight:bold;font-size:13px;margin-bottom:2px;">${nome}</div>
                <div style="color:#555;margin-bottom:4px;">${tipoLegivel}</div>
                <div style="margin-bottom:4px;">
                  <div><strong>Partida:</strong> ${partidaLabel}</div>
                  <div><strong>Destino:</strong> ${destinoLabel}</div>
                  <div><strong>Entrada:</strong> ${entrada}</div>
                  <div><strong>Saída:</strong> ${saida}</div>
                  ${diasHtml}
                </div>
                <button id="btnMostrarRotaMarker"
                        style="margin-top:4px;padding:4px 8px;border:none;border-radius:4px;
                               background:#1976d2;color:#fff;cursor:pointer;">
                  Visualizar rota
                </button>
              </div>`;

            this.infoWindow.setContent(conteudo);
            this.infoWindow.open(this.map, marker);

            google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
              const btn = document.getElementById('btnMostrarRotaMarker');
              if (btn) {
                btn.onclick = () => this.mostrarRota(partidaLabel, destinoLabel);
              }
            });
          });

          this.markers.push(marker);
        }
      });
    });
  }

  // ===================== EXPORTAÇÃO (PDF / EXCEL) =====================

  private getCaronasParaExportar() {
    const oferecidas = (this.caronasOferecidas || []).map(c => ({
      Partida: c.partida, Destino: c.destino, Entrada: c.entrada,
      Saida: c.saida, Ajuda: String(c.ajuda ?? ''), Tipo: 'Motorista'
    }));
    const procuradas = (this.caronasProcuradas || []).map(c => ({
      Partida: c.partida, Destino: c.destino, Entrada: c.entrada,
      Saida: c.saida, Ajuda: String(c.ajuda ?? ''), Tipo: 'Passageiro'
    }));
    return [...oferecidas, ...procuradas];
  }

  async exportarPDF(): Promise<void> {
    const linhas = this.getCaronasParaExportar();
    if (!linhas.length) return alert('Sem caronas para exportar.');

    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);

    const doc = new jsPDF('landscape', 'pt', 'a4');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório de Caronas - FaculRide', 40, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 40, 58);

    const head = [['Partida', 'Destino', 'Entrada', 'Saída', 'Ajuda (R$)', 'Tipo']];
    const body = linhas.map(l => [l.Partida, l.Destino, l.Entrada, l.Saida, l.Ajuda, l.Tipo]);

    autoTable(doc, {
      head,
      body,
      startY: 70,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [43, 140, 255], textColor: 255 }
    });

    doc.save(`caronas_${this.timestamp()}.pdf`);
  }

  async exportarExcel(): Promise<void> {
    const linhas = this.getCaronasParaExportar();
    if (!linhas.length) {
      alert('Sem caronas para exportar.');
      return;
    }

    try {
      const xlsxMod: any = await import('xlsx');
      const XLSX: any = xlsxMod?.default ?? xlsxMod;

      const fsMod: any = await import('file-saver');
      const saveAs: any = fsMod?.saveAs ?? fsMod?.default;

      const ws = XLSX.utils.json_to_sheet(linhas);
      (ws as any)['!cols'] = [
        { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Caronas');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
      });

      if (typeof saveAs === 'function') {
        saveAs(blob, `caronas_${this.timestamp()}.xlsx`);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `caronas_${this.timestamp()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      alert('Falha ao exportar Excel.');
    }
  }

  private timestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }
}
