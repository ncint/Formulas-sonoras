# Máquina de Caracteres Sonoros

Aplicação web musical experimental para criar sequências rítmicas
escrevendo números, com inspiração no minimalismo de Steve Reich
(*Clapping Music*, *Music for Pieces of Wood*).

## Como funciona

- Cada número (1, 2 ou 3) representa uma **célula rítmica** numa
  grade de colcheias:
  - **1** = semínima (duas colcheias, um ataque);
  - **2** = duas colcheias atacadas + pausa de colcheia;
  - **3** = três colcheias atacadas + pausa de colcheia.
- As células são reproduzidas pela ordem escrita e a sequência repete-se
  continuamente até carregar em **Parar**.
- O sinal **+** é um separador visual opcional.
- Som de percussão de altura indefinida gerado localmente com a
  **Web Audio API** (sem ficheiros de áudio, sem dependências),
  com identificador de timbre `palma-seca` (ver `js/audio.js`).

## Como executar

Abrir `index.html` num navegador moderno (computador ou telemóvel).
Não precisa de servidor, instalação, nem ligação a serviços externos
depois de carregada. Para GitHub Pages, publicar os ficheiros na raiz
da branch `main`.

## Estrutura

```
index.html      Página inicial com instruções e exemplo «2 + 3 + 1»
maquina.html    Máquina rítmica (entrada, visual, controlos)
css/           base.css, inicio.css, maquina.css
js/
  sequencia.js Interpretação da sequência e células rítmicas (regras musicais)
  audio.js     Motor de áudio (Web Audio API, timbre «palma-seca», agendamento com lookahead)
  main.js      Interface (liga entrada, áudio e visual)
```

## Notas técnicas (versão 1)

- O áudio só começa após interação explícita (regra dos navegadores).
- Agendamento com `setInterval` + lookahead sobre o relógio do
  `AudioContext`, para andamento estável e precisão rítmica.
- Um único ciclo ativo: **Tocar** reinicia; **Parar** interrompe de facto.
- Alterar a sequência durante a reprodução pára o ciclo antigo.
- Preparado para futura escrita à mão em mesa digitalizadora: a entrada
  é centralizada num único campo de texto (ver `js/main.js`); uma área
  de desenho poderá futuramente alimentar o mesmo fluxo.

## Próximos passos

- Área de desenho para escrita manual (mesa digitalizadora USB + projetor).
- Mais células/durações configuráveis.
- Células visíveis com padrão individual (pontos por pulsação).
