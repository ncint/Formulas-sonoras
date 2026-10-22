/* Interface da máquina rítmica — junta sequência + áudio. */

import { analisarSequencia, expandirSequencia } from './sequencia.js';
import { MotorAudio, TIMBRE_ID, TIMBRE_NOME } from './audio.js';

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
const timbreEl = document.getElementById('timbre');

const motor = new MotorAudio();
let celulasAtuais = [];
let aTocar = false;

/* Mostrar o identificador do timbre. */
if (timbreEl) {
  timbreEl.textContent = `Timbre: ${TIMBRE_NOME} (${TIMBRE_ID})`;
}

/* Pré-carregar sequência do exemplo, se vier na query (?seq=2+3+1). */
const seqNaQuery = new URLSearchParams(location.search).get('seq');
if (seqNaQuery !== null && seqNaQuery.trim() !== '') {
  campo.value = seqNaQuery;
}

function atualizarChips() {
  linhaCelulas.innerHTML = '';
  celulasAtuais.forEach((n, i) => {
    const chip = document.createElement('div');
    chip.className = 'celula-chip';
    chip.textContent = String(n);
    chip.dataset.indice = String(i);
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

  const ok = motor.iniciar(sequencia, Number(bpmInput.value));
  if (!ok) return;
  definirInterfaceTocar(true);
}

function parar() {
  motor.parar();
  definirInterfaceTocar(false);
  reiniciarVisual();
}

/* Visual: acompanhar a pulsação (grade de colcheias). */
motor.aoPulso = (indiceNoCiclo, indiceCelula, comAtaque) => {
  if (!aTocar) return;

  const chips = linhaCelulas.querySelectorAll('.celula-chip');
  chips.forEach((c) => c.classList.toggle('ativa', Number(c.dataset.indice) === indiceCelula));

  if (celulasAtuais.length > 0) {
    celulaAtual.textContent = String(celulasAtuais[indiceCelula]);
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

/* Eventos */

botaoPlay.addEventListener('click', iniciar);
botaoStop.addEventListener('click', parar);

campo.addEventListener('input', () => {
  validar(false);
  // Alterar a sequência em vigor não deixa padrões antigos a tocar.
  if (aTocar) {
    parar();
    mensagem.textContent = 'Sequência alterada — prime Tocar para ouvir.';
  }
});

bpmInput.addEventListener('input', () => {
  bpmValor.textContent = bpmInput.value;
  motor.definirBpm(Number(bpmInput.value));
});

validar(false);
