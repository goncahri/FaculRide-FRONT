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
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  map!: google.maps.Map;
  directionsRenderer!: google.maps.DirectionsRenderer;

  // Dados do formulário
  tipoCarona: string = 'oferecer';
  origem: string = '';
  destino: string = '';
  entradaFatec: string = '';
  saidaFatec: string = '';
  ajudaCusto: number | null = null;

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
  meuId = this.usuarioLogado.idUsuario || this.usuarioLogado.id;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.carregarUsuarios();
    this.carregarViagens();
    this.carregarAvaliacoes();
  }

  ngAfterViewInit(): void {
    this.inicializarMapa();
  }

  inicializarMapa(): void {
    if (isBrowser()) {
      const mapOptions = {
        center: new google.maps.LatLng(-23.5015, -47.4526),
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      };

      this.map = new google.maps.Map(this.mapContainer.nativeElement, mapOptions);
      this.directionsRenderer = new google.maps.DirectionsRenderer();
      this.directionsRenderer.setMap(this.map);
    }
  }

  carregarViagens(): void {
    this.http.get<any[]>(`${this.baseURL}/viagem`).subscribe({
      next: (res) => {
        this.viagens = res;

        this.caronasOferecidas = this.viagens
          .filter(v => v.idUsuario === this.meuId && v.tipoUsuario === 'Motorista')
          .map(v => ({
            partida: v.partida,
            destino: v.destino,
            entrada: v.horarioEntrada,
            saida: v.horarioSaida,
            ajuda: v.ajudaDeCusto
          }));

        this.caronasProcuradas = this.viagens
          .filter(v => v.idUsuario === this.meuId && v.tipoUsuario === 'Passageiro')
          .map(v => ({
            partida: v.partida,
            destino: v.destino,
            entrada: v.horarioEntrada,
            saida: v.horarioSaida,
            ajuda: v.ajudaDeCusto
          }));
      },
      error: (err) => console.error('Erro ao carregar viagens:', err)
    });
  }

  carregarUsuarios(): void {
    this.http.get<any[]>(`${this.baseURL}/usuario`).subscribe({
      next: (res) => (this.usuarios = res),
      error: (err) => console.error('Erro ao carregar usuários:', err)
    });
  }

  tracarRota(): void {
    if (!this.origem || !this.destino || !this.entradaFatec || !this.saidaFatec) {
      alert('Preencha todos os campos.');
      return;
    }

    const dadosViagem = {
      tipoUsuario: this.tipoCarona === 'oferecer' ? 'Motorista' : 'Passageiro',
      partida: this.origem,
      destino: this.destino,
      horarioEntrada: this.entradaFatec,
      horarioSaida: this.saidaFatec,
      ajudaDeCusto: this.ajudaCusto ? this.ajudaCusto.toString() : '0',
      idUsuario: this.meuId
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
      },
      error: (err) => console.error('Erro ao carregar avaliações:', err)
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
    if (!linhas.length) return alert('Sem caronas para exportar.');

    const [{ utils, write }, { saveAs }] = await Promise.all([
      import('xlsx'),
      import('file-saver')
    ]);

    const ws = utils.json_to_sheet(linhas);
    (ws as any)['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }
    ];

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Caronas');

    const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
    });
    saveAs(blob, `caronas_${this.timestamp()}.xlsx`);
  }

  private timestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }
}
