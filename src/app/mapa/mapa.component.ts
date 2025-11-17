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

  // ===== Marcadores no mapa =====
  markers: google.maps.Marker[] = [];
  infoWindow!: google.maps.InfoWindow;

  // ===== Spinner / estado de carregamento =====
  carregando: boolean = true;
  private _loads = { usuarios: false, viagens: false, avaliacoes: false };
  private markLoaded(key: 'usuarios' | 'viagens' | 'avaliacoes') {
    this._loads[key] = true;
    if (this._loads.usuarios && this._loads.viagens && this._loads.avaliacoes) {
      this.carregando = false;
    }
  }

  // ===== Dados do formulário =====
  tipoCarona: string = 'oferecer';
  origem: string = '';
  destino: string = '';
  entradaFatec: string = '';
  saidaFatec: string = '';
  ajudaCusto: number | null = null;

  // === NOVO: calendário simples, igual cadastro (input date) ===
  hojeISO: string = new Date().toISOString().split('T')[0];   // para min
  dataRota: string = '';                                      // value do input
  datasRota: string[] = [];                                   // lista de dias da rota
  // ============================================================

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

  // Config API
  baseURL = isBrowser() && window.location.hostname.includes('localhost')
    ? 'http://localhost:3000/api'
    : 'https://projeto-faculride.onrender.com/api';

  usuarioLogado = isBrowser() ? JSON.parse(localStorage.getItem('usuarioLogado') || '{}') : {};
  meuId = Number(this.usuarioLogado.idUsuario || this.usuarioLogado.id);

  constructor(private http: HttpClient) {}

  // ============================================================
  // CICLO DE VIDA
  // ============================================================

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
    this.atualizarMarcadoresViagens();
  }

  // ============================================================
  // TIPOS / USUÁRIOS
  // ============================================================

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

  private normalizeUsuario(u: any) {
    const bruto = (u?.tipoUsuario ?? u?.tipo_usuario ?? u?.tipo ?? '')
      .toString()
      .toLowerCase()
      .trim();

    const tipoUsuario =
      bruto === 'motorista' || bruto === 'passageiro'
        ? bruto
        : (u?.tipoUsuario ?? u?.tipo_usuario ?? '').toString().toLowerCase();

    return { ...u, tipoUsuario };
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

  // ============================================================
  // VIAGENS
  // ============================================================

  carregarViagens(): void {
    this.http.get<any[]>(`${this.baseURL}/viagem`).subscribe({
      next: (res) => {
        this.viagens = res || [];

        this.caronasOferecidas = this.viagens
          .filter(v => Number(v.idUsuario) === this.meuId && this.tipoNormalizado(v) === 'motorista')
          .map(v => ({
            partida: v.partida,
            destino: v.destino,
            entrada: v.horarioEntrada,
            saida: v.horarioSaida,
            ajuda: v.ajudaDeCusto
          }));

        this.caronasProcuradas = this.viagens
          .filter(v => Number(v.idUsuario) === this.meuId && this.tipoNormalizado(v) === 'passageiro')
          .map(v => ({
            partida: v.partida,
            destino: v.destino,
            entrada: v.horarioEntrada,
            saida: v.horarioSaida,
            ajuda: v.ajudaDeCusto
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

  // ========= NOVO: lógica do calendário simples =========

  /** Chamado no (change) do input type="date" */
  adicionarDataRota(): void {
    if (!this.dataRota) return;

    // impede datas passadas
    if (this.dataRota < this.hojeISO) {
      alert('Escolha apenas datas futuras.');
      this.dataRota = '';
      return;
    }

    const d = new Date(this.dataRota);
    const diaSemana = d.getDay(); // 0 dom, 6 sab
    if (diaSemana === 0 || diaSemana === 6) {
      alert('Selecione apenas dias úteis (segunda a sexta).');
      this.dataRota = '';
      return;
    }

    if (!this.datasRota.includes(this.dataRota)) {
      this.datasRota.push(this.dataRota);
      this.datasRota.sort(); // mantém ordenado
    }

    // limpa o input mas mantém as tags embaixo
    this.dataRota = '';
  }

  removerDataRota(data: string): void {
    this.datasRota = this.datasRota.filter(d => d !== data);
  }

  formatarDataTag(iso: string): string {
    // yyyy-mm-dd -> dd/mm
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}`;
  }

  /** Lê as datas de uma viagem v (seu campo datasAgendadas) e devolve texto bonitinho. */
  formatarDiasViagem(v: any): string {
    const lista = this.extrairDatasViagem(v);
    if (!lista.length) return '';

    const formatadas = lista.map(iso => this.formatarDataTag(iso));
    return `Dias de aula: ${formatadas.join(', ')}`;
  }

  /** Tenta extrair array de strings ISO de datas da viagem (vindo do back). */
  private extrairDatasViagem(v: any): string[] {
    let bruto: any = v?.datasAgendadas ?? v?.datas_agendadas ?? v?.diasRota ?? [];

    if (!bruto) return [];

    if (Array.isArray(bruto)) {
      return bruto.map((x: any) => String(x)).filter(Boolean);
    }

    if (typeof bruto === 'string') {
      // tenta JSON
      try {
        const parsed = JSON.parse(bruto);
        if (Array.isArray(parsed)) {
          return parsed.map((x: any) => String(x)).filter(Boolean);
        }
      } catch {
        // não era JSON; tenta separado por vírgula
        if (bruto.includes(',')) {
          return bruto.split(',').map(x => x.trim()).filter(Boolean);
        }
        if (bruto.length >= 10) {
          return [bruto.substring(0, 10)];
        }
      }
    }

    return [];
  }

  // ========= Cadastro da rota =========

  tracarRota(): void {
    if (!this.origem || !this.destino || !this.entradaFatec || !this.saidaFatec) {
      alert('Preencha todos os campos.');
      return;
    }

    // se não tiver nenhuma data, pergunta se quer prosseguir mesmo assim
    if (!this.datasRota.length) {
      const continuar = confirm(
        'Você não selecionou nenhuma data da rota.\n' +
        'Deseja cadastrar assim mesmo?'
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
      // NOVO: envia lista de datas da rota
      datasAgendadas: this.datasRota
    };

    this.http.post(`${this.baseURL}/viagem`, dadosViagem).subscribe({
      next: () => {
        alert('Rota cadastrada com sucesso!');
        this.carregarViagens();
        // limpa apenas campos de rota, se quiser
        // this.origem = ''; this.destino = ''; ...
        this.datasRota = [];
        this.dataRota = '';
      },
      error: (err) => {
        console.error('Erro ao cadastrar viagem:', err);
        alert('Erro ao cadastrar rota.');
      }
    });

    // desenha no mapa
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
    if (!isBrowser()) return;

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

  // ============================================================
  // AVALIAÇÕES
  // ============================================================

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

  // ============================================================
  // MAPA – marcadores
  // ============================================================

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

            const diasTxt = this.formatarDiasViagem(v);

            const conteudo =
              `<div style="min-width:220px;font-family:Arial, sans-serif;font-size:12px;">
                <div style="font-weight:bold;font-size:13px;margin-bottom:2px;">${nome}</div>
                <div style="color:#555;margin-bottom:4px;">${tipoLegivel}</div>
                <div style="margin-bottom:4px;">
                  <div><strong>Partida:</strong> ${partidaLabel}</div>
                  <div><strong>Destino:</strong> ${destinoLabel}</div>
                  <div><strong>Entrada:</strong> ${entrada}</div>
                  <div><strong>Saída:</strong> ${saida}</div>
                  ${diasTxt ? `<div><strong>${diasTxt}</strong></div>` : ''}
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

  // ============================================================
  // EXPORTAÇÃO PDF / EXCEL
  // ============================================================

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
      head, body, startY: 70, theme: 'grid',
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
