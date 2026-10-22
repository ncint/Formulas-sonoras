/* Motor de áudio — Web Audio API, sem dependências.
 *
 * Um único timbre de percussão de altura indefinida: ruído filtrado
 * curto e seco com envelope rápido, inspirado em palmas/blocos de
 * madeira. O agendamento usa lookahead sobre o relógio do AudioContext
 * para manter a precisão rítmica estável.
 *
 * A grade é a COLCHEIA: o BPM refere-se à semínima, logo uma colcheia
 * dura (60 / BPM) / 2 segundos.
 */

const INTERVALO_AGENDA_MS = 25; // frequência do agendador
const LOOKAHEAD_S = 0.12;       // margem de agendamento à frente
const COLCHEIAS_POR_SEMINIMA = 2;

/* Identificador do timbre em uso (exposto para a interface). */
export const TIMBRE_ID = 'palma-seca';
export const TIMBRE_NOME = 'Palma seca (percussão de altura indefinida)';

export class MotorAudio {
  constructor() {
    this.contexto = null;
    this.ganho = null;
    this.timerId = null;
    this.aTocar = false;

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
