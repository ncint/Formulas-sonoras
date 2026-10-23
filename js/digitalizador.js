/* Digitalizador — área de escrita à mão.
 *
 * Captura traços com Pointer Events (dedo, caneta ou mesa
 * digitalizadora USB — todos surgem como pointer events) e reconhece
 * vogais (A, E, I, O, U) e números (1, 2, 3), um símbolo de cada vez.
 *
 * A posição do símbolo no ecrã define a posição sonora:
 *   - eixo horizontal → panorâmica (esquerda → direita)
 *   - eixo vertical   → profundidade (cima = distante com reverb,
 *                        baixo = próximo e seco)
 *
 * O reconhecimento é geométrico: número de traços, ângulos dominantes,
 * fecho do traço e proporções. Desenhos grandes e claros funcionam
 * melhor; traços irreconhecíveis são ignorados (área limpa).
 *
 * Desenho recomendado:
 *   A: /\ com travessão (2 traços ou /\ em 1 traço + travessão)
 *   E: como um E de imprensa (vertical + 3 horizontais)
 *   I: traço vertical simples
 *   O: círculo fechado
 *   U: curva em U
 *   1: traço vertical (igual ao I → tratado como número 1)
 *   2: curva superior + base horizontal
 *   3: duas semicircunferências para a direita
 *
 * Nota: I e 1 desenham-se da mesma forma (traço vertical); o símbolo é
 * reconhecido como o número 1. Para o timbre I, desenhar um traço
 * vertical é ambíguo — usa-se o modo texto para fórmulas com I.
 */

/* Pausa sem desenhar antes de reconhecer o símbolo (ms). */
const PAUSA_RECONHECIMENTO_MS = 900;

export class Reconhecedor {
  constructor(canvas, aoReconhecer) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.aoReconhecer = aoReconhecer;
    this.tracos = [];

    this._configurar();

    if (typeof canvas.onpointerdown === 'undefined' && !window.PointerEvent) {
      // Fallback para navegadores sem Pointer Events (iOS antigo):
      // usa touch events; um dedo desenha, o símbolo fecha ao levantar.
      canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this._inicio(this._deTouch(e)); }, { passive: false });
      canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this._movimento(this._deTouch(e)); }, { passive: false });
      canvas.addEventListener('touchend', (e) => { e.preventDefault(); this._fim(); }, { passive: false });
    } else {
      canvas.addEventListener('pointerdown', (e) => this._inicio(e));
      canvas.addEventListener('pointermove', (e) => this._movimento(e));
      canvas.addEventListener('pointerup', () => this._fim());
      canvas.addEventListener('pointercancel', () => this._fim());
    }

    // No telemóvel o painel pode estar escondido no arranque (dimensão 0):
    // reconfigurar sempre que o canvas fica visível ou muda de tamanho.
    if (typeof ResizeObserver === 'function') {
      this._observer = new ResizeObserver(() => this._configurar());
      this._observer.observe(canvas);
    } else {
      window.addEventListener('resize', () => this._configurar());
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this._configurar();
    });
  }

  _configurar() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return; // painel escondido
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.lineWidth = 7;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#f0f2f5';
  }

  limpar() {
    if (this._timerDesenho) {
      clearTimeout(this._timerDesenho);
      this._timerDesenho = null;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.tracos = [];
  }

  _pos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Converte um TouchEvent num pseudo-evento de posição. */
  _deTouch(e) {
    const t = e.touches[0] || e.changedTouches[0];
    return { clientX: t.clientX, clientY: t.clientY, isPrimary: true, pointerId: 0, preventDefault() {} };
  }

  _inicio(e) {
    if (!e.isPrimary) return;
    e.preventDefault();
    if (this._timerDesenho) {
      clearTimeout(this._timerDesenho);
      this._timerDesenho = null;
    }
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
    this.tracos.push([this._pos(e)]);
  }

  _movimento(e) {
    if (!e.isPrimary) return;
    if (this.tracos.length === 0) return;
    e.preventDefault();
    const atual = this.tracos[this.tracos.length - 1];
    const p = this._pos(e);
    const anterior = atual[atual.length - 1];
    if (Math.hypot(p.x - anterior.x, p.y - anterior.y) < 2.5) return;
    atual.push(p);
    this.ctx.beginPath();
    this.ctx.moveTo(anterior.x, anterior.y);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
  }

  _fim() {
    if (this.tracos.length === 0) return;
    this.tracos = this.tracos.filter((t) => t.length >= 3);
    if (this.tracos.length === 0) { this.limpar(); return; }

    // Os traços ficam visíveis; o símbolo é reconhecido após uma
    // pausa sem desenhar (símbolos como A e E têm vários traços).
    if (this._timerDesenho) clearTimeout(this._timerDesenho);
    this._timerDesenho = setTimeout(() => {
      this._timerDesenho = null;
      this._reconhecer();
    }, PAUSA_RECONHECIMENTO_MS);
  }

  _reconhecer() {
    const caixa = this._caixa(this.tracos.flat());
    const simbolo = this._classificar(this.tracos, caixa);
    if (simbolo) {
      const rect = this.canvas.getBoundingClientRect();
      const cx = (caixa.minX + caixa.maxX) / 2 / rect.width;   // 0..1
      const cy = (caixa.minY + caixa.maxY) / 2 / rect.height;  // 0..1
      this.aoReconhecer(simbolo, { x: cx, y: cy });
    }
    this.limpar();
  }

  _caixa(pontos) {
    const xs = pontos.map((p) => p.x);
    const ys = pontos.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY, largura: maxX - minX, altura: maxY - minY };
  }

  _classificar(tracos, caixa) {
    const n = tracos.length;
    const infos = tracos.map((t) => this._infoTraco(t));
    const altura = Math.max(caixa.altura, 1);
    const largura = Math.max(caixa.largura, 1);

    // círculo fechado (1 traço) → O
    if (n === 1 && infos[0].fechado && infos[0].proporcaoEntreLados > 0.7 && infos[0].curvatura > 0.012) return 'O';

    // traço vertical simples → 1
    if (n === 1 && infos[0].vertical && largura < altura * 0.4) return '1';

    // U: um traço, desce-then-sobe (curvatura em baixo), aberto em cima
    if (n === 1) {
      const t = tracos[0];
      const u = this._assinaturaU(t, caixa);
      if (u) return 'U';
    }

    // 2 ou 3: um traço curvo (o O já foi filtrado acima pela
    // proporção e curvatura; um 3 pode começar e terminar perto)
    if (n === 1 && infos[0].curvaFeita && !infos[0].horizontal && !infos[0].vertical) {
      return this._distinguir23(tracos[0], caixa);
    }

    // multi-traço: A (diagonais em pico) ou E (vertical + horizontais)
    if (n >= 2) {
      const temPico = this._temPico(tracos, caixa);
      if (temPico) return 'A';

      const temVertical = infos.some((i) => i.vertical && i.reto);
      const horizontaisRetas = infos.filter((i) => i.horizontal && i.reto).length;
      if (temVertical && horizontaisRetas >= 1) return 'E';
    }

    return null;
  }

  /** A: pico — dois traços diagonais opostos, ou um traço com ápice
   * no interior e extremidades em baixo, tipicamente com travessão. */
  _temPico(tracos, caixa) {
    if (tracos.length < 2) return false;

    // caso 1: um traço sobe (dy < -10) e outro desce (dy > +10),
    // ambos com deslocamento horizontal significativo (|dx| >= 15)
    const sobe = tracos.some(
      (t) => t[t.length - 1].y < t[0].y - 10 && Math.abs(t[t.length - 1].x - t[0].x) >= 15
    );
    const desce = tracos.some(
      (t) => t[t.length - 1].y > t[0].y + 10 && Math.abs(t[t.length - 1].x - t[0].x) >= 15
    );
    if (sobe && desce) return true;

    // caso 2: um único traço em pico (extremidades em baixo, ponto
    // mais alto no interior) + um travessão horizontal
    const minY = caixa.minY, maxY = caixa.maxY;
    const alturaC = Math.max(maxY - minY, 1);
    const temPicoInterior = tracos.some((t) => {
      if (t.length < 6) return false;
      const topo = Math.min(...t.map((p) => p.y));
      const indice = t.findIndex((p) => p.y === topo);
      const interior = indice > 0 && indice < t.length - 1;
      const extremidadesBaixo =
        (t[0].y - minY) / alturaC > 0.5 && (t[t.length - 1].y - minY) / alturaC > 0.5;
      const alto = (maxY - topo) / alturaC > 0.6;
      return interior && extremidadesBaixo && alto;
    });
    const temTravessao = tracos.some((t) => {
      const i = this._infoTraco(t);
      return i.horizontal && i.reto;
    });
    return temPicoInterior && temTravessao;
  }

  /** U: primeira metade desce, curva em baixo, segunda metade sobe. */
  _assinaturaU(t, caixa) {
    if (t.length < 8) return false;
    const minY = caixa.minY;
    const maxY = caixa.maxY;
    const meioY = (minY + maxY) / 2;
    const metade = Math.floor(t.length / 2);
    const primeira = t.slice(0, metade);
    const segunda = t.slice(metade);

    // extremidades no topo, parte curva em baixo
    const comecaCima = primeira[0].y < meioY;
    const acabaCima = segunda[segunda.length - 1].y < meioY;
    const pontoMaisBaixo = Math.max(...t.map((p) => p.y));
    const curvaEmbaixo = pontoMaisBaixo > meioY;

    // desce e depois sobe
    let desceu = true, subiu = true;
    if (primeira.length > 1) {
      desceu = primeira[primeira.length - 1].y > primeira[0].y;
    }
    if (segunda.length > 1) {
      subiu = segunda[segunda.length - 1].y < segunda[0].y;
    }

    return comecaCima && acabaCima && curvaEmbaixo && desceu && subiu;
  }

  /** Distingue 2 (curva em cima, base reta) de 3 (curvas a direito, aberto à esquerda). */
  _distinguir23(t, caixa) {
    const minY = caixa.minY, maxY = caixa.maxY;
    const terco1 = Math.floor(t.length / 3);
    const primeira = t.slice(0, terco1);
    const ultima = t.slice(t.length - terco1);

    // 2: termina com traço horizontal (base) na parte inferior
    const horizFinal = Math.abs(ultima[ultima.length - 1].x - ultima[0].x) >
      Math.abs(ultima[ultima.length - 1].y - ultima[0].y);
    const emBaixo = (ultima[0].y + ultima[ultima.length - 1].y) / 2 > (minY + maxY) / 2;

    if (horizFinal && emBaixo) return '2';
    return '3';
  }

  _infoTraco(t) {
    const caixa = this._caixa(t);
    const largura = Math.max(caixa.largura, 1);
    const altura = Math.max(caixa.altura, 1);

    let horizontais = 0, verticais = 0, diagonais = 0;
    let distancia = 0;
    const passos = Math.max(t.length - 1, 1);

    for (let i = 1; i < t.length; i++) {
      const dx = t[i].x - t[i - 1].x;
      const dy = t[i].y - t[i - 1].y;
      const ang = Math.atan2(Math.abs(dy), Math.abs(dx));
      distancia += Math.hypot(dx, dy);
      if (ang < Math.PI / 6) horizontais++;
      else if (ang > Math.PI / 3) verticais++;
      else diagonais++;
    }

    const hPct = horizontais / passos;
    const vPct = verticais / passos;
    const dPct = diagonais / passos;

    const fechado =
      t.length > 5 &&
      Math.hypot(t[0].x - t[t.length - 1].x, t[0].y - t[t.length - 1].y) <
        Math.max(largura, altura) * 0.3;

    // curvatura normalizada: círculo ≈ 1/raio; reta ≈ 0
    const curvatura = this._curvaturaTotal(t) / Math.max(distancia, 1);

    const metade = Math.floor(t.length / 2);
    let verticalPrimeiraMetade = 0;
    if (metade > 0) {
      const primeiros = t.slice(0, metade);
      for (let i = 1; i < primeiros.length; i++) {
        const dx = Math.abs(primeiros[i].x - primeiros[i - 1].x);
        const dy = primeiros[i].y - primeiros[i - 1].y;
        if (dy > dx * 1.5 && dy > 0) verticalPrimeiraMetade++;
      }
      verticalPrimeiraMetade /= Math.max(primeiros.length - 1, 1);
    }

    return {
      horizontal: hPct > 0.55,
      vertical: vPct > 0.55,
      diagonal: dPct > 0.3,
      reto: curvatura < 0.15,
      fechado,
      curvaFeita: curvatura >= 0.005,
      curvatura,
      proporcaoEntreLados: Math.min(largura, altura) / Math.max(largura, altura),
      verticalPrimeiraMetade,
    };
  }

  _curvaturaTotal(t) {
    let total = 0;
    for (let i = 2; i < t.length; i++) {
      const a = { x: t[i - 1].x - t[i - 2].x, y: t[i - 1].y - t[i - 2].y };
      const b = { x: t[i].x - t[i - 1].x, y: t[i].y - t[i - 1].y };
      const ang = Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
      total += Math.abs(ang);
    }
    return total;
  }
}
