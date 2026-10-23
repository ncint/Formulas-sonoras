/* Motor de áudio — Web Audio API, sem dependências.
 *
 * Suporta fórmulas de células com timbre (vogal), panorâmica (pan)
 * e profundidade (dry/wet com reverb sintetizado). O agendamento usa
 * lookahead sobre o relógio do AudioContext.
 *
 * Grade: COLCHEIA. O BPM refere-se à semínima (colcheia = metade).
 */

const INTERVALO_AGENDA_MS = 25;
const LOOKAHEAD_S = 0.12;
const COLCHEIAS_POR_SEMINIMA = 2;
const DURACAO_REVERB_S = 2.2;

export class MotorAudio {
  constructor(timbres) {
    this.timbres = timbres;
    this.contexto = null;
    this.master = null;
    this.busSeco = null;
    this.busReverb = null;
    this.timerId = null;
    this.aTocar = false;

    this.pulsoes = [];
    this.celulaDoPulso = [];
    this.celulas = [];
    this.indicePulso = 0;
    this.bpm = 120;
    this.proximoTempo = 0;

    this.aoPulso = null;
  }

  garantirContexto() {
    if (!this.contexto) {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      this.contexto = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(ctx.destination);

      this.busSeco = ctx.createGain();
      this.busSeco.connect(this.master);

      const convolver = ctx.createConvolver();
      convolver.buffer = this._impulsoReverb(DURACAO_REVERB_S);
      this.busReverb = ctx.createGain();
      this.busReverb.connect(convolver);
      convolver.connect(this.master);
    }
    if (this.contexto.state === 'suspended') this.contexto.resume();
    return this.contexto;
  }

  /** Resposta ao impulso sintetizada (decaimento exponencial). */
  _impulsoReverb(duracao) {
    const ctx = this.contexto;
    const n = Math.floor(ctx.sampleRate * duracao);
    const buffer = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const dados = buffer.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        dados[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
      }
    }
    return buffer;
  }

  get segundoPorColcheia() {
    return 60 / (this.bpm * COLCHEIAS_POR_SEMINIMA);
  }

  /** Bus de saída com pan e mistura dry/wet conforme a célula. */
  _busDaCelula(celula) {
    const ctx = this.contexto;
    const tempan = typeof ctx.createStereoPanner === 'function';
    const pan = tempan ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.max(-1, Math.min(1, celula.pan || 0));

    const alvo = pan || this.busSeco;
    if (pan) pan.connect(this.busSeco);

    const prof = Math.max(0, Math.min(1, celula.profundidade ?? 0.5));
    const envioReverb = ctx.createGain();
    envioReverb.gain.value = prof * prof;
    (pan || this.busSeco).connect(envioReverb);
    envioReverb.connect(this.busReverb);

    return alvo;
  }

  /** Dispara o timbre da célula no tempo indicado. */
  atacar(tempo, celula, timbre) {
    const ctx = this.contexto;
    const bus = this._busDaCelula(celula);

    if (timbre.tipo === 'ressonancia') {
      this._atacarRessonancia(tempo, timbre, bus);
    } else {
      this._atacarRuido(tempo, timbre, bus);
    }
  }

  _atacarRuido(tempo, t, bus) {
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
    env.connect(bus);
    fonte.start(tempo);
    fonte.stop(tempo + duracao + 0.01);
  }

  _atacarRessonancia(tempo, t, bus) {
    const ctx = this.contexto;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(t.frequencia, tempo);
    osc.frequency.exponentialRampToValueAtTime(
      t.frequencia * (t.frequencia < 400 ? 0.6 : 0.94),
      tempo + t.duracao
    );

    const env = ctx.createGain();
    env.gain.setValueAtTime(t.ganho, tempo);
    env.gain.exponentialRampToValueAtTime(0.001, tempo + t.duracao);

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
    env.connect(bus);
    fonteRuido.connect(filtroRuido);
    filtroRuido.connect(envRuido);
    envRuido.connect(bus);

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

  /** Amostra solta de um timbre (pré-escuta / desbloqueio do áudio). */
  ouvirAmostra(celula, timbre) {
    this.garantirContexto();
    this.atacar(this.contexto.currentTime + 0.02, celula, timbre);
  }

  /**
   * Inicia a reprodução em ciclo.
   * Recebe o resultado de expandirSequencia() e a lista de células.
   */
  iniciar(sequencia, celulas, bpm) {
    if (sequencia.pulsoes.length === 0) return false;
    this.parar();

    this.garantirContexto();
    this.pulsoes = sequencia.pulsoes;
    this.celulaDoPulso = sequencia.celulaDoPulso;
    this.celulas = celulas;
    this.bpm = bpm;
    this.indicePulso = 0;
    this.proximoTempo = this.contexto.currentTime + 0.06;
    this.aTocar = true;

    this.timerId = setInterval(() => this._agendar(), INTERVALO_AGENDA_MS);
    this._agendar();
    return true;
  }

  parar() {
    this.aTocar = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

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
      const indiceCelula = this.celulaDoPulso[indiceNoCiclo];

      if (valor === 1) {
        const celula = this.celulas[indiceCelula];
        const timbre = this._timbreDaCelula(celula);
        this.atacar(tempo, celula, timbre);
      }
      this._notificarVisual(tempo, indiceNoCiclo, valor === 1);

      this.indicePulso = (this.indicePulso + 1) % this.pulsoes.length;
      this.proximoTempo += this.segundoPorColcheia;
    }
  }

  _timbreDaCelula(celula) {
    return this.timbres[celula.vogal] || this.timbres.A;
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
