/* Motor de áudio — Web Audio API, sem dependências.
 *
 * Timbres de percussão de altura indefinida, sintetizados localmente.
 * O timbre ativo é escolhido pela interface via definirTimbre().
 * O agendamento usa lookahead sobre o relógio do AudioContext
 * para manter a precisão rítmica estável.
 *
 * A grade é a COLCHEIA: o BPM refere-se à semínima, logo uma colcheia
 * dura (60 / BPM) / 2 segundos.
 */

const INTERVALO_AGENDA_MS = 25; // frequência do agendador
const LOOKAHEAD_S = 0.12;       // margem de agendamento à frente
const COLCHEIAS_POR_SEMINIMA = 2;

/* Registo de timbres — cada entrada descreve a síntese do ataque.
 * Para acrescentar um timbre novo basta adicionar uma entrada aqui
 * e um botão correspondente na interface. */
export const TIMBRES = {
  'palma-seca': {
    nome: 'Palma seca',
    tipo: 'ruido',
    frequencia: 1100,
    q: 1.2,
    duracao: 0.045,
    ganho: 1.0,
  },
  'bloco-madeira': {
    nome: 'Bloco de madeira',
    tipo: 'ruido',
    frequencia: 600,
    q: 3.0,
    duracao: 0.06,
    ganho: 1.0,
  },
  'estalo': {
    nome: 'Estalo',
    tipo: 'ruido',
    frequencia: 2600,
    q: 0.8,
    duracao: 0.02,
    ganho: 0.9,
  },
  'clave': {
    nome: 'Clave',
    tipo: 'ressonancia',
    frequencia: 1700,
    q: 8.0,
    duracao: 0.08,
    ganho: 0.8,
  },
};

export const TIMBRE_PADRAO = 'palma-seca';

export class MotorAudio {
  constructor() {
    this.contexto = null;
    this.ganho = null;
    this.timerId = null;
    this.aTocar = false;
    this.timbreId = TIMBRE_PADRAO;

    // estado da reprodução
    this.pulsoes = [];        // grade de colcheias (1/0) do ciclo completo
    this.celulaDoPulso = [];  // célula a que cada colcheia pertence
    this.indicePulso = 0;
    this.bpm = 120;           // BPM em semínimas
    this.proximoTempo = 0;

    // callback visual (chamado no momento aproximado de cada colcheia,
    // alinhado com o tempo real via setTimeout)
    this.aoPulso = null;
  }

  garantirContexto() {
    if (!this.contexto) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.contexto = new AC();
      this.ganho = this.contexto.createGain();
      this.ganho.gain.value = 0.8;
      this.ganho.connect(this.contexto.destination);
    }
    if (this.contexto.state === 'suspended') this.contexto.resume();
    return this.contexto;
  }

  get segundoPorColcheia() {
    return 60 / (this.bpm * COLCHEIAS_POR_SEMINIMA);
  }

  get timbre() {
    return TIMBRES[this.timbreId];
  }

  /** Troca o timbre em tempo real (não interrompe a reprodução). */
  definirTimbre(id) {
    if (!TIMBRES[id]) return false;
    this.timbreId = id;
    return true;
  }

  /** Dispara o timbre ativo no tempo indicado do AudioContext. */
  atacar(tempo) {
    const t = this.timbre;
    const ctx = this.contexto;

    if (t.tipo === 'ressonancia') {
      this._atacarRessonancia(tempo, t);
    } else {
      this._atacarRuido(tempo, t);
    }
  }

  /** Timbres de ruído filtrado (palma, bloco, estalo). */
  _atacarRuido(tempo, t) {
    const ctx = this.contexto;
    const duracao = t.duracao;

    const buffer = this._bufferRuido(duracao);
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;

    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = t.frequencia;
    filtro.Q.value = t.q;

    const env = ctx.createGain();
    env.gain.setValueAtTime(t.ganho, tempo);
    env.gain.exponentialRampToValueAtTime(0.001, tempo + duracao);

    fonte.connect(filtro);
    filtro.connect(env);
    env.connect(this.ganho);
    fonte.start(tempo);
    fonte.stop(tempo + duracao + 0.01);
  }

  /** Timbre com ressonância tonal curta (clave). */
  _atacarRessonancia(tempo, t) {
    const ctx = this.contexto;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(t.frequencia, tempo);
    osc.frequency.exponentialRampToValueAtTime(t.frequencia * 0.94, tempo + t.duracao);

    const env = ctx.createGain();
    env.gain.setValueAtTime(t.ganho, tempo);
    env.gain.exponentialRampToValueAtTime(0.001, tempo + t.duracao);

    // camada de ruído para o "click" do impacto
    const ruido = this._bufferRuido(0.012);
    const fonteRuido = ctx.createBufferSource();
    fonteRuido.buffer = ruido;
    const filtroRuido = ctx.createBiquadFilter();
    filtroRuido.type = 'bandpass';
    filtroRuido.frequency.value = 3000;
    filtroRuido.Q.value = 1.0;
    const envRuido = ctx.createGain();
    envRuido.gain.setValueAtTime(0.5, tempo);
    envRuido.gain.exponentialRampToValueAtTime(0.001, tempo + 0.012);

    osc.connect(env);
    env.connect(this.ganho);
    fonteRuido.connect(filtroRuido);
    filtroRuido.connect(envRuido);
    envRuido.connect(this.ganho);

    osc.start(tempo);
    osc.stop(tempo + t.duracao + 0.01);
    fonteRuido.start(tempo);
    fonteRuido.stop(tempo + 0.02);
  }

  _bufferRuido(duracao) {
    const ctx = this.contexto;
    const n = Math.max(1, Math.floor(ctx.sampleRate * duracao));
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) dados[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Dispara um ataque solto (pré-escuta do timbre). */
  ouvirAmostra() {
    this.garantirContexto();
    this.atacar(this.contexto.currentTime + 0.02);
  }

  /**
   * Inicia a reprodução em ciclo. Recebe o resultado de
   * expandirSequencia(): { pulsoes, celulaDoPulso, posicaoNaCelula }.
   * Garante um único ciclo ativo.
   */
  iniciar(sequencia, bpm) {
    if (sequencia.pulsoes.length === 0) return false;
    this.parar();

    this.garantirContexto();
    this.pulsoes = sequencia.pulsoes;
    this.celulaDoPulso = sequencia.celulaDoPulso;
    this.posicaoNaCelula = sequencia.posicaoNaCelula;
    this.bpm = bpm;
    this.indicePulso = 0;
    this.proximoTempo = this.contexto.currentTime + 0.06;
    this.aTocar = true;

    this.timerId = setInterval(() => this._agendar(), INTERVALO_AGENDA_MS);
    this._agendar();
    return true;
  }

  /** Interrompe efetivamente a reprodução. */
  parar() {
    this.aTocar = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /** Atualiza o andamento (BPM em semínimas) sem reiniciar o ciclo. */
  definirBpm(bpm) {
    this.bpm = bpm;
  }

  _agendar() {
    if (!this.aTocar) return;
    const ctx = this.contexto;
    while (this.proximoTempo < ctx.currentTime + LOOKAHEAD_S) {
      const valor = this.pulsoes[this.indicePulso];
      const tempo = this.proximoTempo;
      const indiceNoCiclo = this.indicePulso % this.pulsoes.length;

      if (valor === 1) {
        this.atacar(tempo);
      }
      this._notificarVisual(tempo, indiceNoCiclo, valor === 1);

      this.indicePulso = (this.indicePulso + 1) % this.pulsoes.length;
      this.proximoTempo += this.segundoPorColcheia;
    }
  }

  _notificarVisual(tempoAlvo, indiceNoCiclo, comAtaque) {
    const atrasoMs = Math.max(0, (tempoAlvo - this.contexto.currentTime) * 1000);
    setTimeout(() => {
      if (!this.aTocar) return;
      if (this.aoPulso) {
        this.aoPulso(indiceNoCiclo, this.celulaDoPulso[indiceNoCiclo], comAtaque);
      }
    }, atrasoMs);
  }
}
