/* Timbres — vogais como seletores de timbre.
 *
 * A, E, I, O, U escolhem timbres de percussão de altura indefinida,
 * todos sintetizados com a Web Audio API. Para acrescentar ou afinar
 * um timbre basta editar este registo.
 */

/* Vogais válidas, por ordem. */
export const VOGAIS = ['A', 'E', 'I', 'O', 'U'];

/* Definições de timbre.
 *  - tipo 'ruido': ruído branco filtrado por bandpass (freq, q),
 *    envelope exponencial de duração 'duracao'.
 *  - tipo 'ressonancia': oscilador com queda de pitch + click de ruído. */
export const TIMBRES = {
  A: {
    id: 'A',
    nome: 'Palma seca',
    tipo: 'ruido',
    frequencia: 1100,
    q: 1.2,
    duracao: 0.045,
    ganho: 1.0,
  },
  E: {
    id: 'E',
    nome: 'Bloco de madeira',
    tipo: 'ruido',
    frequencia: 600,
    q: 3.0,
    duracao: 0.06,
    ganho: 1.0,
  },
  I: {
    id: 'I',
    nome: 'Estalo',
    tipo: 'ruido',
    frequencia: 2600,
    q: 0.8,
    duracao: 0.02,
    ganho: 0.9,
  },
  O: {
    id: 'O',
    nome: 'Clave',
    tipo: 'ressonancia',
    frequencia: 1700,
    q: 8.0,
    duracao: 0.08,
    ganho: 0.8,
  },
  U: {
    id: 'U',
    nome: 'Tambor profundo',
    tipo: 'ressonancia',
    frequencia: 200,
    q: 2.0,
    duracao: 0.22,
    ganho: 1.0,
  },
};

export const VOGAL_PADRAO = 'A';
