/* Motor de áudio — Web Audio API, sem dependências.
 *
 * Um único timbre de percussão de altura indefinida: ruído filtrado
 * curto e seco com envelope rápido, inspirado em palmas/blocos de
 * madeira. O agendamento usa lookahead sobre o relógio do AudioContext
 * para manter a precisão rítmica estável.
 */

const ATAQUES_POR_CHAMADA = 8;   // pulsações agendadas por passagem
const INTERVALO_AGENDA_MS = 25; // frequência do agendador
const LOOKAHEAD_S = 0.12;       // margem de agendamento à frente

export class MotorAudio {
  constructor() {
    this.contexto = null;
    this.ganho = null;
    this.timerId = null;
    this.aTocar = false;

    // estado da reprodução
    this.pulsoes = [];      // padrão expandido (1/0) do ciclo completo
    this.bpm = 120;
    this.indicePulso = 0;
    this.proximoTempo = 0;  // tempo do AudioContext da próxima pulsação

    // callback visual (chamado no momento aproximado de cada ataque,
    // já alinhado com o tempo real via setTimeout)
    this.aoAtacar = null;
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

  get segundoPorPulso() {
    return 60 / this.bpm;
  }

  /** Som curto, seco e articulado (palma/bloco de madeira). */
  atacar(tempo) {
    const ctx = this.contexto;
    const duracao = 0.045;

    const buffer = this._bufferRuido(duracao);
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;

    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = 1100;
    filtro.Q.value = 1.2;

    const env = ctx.createGain();
    env.gain.setValueAtTime(1.0, tempo);
    env.gain.exponentialRampToValueAtTime(0.001, tempo + duracao);

    fonte.connect(filtro);
    filtro.connect(env);
    env.connect(this.ganho);
    fonte.start(tempo);
    fonte.stop(tempo + duracao + 0.01);
  }

  _bufferRuido(duracao) {
    const ctx = this.contexto;
    const n = Math.max(1, Math.floor(ctx.sampleRate * duracao));
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) dados[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /**
   * Inicia a reprodução em ciclo. `pulsoes` é o padrão expandido
   * (1 = ataque, 0 = silêncio). Garante um único ciclo ativo.
   */
  iniciar(pulsoes, bpm) {
    if (pulsoes.length === 0) return false;
    this.parar();

    this.garantirContexto();
    this.pulsoes = pulsoes;
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

  /** Atualiza o andamento sem reiniciar o ciclo. */
  definirBpm(bpm) {
    this.bpm = bpm;
  }

  _agendar() {
    if (!this.aTocar) return;
    const ctx = this.contexto;
    while (this.proximoTempo < ctx.currentTime + LOOKAHEAD_S) {
      const valor = this.pulsoes[this.indicePulso];
      const tempo = this.proximoTempo;
      const indice = this.indicePulso;
      const pulsoAtual = this.indicePulso % this.pulsoes.length;

      if (valor === 1) {
        this.atacar(tempo);
        this._notificarVisual(tempo, pulsoAtual, true);
      } else {
        this._notificarVisual(tempo, pulsoAtual, false);
      }

      this.indicePulso = (this.indicePulso + 1) % this.pulsoes.length;
      this.proximoTempo += this.segundoPorPulso;
      if (this.indicePulso === 0 && ATAQUES_POR_CHAMADA) { /* ciclo continua */ }
    }
  }

  _notificarVisual(tempoAlvo, pulsoNoCiclo, comAtaque) {
    const atrasoMs = Math.max(0, (tempoAlvo - this.contexto.currentTime) * 1000);
    setTimeout(() => {
      if (!this.aTocar) return;
      if (this.aoPulso) this.aoPulso(pulsoNoCiclo, comAtaque);
    }, atrasoMs);
  }
}
