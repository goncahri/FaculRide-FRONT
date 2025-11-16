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

  // ===== NOVO: marcadores no mapa =====
  markers: google.maps.Marker[] = [];
  infoWindow!: google.maps.InfoWindow;
  // ====================================

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

  // ===== NOVO: mini calendário (mês atual, dias úteis futuros) =====
  diasCalendario: {
    numero: number;
    dataCompleta: Date;
    diaSemana: number;
    desabilitado: boolean;
    selecionado: boolean;
  }[] = [];
  // ================================================================

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
    // mantém seu fluxo, apenas garante que o spinner começa ligado
    this.carregando = true;
    this._loads = { usuarios: false, viagens: false, avaliacoes: false };

    // NOVO: gera calendário do mês atual
    this.gerarCalendarioMesAtual();

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

    // ===== NOVO: InfoWindow e tentativa de desenhar marcadores =====
    this.infoWindow = new google.maps.InfoWindow();
    this.atualizarMarcadoresViagens(); // caso as viagens já tenham carregado
    // ===============================================================
  }

  // Helper para obter tipo normalizado.
  // 1) Tenta pela própria viagem (viagem.usuario.tipoUsuario ou viagem.tipoUsuario)
  // 2) Se não vier válido, busca na lista this.usuarios pelo idUsuario
  public tipoNormalizado(v: any): 'motorista' | 'passageiro' {
    const fromViagem = (v?.usuario?.tipoUsuario ?? v?.tipoUsuario ?? '')
      .toString()
      .trim()
      .toLowerCase();

    if (fromViagem === 'motorista' || fromViagem === 'passageiro') {
      return fromViagem as 'motorista' | 'passageiro';
    }

    // Fallback robusto: procura o usuário carregado em this.usuarios
    const uid = Number(v?.idUsuario);
    const u = this.usuarios.find(x => Number(x?.idUsuario ?? x?.id) === uid);

    const fromUsuario = (u?.tipoUsuario ?? u?.tipo_usuario ?? '')
      .toString()
      .trim()
      .toLowerCase();

    return fromUsuario === 'motorista' ? 'motorista' : 'passageiro';
  }

  // NOVO: normalização de usuários (snake_case/camelCase) sem mudar nada do restante
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
      // garante a chave padronizada que o template usa
      tipoUsuario
    };
  }

  carregarViagens(): void {
    this.http.get<any[]>(`${this.baseURL}/viagem`).subscribe({
      next: (res) => {
        this.viagens = res;

        // Usa Number() no idUsuario e tipo normalizado para evitar falsos “motorista”
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

        // ===== NOVO: atualizar marcadores com base nas viagens carregadas =====
        this.atualizarMarcadoresViagens();
        // =====================================================================

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
        // AJUSTE: normaliza todos os usuários na chegada
        this.usuarios = Array.isArray(res) ? res.map(u => this.normalizeUsuario(u)) : [];

        // Reprocessa as avaliações já carregadas
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

  // ===================== NOVO: lógica do mini calendário =====================

  private gerarCalendarioMesAtual(): void {
    if (!isBrowser()) return;

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth(); // 0–11
    const diaHoje = hoje.getDate();

    const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();

    const dias: {
      numero: number;
      dataCompleta: Date;
      diaSemana: number;
      desabilitado: boolean;
      selecionado: boolean;
    }[] = [];

    for (let d = 1; d <= ultimoDiaMes; d++) {
      const data = new Date(ano, mes, d);
      const diaSemana = data.getDay(); // 0 dom, 1 seg ... 6 sab

      const jaPassou = d < diaHoje;
      const fimDeSemana = diaSemana === 0 || diaSemana === 6;

      dias.push({
        numero: d,
        dataCompleta: data,
        diaSemana,
        desabilitado: jaPassou || fimDeSemana,
        selecionado: false
      });
    }

    this.diasCalendario = dias;
  }

  toggleDiaCalendario(dia: any): void {
    if (dia.desabilitado) return;
    dia.selecionado = !dia.selecionado;
  }

  private getDatasSelecionadasISO(): string[] {
    return this.diasCalendario
      .filter(d => d.selecionado && !d.desabilitado)
      .map(d => {
        const ano = d.dataCompleta.getFullYear();
        const mes = String(d.dataCompleta.getMonth() + 1).padStart(2, '0');
        const dia = String(d.dataCompleta.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`; // ex: 2025-11-17
      });
  }

  // ===================================================================

  tracarRota(): void {
    if (!this.origem || !this.destino || !this.entradaFatec || !this.saidaFatec) {
      alert('Preencha todos os campos.');
      return;
    }

    // NOVO: pega as datas selecionadas no mini calendário
    const datasSelecionadas = this.getDatasSelecionadasISO();
    if (!datasSelecionadas.length) {
      const continuar = confirm(
        'Você não selecionou nenhuma data no calendário.\n' +
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
      idUsuario: this.meuId
    };

    // NOVO: envia as datas agendadas (back trata como opcional)
    dadosViagem.datasAgendadas = datasSelecionadas;

    this.http.post(`${this.baseURL}/viagem`, dadosViagem).subscribe({
      next: () => {
        alert('Rota cadastrada com sucesso!');
        this.carregarViagens();
        // opcional: resetar seleção do calendário
        // this.gerarCalendarioMesAtual();
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
      setTimeout(() => this.mapContainer.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
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

  // ===================== NOVO: Marcadores de viagens no mapa =====================

  /**
   * Desenha marcadores das viagens no mapa, usando o endereço de partida
   * como base. Ao clicar na bolinha, abre um popup com dados e botão
   * "Visualizar rota" (chama a mesma função dos cards).
   */
  private atualizarMarcadoresViagens(): void {
    if (!isBrowser()) return;
    if (!this.map) return;
    if (!this.viagens || !this.viagens.length) return;

    // limpa marcadores antigos
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
            // Label com inicial do nome (se tiver)
            label: nome && nome.length ? nome[0].toUpperCase() : undefined,
          });

          marker.addListener('click', () => {
            const partidaLabel = partida || '';
            const destinoLabel = destino || '';
            const entrada = v.horarioEntrada || v.horario_entrada || '';
            const saida = v.horarioSaida || v.horario_saida || '';
            const tipoLegivel = tipo === 'motorista' ? 'Motorista (oferece carona)' : 'Passageiro (procura carona)';

            const conteudo =
              `<div style="min-width:220px;font-family:Arial, sans-serif;font-size:12px;">
                <div style="font-weight:bold;font-size:13px;margin-bottom:2px;">${nome}</div>
                <div style="color:#555;margin-bottom:4px;">${tipoLegivel}</div>
                <div style="margin-bottom:4px;">
                  <div><strong>Partida:</strong> ${partidaLabel}</div>
                  <div><strong>Destino:</strong> ${destinoLabel}</div>
                  <div><strong>Entrada:</strong> ${entrada}</div>
                  <div><strong>Saída:</strong> ${saida}</div>
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
        } else {
          // se der erro no geocode, só ignora aquele ponto
          // console.warn('Geocode falhou para:', partida, status);
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

    autoTable(doc, { head, body, startY: 70, theme: 'grid', styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [43, 140, 255], textColor: 255 } });

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
