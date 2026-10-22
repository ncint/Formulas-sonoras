/* Interpretação da sequência de células rítmicas.
 *
 * Regras (versão 1):
 *  - Cada célula tem DURACAO_CELULA pulsações iguais.
 *  - O número n produz n ataques consecutivos no início da célula,
 *    seguidos de silêncio até completar a célula.
 *  - As células são reproduzidas pela ordem escrita; a sequência
 *    completa repete-se em ciclo.
 *  - "+" é um separador visual opcional; espaços e vírgulas também
 *    são aceites como separadores.
 *
 * Para alterar as durações ou os padrões no futuro basta mudar
 * gerarPadrao / DURACAO_CELULA sem tocar no áudio nem na interface.
 */

export const DURACAO_CELULA = 4;

export const CARACTERES_VALIDOS = [1, 2, 3];

/** Gera o padrão de ataques (1) e silêncios (0) de uma célula. */
export function gerarPadrao(numero) {
  const padrao = new Array(DURACAO_CELULA).fill(0);
  for (let i = 0; i < numero && i < DURACAO_CELULA; i++) padrao[i] = 1;
  return padrao;
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

/** Expande a sequência de células numa lista de pulsações (1 ataque / 0 silêncio). */
export function expandirPulsoes(celulas) {
  const pulsoes = [];
  for (const celula of celulas) {
    for (const valor of gerarPadrao(celula)) pulsoes.push(valor);
  }
  return pulsoes;
}
