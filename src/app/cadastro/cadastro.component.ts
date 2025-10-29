import { Component, OnInit } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  AbstractControl
} from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgxMaskDirective } from 'ngx-mask';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-cadastro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgxMaskDirective],
  templateUrl: './cadastro.component.html',
  styleUrls: ['./cadastro.component.css']
})
export class CadastroComponent implements OnInit {
  cadastroForm: FormGroup;
  isMotorista = false;
  anoAtual = new Date().getFullYear();
  hoje: string = new Date().toISOString().split('T')[0];

  selectedFile: File | null = null;
  previewUrl: string | null = null;
  loading = false;

  baseURL = window.location.hostname.includes('localhost')
    ? 'http://localhost:3000/api/usuario'
    : 'https://projeto-faculride.onrender.com/api/usuario';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient
  ) {
    // mesmo regex do back-end
    const senhaForteRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{6,}$/;

    this.cadastroForm = this.fb.group(
      {
        tipoUsuario: ['passageiro', Validators.required],
        nome: ['', Validators.required],

        // CPF: 11 dígitos
        cpf: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],

        // E-mail
        email: ['', [Validators.required, Validators.email]],

        // Telefone: 10 ou 11 dígitos
        telefone: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]],

        // CEP: 
        cep: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],

        endereco: ['', Validators.required],
        numero: ['', Validators.required],
        cidade: ['', Validators.required],
        estado: ['', [Validators.required, Validators.pattern(/^[A-Z]{2}$/)]],
        fatec: ['', Validators.required],

        // RA: 13 dígitos
        ra: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],

        genero: ['', Validators.required],
        dataNascimento: ['', [Validators.required, this.validarDataNascimento]],

        // Senha forte:
        senha: ['', [Validators.required, Validators.pattern(senhaForteRegex)]],
        repetirSenha: ['', Validators.required],

        // Campos do motorista:
        cnh: [''],
        modeloCarro: [''],
        anoCarro: ['', [Validators.pattern(/^\d{4}$/), Validators.min(1980), Validators.max(this.anoAtual)]],
        corCarro: [''],
        placa: ['']
      },
      { validators: this.validarSenhas }
    );
  }

  ngOnInit(): void {
    // Aplica validators de motorista na primeira carga
    this.alternarCamposMotorista();

    // Observa mudança do tipo para ligar/desligar validators
    this.cadastroForm.get('tipoUsuario')?.valueChanges.subscribe(() => {
      this.alternarCamposMotorista();
    });

    // Normaliza estado (UF) para maiúsculas em tempo real (opcional)
    this.cadastroForm.get('estado')?.valueChanges.subscribe(v => {
      if (v && typeof v === 'string' && v !== v.toUpperCase()) {
        this.cadastroForm.get('estado')?.setValue(v.toUpperCase(), { emitEvent: false });
      }
    });
  }

  // Validação de data de nascimento
  validarDataNascimento(control: AbstractControl) {
    const valor = control.value;
    if (!valor) return null;
    const dataInformada = new Date(valor);
    const hoje = new Date();
    if (isNaN(dataInformada.getTime()) || dataInformada > hoje) {
      return { dataFutura: true };
    }
    return null;
  }

  // Ativar/desativar campos de motorista dinamicamente
  alternarCamposMotorista() {
    const tipo = this.cadastroForm.get('tipoUsuario')?.value;
    this.isMotorista = tipo === 'motorista';

    const campos = ['cnh', 'modeloCarro', 'anoCarro', 'corCarro', 'placa'];
    campos.forEach(campo => {
      const control = this.cadastroForm.get(campo);
      if (!control) return;
      if (this.isMotorista) {
        control.setValidators(Validators.required);
      } else {
        control.clearValidators();
        // limpa valores para não mandar lixo
        control.setValue('');
      }
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  // Senhas iguais
  validarSenhas(group: FormGroup) {
    const senha = group.get('senha')?.value;
    const repetir = group.get('repetirSenha')?.value;
    return senha === repetir ? null : { senhasDiferentes: true };
  }

  // Busca endereço automático pelo CEP
  buscarEnderecoPorCep() {
    const cep = (this.cadastroForm.get('cep')?.value || '').replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;

    fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then(res => res.json())
      .then(data => {
        if (!data.erro) {
          this.cadastroForm.patchValue({
            endereco: data.logradouro || '',
            cidade: data.localidade || '',
            estado: (data.uf || '').toUpperCase()
          });
        } else {
          alert('CEP não encontrado.');
        }
      })
      .catch(() => {
        alert('Erro ao buscar o CEP.');
      });
  }

  // Foto
  onFotoChange(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    if (!file) return;

    const allow = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allow.includes(file.type)) {
      alert('Arquivo inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande (máx. 5MB).');
      return;
    }

    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);
  }

  removerFoto() {
    this.selectedFile = null;
    try { if (this.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl); } catch {}
    this.previewUrl = null;
  }

  // Helpers de normalização
  private onlyDigits(v: any): string {
    return String(v ?? '').replace(/\D/g, '');
  }
  private normalizePlaca(v: any): string {
    return String(v ?? '').toUpperCase().replace(/\s+/g, '');
  }

  // Envio do formulário
  async onSubmit() {
    this.cadastroForm.markAllAsTouched();

    if (this.cadastroForm.invalid) {
      const camposInvalidos = Object.keys(this.cadastroForm.controls).filter(
        c => this.cadastroForm.get(c)?.invalid
      );
      alert('Por favor, preencha corretamente os campos: ' + camposInvalidos.join(', '));
      return;
    }

    if (this.loading) return;
    this.loading = true;

    const v = this.cadastroForm.value;

    // Normalizações obrigatórias 
    const usuarioFinal: any = {
      tipoUsuario: v.tipoUsuario,
      nome: String(v.nome || '').trim(),
      cpf: this.onlyDigits(v.cpf),                  // 11 dígitos
      email: String(v.email || '').trim().toLowerCase(),
      telefone: this.onlyDigits(v.telefone),        // 10/11 dígitos
      cep: this.onlyDigits(v.cep),                  // 8 dígitos
      endereco: String(v.endereco || '').trim(),
      numero: String(v.numero || '').trim(),
      cidade: String(v.cidade || '').trim(),
      estado: String(v.estado || '').trim().toUpperCase(),
      fatec: String(v.fatec || '').trim(),
      ra: this.onlyDigits(v.ra),                    // 13 dígitos
      genero: v.genero === 'Masculino' || v.genero === true, // boolean para o back
      dataNascimento: v.dataNascimento,
      senha: v.senha
    };

    if (v.tipoUsuario === 'motorista') {
      usuarioFinal.cnh = this.onlyDigits(v.cnh);
      usuarioFinal.veiculo = {
        Modelo: v.modeloCarro,
        Ano: Number(v.anoCarro),
        Cor: v.corCarro,
        Placa_veiculo: this.normalizePlaca(v.placa)
      };
    }

    // 1) Cadastra
    this.http.post(this.baseURL, usuarioFinal).subscribe({
      next: async (res: any) => {
        try {
          // 2) Login para pegar token
          const loginResp: any = await this.http.post(`${this.baseURL}/login`, {
            email: usuarioFinal.email,
            senha: v.senha
          }).toPromise();

          const token = loginResp?.token || '';
          const usuarioDoLogin = loginResp?.usuario || {};
          if (token) localStorage.setItem('token', token);

          const usuarioSalvo = {
            ...usuarioFinal,
            id: usuarioDoLogin?.id ?? res?.id,
            idUsuario: usuarioDoLogin?.id ?? res?.id,
            veiculo: usuarioDoLogin?.veiculo ?? (usuarioFinal.veiculo || null),
            foto: null
          };

          // 3) Upload de foto (opcional)
          if (token && this.selectedFile) {
            const fd = new FormData();
            fd.append('file', this.selectedFile, this.selectedFile.name);
            const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

            try {
              const up: any = await this.http
                .post(`${this.baseURL}/foto/upload`, fd, { headers })
                .toPromise();

              if (up?.fotoUrl) {
                usuarioSalvo.foto = up.fotoUrl;
                usuarioSalvo.fotoUrl = up.fotoUrl;
              }
            } catch (e) {
              console.warn('Upload de foto falhou após cadastro:', e);
            }
          }

          localStorage.setItem('usuarioLogado', JSON.stringify(usuarioSalvo));
          alert('✅ Conta criada com sucesso!');
          this.router.navigate(['/login']);
        } catch (e) {
          console.error('Falha no login/upload pós-cadastro:', e);
          const usuarioSalvo = {
            ...usuarioFinal,
            id: res?.id,
            foto: null
          };
          localStorage.setItem('usuarioLogado', JSON.stringify(usuarioSalvo));
          alert('Conta criada, mas não foi possível concluir o envio da foto. Você pode enviar depois em Perfil.');
          this.router.navigate(['/login']);
        } finally {
          this.loading = false;
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Erro ao cadastrar:', err);
        alert(err?.error?.erro || 'Erro ao criar conta. Verifique os dados.');
      }
    });
  }
}
