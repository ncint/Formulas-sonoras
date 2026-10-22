/* Interpretação da sequência de células rítmicas.
 *
 * Regras (versão 1, rev. 1 — grade de colcheias):
 *  - A unidade mínima é a COLCHEIA (meia semínima).
 *  - 1 = semínima: um ataque com a duração de duas colcheias.
 *  - 2 = duas colcheias atacadas + uma pausa de colcheia.
 *  - 3 = três colcheias atacadas + uma pausa de colcheia.
 *  - As células são reproduzidas pela ordem escrita; a sequência
 *    completa repete-se em ciclo.
 *  - "+" é um separador visual opcional; espaços e vírgulas também
 *    são aceites como separadores.
 *
 * Para alterar durações ou padrões no futuro basta mudar PADROES
 * sem tocar no áudio nem na interface.
 */

/* Padrões por célula, em colcheias (1 = ataque, 0 = silêncio). */
export const PADROES = {
  1: [1, 0],
  2: [1, 1, 0],
  3: [1, 1, 1, 0],
};

export const COLCHEIAS_POR_SEMINIMA = 2;

export const CARACTERES_VALIDOS = [1, 2, 3];

/** Gera o padrão de ataques (1) e silêncios (0) de uma célula. */
export function gerarPadrao(numero) {
  return PADROES[numero].slice();
}

/**
 * Analisa o texto da sequência.
 * Devolve { ok: true, celulas: [número, ...] } ou
 * { ok: false, erro: mensagem }.
 */
export function analisarSequencia(texto) {
  const tokens = texto
    .replace(/\+/g, ' ')
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return { ok: false, erro: 'Escreve pelo menos um número (1, 2 ou 3).' };
  }

  const celulas = [];
  for (const token of tokens) {
    if (!/^[1-3]$/.test(token)) {
      return {
        ok: false,
        erro: `«${token}» não é válido. Usa apenas 1, 2 ou 3, separados por «+».`,
      };
    }
    celulas.push(Number(token));
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
    const padrao = gerarPadrao(celula);
    padrao.forEach((valor, pos) => {
      pulsoes.push(valor);
      celulaDoPulso.push(indice);
      posicaoNaCelula.push(pos);
    });
  });

  return { pulsoes, celulaDoPulso, posicaoNaCelula };
}
