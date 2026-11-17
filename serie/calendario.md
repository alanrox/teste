# Sequência editorial — série de educação financeira

Um vídeo por dia, na ordem abaixo. Cada vídeo termina com o selo "AMANHÃ: …"
anunciando o próximo, então mudar a ordem exige gerar de novo o vídeo anterior.

A sequência vai do mais básico ao mais avançado e alterna temas para manter
a variedade: conceitos que se apoiam uns nos outros ficam próximos
(Selic → CDI → IR → juro real), e vídeos de dívidas e orçamento entram no
meio para quebrar a sequência de investimentos.

| Dia | Pasta | Vídeo | Série |
|---|---|---|---|
| 1 | `01-juros-compostos` | Juros compostos | Fundamentos |
| 2 | `02-inflacao` | Inflação | Fundamentos |
| 3 | `03-reserva-de-emergencia` | Reserva de emergência | Renda fixa |
| 4 | `04-rotativo-do-cartao` | Rotativo do cartão | Dívidas |
| 5 | `05-selic` | Selic | Fundamentos |
| 6 | `06-cdi` | CDI | Fundamentos |
| 7 | `07-ir-regressivo` | IR regressivo | Renda fixa |
| 8 | `08-juro-real` | Juro real | Fundamentos |
| 9 | `09-liquidez` | Liquidez | Fundamentos |
| 10 | `10-tres-tesouros` | Selic, Prefixado ou IPCA+ | Renda fixa |
| 11 | `11-sem-juros` | "Sem juros" | Dívidas |
| 12 | `12-regra-50-30-20` | Regra 50-30-20 | Comportamento |
| 13 | `13-marcacao-a-mercado` | Marcação a mercado | Renda fixa |
| 14 | `14-iof` | IOF | Renda fixa |
| 15 | `15-acoes` | Ações | Renda variável |
| 16 | `16-dividendos` | Dividendos | Renda variável |
| 17 | `17-fundos-imobiliarios` | Fundos imobiliários | Renda variável |
| 18 | `18-etf` | ETF | Renda variável |
| 19 | `19-diversificacao` | Diversificação | Renda variável |
| 20 | `20-risco-e-retorno` | Risco e retorno | Renda variável |
| 21 | `21-piramide` | Pirâmide financeira | Dívidas e armadilhas |
| 22 | `22-credito-privado` | Crédito privado | Renda fixa |
| 23 | `23-taxas` | Taxas | Dívidas e armadilhas |
| 24 | `24-financiar-ou-juntar` | Financiar, consórcio ou juntar | Dívidas |
| 25 | `25-score` | Score de crédito | Dívidas |
| 26 | `26-aporte-mensal` | Aporte x valor inicial | Comportamento |
| 27 | `27-estilo-de-vida` | Inflação do estilo de vida | Comportamento |
| 28 | `28-pequenos-gastos` | Pequenos gastos | Comportamento |
| 29 | `29-pgbl-vgbl` | PGBL ou VGBL | Planejamento |
| 30 | `30-independencia-financeira` | Independência financeira | Planejamento |

O vídeo já pronto sobre Tesouro, CDB, LCI e LCA (`video-renda-fixa`) encaixa
bem entre os dias 6 e 7, como apoio ao vídeo do IR regressivo.

## Padrões fixos da série
- Cores dos personagens 1 a 4: azul, verde, amarelo, laranja.
- Produtos: Tesouro azul, CDB verde, LCI amarelo, LCA laranja.
- Gancho e contas em fundo escuro; histórias em cenário claro (campo ou cidade).
- Conceito nomeado com "Isso se chama…" depois do exemplo.
- Pergunta final numerada e selo "AMANHÃ".

## Como produzir um vídeo
```
MODELO=.../model_q8.onnx VOZES=.../voices.npz TRABALHO=/pasta/temporaria \
  motor/produzir.sh videos/01-juros-compostos
```
Gera `videos/NN-nome/NN-nome.mp4` (voz masculina) e `NN-nome-voz-feminina.mp4`.
Título e descrição de cada vídeo ficam em `videos/NN-nome/publicacao.md`.
