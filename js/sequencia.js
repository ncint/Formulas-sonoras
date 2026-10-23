/* Interpretação da sequência de células rítmicas — fórmulas.
 *
 * Linguagem (versão 2):
 *  - Uma célula é uma fórmula VOGAL + NÚMERO, ex.: A2, E3, I1.
 *  - A vogal escolhe o timbre: A, E, I, O, U.
 *  - O número define a célula rítmica em colcheias:
 *      1 = 1 som + pausa de colcheia (semínima, 2 colcheias)
 *      2 = 2 sons + pausa de colcheia (3 colcheias)
 *      3 = 3 sons + pausa de colcheia (4 colcheias)
 *  - Um número sem vogal usa o timbre por omissão (A).
 *  - "+" é um separador visual opcional; espaços e vírgulas também.
 *  - As células tocam pela ordem escrita; a sequência repete-se
 *    em ciclo, sem completar compasso.
 *
 * Cada célula pode ter ainda posição sonora:
 *  - pan: -1 (esquerda) a +1 (direita); 0 = centro.
 *  - profundidade: 0 (próximo, seco) a 1 (distante, com reverb).
 *  A posição só é capturada no modo digitalizador; em texto usa-se
 *  o centro (pan 0, profundidade 0.5).
 */

import { VOGAIS } from './timbres.js';

export const PADROES = {
  1: [1, 0],
  2: [1, 1, 0],
  3: [1, 1, 1, 0],
};

/** Gera o padrão de ataques (1) e silêncios (0) de uma célula. */
export function gerarPadrao(numero) {
  return PADROES[numero].slice();
}

/**
 * Analisa o texto da sequência.
 * Devolve { ok: true, celulas: [célula, ...] } ou { ok: false, erro }.
 * Cada célula: { vogal, numero, pan, profundidade, token }.
 */
export function analisarSequencia(texto) {
  const tokens = texto
    .replace(/\+/g, ' ')
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return { ok: false, erro: 'Escreve pelo menos uma fórmula (ex.: A2, E3, 1).' };
  }

  const celulas = [];
  for (const token of tokens) {
    const m = token.match(/^([aeiouAEIOU])?([1-3])$/);
    if (!m) {
      return {
        ok: false,
        erro: `«${token}» não é válido. Usa vogais (A, E, I, O, U) seguidas de 1, 2 ou 3 — ex.: A2.`,
      };
    }
    const vogal = m[1] ? m[1].toUpperCase() : 'A';
    if (!VOGAIS.includes(vogal)) {
      return { ok: false, erro: `Vogal «${vogal}» não tem timbre atribuído.` };
    }
    celulas.push({
      vogal,
      numero: Number(m[2]),
      pan: 0,
      profundidade: 0.5,
      token: vogal + m[2],
    });
  }

  return { ok: true, celulas };
}

/**
 * Expande a sequência de células para a grade de colcheias.
 * Devolve:
 *  - pulsoes: array de 1/0 (colcheias do ciclo completo)
 *  - celulaDoPulso: índice da célula a que cada colcheia pertence
 *  - posicaoNaCelula: posição (0-based) da colcheia dentro da célula
 */
export function expandirSequencia(celulas) {
  const pulsoes = [];
  const celulaDoPulso = [];
  const posicaoNaCelula = [];

  celulas.forEach((celula, indice) => {
    const padrao = gerarPadrao(celula.numero);
    padrao.forEach((valor, pos) => {
      pulsoes.push(valor);
      celulaDoPulso.push(indice);
      posicaoNaCelula.push(pos);
    });
  });

  return { pulsoes, celulaDoPulso, posicaoNaCelula };
}

/** Converte uma lista de células de volta em texto de fórmulas. */
export function celulasParaTexto(celulas) {
  return celulas.map((c) => c.token).join(' + ');
}
