/* Interface da máquina rítmica — junta sequência + áudio + digitalizador. */

import { analisarSequencia, expandirSequencia, celulasParaTexto } from './sequencia.js';
import { MotorAudio } from './audio.js';
import { TIMBRES, VOGAIS, VOGAL_PADRAO } from './timbres.js';
import { Reconhecedor } from './digitalizador.js';

const campo = document.getElementById('sequencia');
const mensagem = document.getElementById('mensagem');
const botaoPlay = document.getElementById('botao-play');
const botaoStop = document.getElementById('botao-stop');
const bpmInput = document.getElementById('bpm');
const bpmValor = document.getElementById('bpm-valor');
const celulaAtual = document.getElementById('celula-atual');
const pulsoEl = document.getElementById('pulso');
const posicaoEl = document.getElementById('posicao');
const linhaCelulas = document.getElementById('linha-celulas');
const listaTimbres = document.getElementById('lista-timbres');

const modoTexto = document.getElementById('modo-texto');
const modoDigitalizador = document.getElementById('modo-digitalizador');
const painelTexto = document.getElementById('painel-texto');
const painelDesenho = document.getElementById('painel-desenho');
const canvas = document.getElementById('area-desenho');
const botaoLimparDesenho = document.getElementById('botao-limpar-desenho');
const estadoDesenho = document.getElementById('estado-desenho');

const motor = new MotorAudio(TIMBRES);
let celulasAtuais = [];
let aTocar = false;

/* Lista de vogais → timbres. */
VOGAIS.forEach((v) => {
  const li = document.createElement('li');
  li.innerHTML = `<strong>${v}</strong> — ${TIMBRES[v].nome}`;
  listaTimbres.appendChild(li);
});

/* Pré-carregar sequência do exemplo, se vier na query. */
const seqNaQuery = new URLSearchParams(location.search).get('seq');
if (seqNaQuery !== null && seqNaQuery.trim() !== '') {
  campo.value = seqNaQuery;
}

/* ---------- Modo texto ---------- */

function atualizarChips() {
  linhaCelulas.innerHTML = '';
  celulasAtuais.forEach((c, i) => {
    const chip = document.createElement('div');
    chip.className = 'celula-chip';
    chip.textContent = c.token;
    chip.dataset.indice = String(i);
    if (c.pan < -0.15 || c.pan > 0.15 || c.profundidade < 0.4 || c.profundidade > 0.6) {
      chip.title = `pan ${c.pan.toFixed(2)} · profundidade ${c.profundidade.toFixed(2)}`;
      chip.classList.add('com-posicao');
    }
    linhaCelulas.appendChild(chip);
  });
}

function validar(mostrarErro) {
  const resultado = analisarSequencia(campo.value);
  if (resultado.ok) {
    celulasAtuais = resultado.celulas;
    if (mostrarErro) mensagem.textContent = '';
    atualizarChips();
    return true;
  }
  if (mostrarErro) mensagem.textContent = resultado.erro;
  return false;
}

/* ---------- Modo digitalizador ---------- */

let vogalPendente = null;

function aoReconhecerSimbolo(simbolo, pos) {
  const pan = pos.x * 2 - 1;             // 0..1 → -1..+1
  const profundidade = 1 - pos.y;        // 0 (fundo/próximo) .. 1 (topo/distante)

  if (VOGAIS.includes(simbolo)) {
    vogalPendente = { simbolo, pan, profundidade };
    estadoDesenho.textContent = `Timbre ${simbolo} — desenha agora o número (1, 2 ou 3)`;
    return;
  }

  if (['1', '2', '3'].includes(simbolo)) {
    const vogal = vogalPendente?.simbolo ?? VOGAL_PADRAO;
    const pan = vogalPendente ? (vogalPendente.pan + (pos.x * 2 - 1)) / 2 : pos.x * 2 - 1;
    const prof = vogalPendente
      ? (vogalPendente.profundidade + (1 - pos.y)) / 2
      : 1 - pos.y;

    celulasAtuais.push({
      vogal,
      numero: Number(simbolo),
      pan,
      profundidade: prof,
      token: `${vogal}${simbolo}`,
    });
    vogalPendente = null;
    campo.value = celulasParaTexto(celulasAtuais);
    atualizarChips();
    estadoDesenho.textContent = `Adicionada ${vogal}${simbolo}`;
    if (aTocar) {
      motor.atualizar(expandirSequencia(celulasAtuais), celulasAtuais);
    }
    mensagem.textContent = '';
  }
}

const reconhecedor = new Reconhecedor(canvas, aoReconhecerSimbolo);

botaoLimparDesenho.addEventListener('click', () => {
  reconhecedor.limpar();
  vogalPendente = null;
  estadoDesenho.textContent = 'Desenha uma vogal e depois um número';
});

/* Alternância de modos. */
function mostrarModo(modo) {
  const digitalizador = modo === 'digitalizador';
  painelTexto.hidden = digitalizador;
  painelDesenho.hidden = !digitalizador;
  modoTexto.classList.toggle('ativo', !digitalizador);
  modoDigitalizador.classList.toggle('ativo', digitalizador);
}

modoTexto.addEventListener('click', () => mostrarModo('texto'));
modoDigitalizador.addEventListener('click', () => {
  mostrarModo('digitalizador');
  requestAnimationFrame(() => reconhecedor._configurar());
});

/* ---------- Reprodução ---------- */

function definirInterfaceTocar(tocando) {
  aTocar = tocando;
  botaoPlay.disabled = tocando;
  botaoStop.disabled = !tocando;
  if (!tocando) {
    celulaAtual.textContent = '—';
    posicaoEl.textContent = 'pronto';
  }
}

function reiniciarVisual() {
  document.querySelectorAll('.celula-chip').forEach((c) => c.classList.remove('ativa'));
}

function iniciar() {
  if (!validar(true)) return;
  const sequencia = expandirSequencia(celulasAtuais);
  if (sequencia.pulsoes.length === 0) return;

  const ok = motor.iniciar(sequencia, celulasAtuais, Number(bpmInput.value));
  if (!ok) return;
  definirInterfaceTocar(true);
}

function parar() {
  motor.parar();
  definirInterfaceTocar(false);
  reiniciarVisual();
}

motor.aoPulso = (indiceNoCiclo, indiceCelula, comAtaque) => {
  if (!aTocar) return;

  const chips = linhaCelulas.querySelectorAll('.celula-chip');
  chips.forEach((c) => c.classList.toggle('ativa', Number(c.dataset.indice) === indiceCelula));

  const celula = celulasAtuais[indiceCelula];
  if (celula) {
    celulaAtual.textContent = celula.token;
  }

  if (comAtaque) {
    celulaAtual.style.transform = 'scale(1.12)';
    pulsoEl.classList.remove('ativo');
    void pulsoEl.offsetWidth;
    pulsoEl.classList.add('ativo');
  } else {
    celulaAtual.style.transform = 'scale(1)';
  }
};

/* ---------- Eventos ---------- */

botaoPlay.addEventListener('click', iniciar);
botaoStop.addEventListener('click', parar);

campo.addEventListener('input', () => {
  validar(false);
  // Edição em tempo real: a nova sequência entra no próximo instante,
  // sem interromper a reprodução.
  if (aTocar && celulasAtuais.length > 0) {
    motor.atualizar(expandirSequencia(celulasAtuais), celulasAtuais);
  }
});

bpmInput.addEventListener('input', () => {
  bpmValor.textContent = bpmInput.value;
  motor.definirBpm(Number(bpmInput.value));
});

validar(false);
