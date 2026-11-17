"""Cria a trilha sonora e os efeitos do vídeo e mistura com a narração.

Uso: python3 sonorizar.py NARRACAO.wav SAIDA.wav

Reaproveita os sons sintetizados de ../video-dinheiro-virtual/sonorizar.py
(nenhum arquivo de áudio externo é usado) e posiciona cada efeito nos
instantes de tempos.json, os mesmos que a animação usa.
Requer: pip install numpy scipy soundfile
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "video-dinheiro-virtual"))
import sonorizar as som  # noqa: E402

SR = som.SR
TP = json.load(open(os.path.join(AQUI, "tempos.json"), encoding="utf-8"))
DUR, EV, CENA = TP["duracao"], TP["eventos"], TP["cenas"]
N = int(SR * DUR)
por, pop, sino, sopro, baque, tique = som.por, som.pop, som.sino, som.sopro, som.baque, som.tique


def trilha():
    """Mesma base do primeiro vídeo: 96 bpm, Dó – Lá menor – Fá – Sol."""
    batida = 60 / 96
    compasso = 4 * batida
    acordes = [("C3", ["C4", "E4", "G4"]), ("A2", ["A3", "C4", "E4"]),
               ("F2", ["F3", "A3", "C4"]), ("G2", ["G3", "B3", "D4"])]
    m = np.zeros(N + SR)
    total = int(round(DUR / compasso))
    for c in range(total):
        baixo, notas = acordes[c % 4]
        ini = c * compasso
        por(m, som.almofada([som.hz(n) for n in notas], compasso + 0.5), ini, 0.30)
        for b in (0, 2):
            t = som.t_(batida * 1.6)
            por(m, som.bordas(np.sin(2 * np.pi * som.hz(baixo) * t) * np.exp(-t / 0.5)), ini + b * batida, 0.42)
        # arpejo ralo no gancho, cheio no meio e variado na segunda metade
        if c < 2:
            padrao = [0, None, 2, None, 1, None, 2, None]
        elif (c // 4) % 2 == 0:
            padrao = [0, 1, 2, 1, 0, 2, 1, 2]
        else:
            padrao = [2, 1, 0, 1, 2, 0, 1, 0]
        for i, p in enumerate(padrao):
            if p is not None:
                por(m, som.marimba(som.hz(notas[p]) * 2), ini + i * batida / 2, 0.20 if i % 2 == 0 else 0.13)
    m = som.filtro(m[:N], "lowpass", 5200)
    k = np.arange(N)
    return m * np.minimum(k / (0.6 * SR), 1) * np.minimum((N - k) / (1.5 * SR), 1)


def moedas(e, inicio, ganho=0.26):
    for i in range(3):
        por(e, sino(1568 + i * 180, 0.35), inicio + i * 0.1, ganho)


def efeitos():
    e = np.zeros(N)
    for nome, ini in CENA.items():                       # trocas de cena
        if ini > 0:
            por(e, sopro(), ini - 0.25, 0.55)

    # gancho: cada sigla que aparece
    for i, k in enumerate(("p_tesouro", "p_cdb", "p_lci", "p_lca")):
        por(e, pop(420 + i * 70), EV[k], 0.5)
    por(e, pop(760), EV["sopa"], 0.5)
    por(e, pop(640), EV["sopa"] + 0.1, 0.4)

    # premissa: dinheiro vai e volta com juros
    por(e, pop(520), CENA["premissa"] + 0.1, 0.4)
    por(e, sopro(0.5), EV["vai"], 0.28)
    por(e, sopro(0.5, sobe=False), EV["volta"], 0.28)
    moedas(e, EV["volta"] + 0.75)
    por(e, pop(700), EV["quem"], 0.55)

    # ciclos
    for n in (1, 2, 3, 4):
        por(e, pop(520), CENA[f"c{n}"] + 0.05, 0.35)
        por(e, sopro(0.45), EV[f"c{n}_vai"], 0.28)
        por(e, baque(), EV[f"c{n}_vai"] + 0.78, 0.3)      # dinheiro entra no prédio
        if n >= 3:
            por(e, sopro(0.45), EV[f"c{n}_repassa"], 0.24)
        nome = EV[f"c{n}_nome"]
        moedas(e, nome + 0.3)
        por(e, pop(600 + n * 40), nome, 0.55)             # nome do produto
        por(e, sino(som.hz(("C5", "D5", "E5", "G5")[n - 1]) * 2, 0.8), nome + 0.02, 0.3)

    # imposto
    por(e, pop(520), CENA["imposto"] + 0.1, 0.45)
    for i in range(4):
        por(e, tique(1300 + i * 150), CENA["imposto"] + 0.25 + i * 0.1, 0.35)
    for i in range(2):
        por(e, som.tesoura(), EV["ir"] + i * 0.15, 0.4)   # o pedaço da nota é cortado
    for i in range(2):
        por(e, baque(), EV["isenta"] + i * 0.2, 0.7)      # carimbo ISENTA
        por(e, tique(900), EV["preso"] + i * 0.15, 0.5)   # cadeado
        por(e, tique(650), EV["preso"] + i * 0.15 + 0.05, 0.5)

    # proteção
    por(e, pop(520), CENA["protecao"] + 0.1, 0.45)
    por(e, som.deslize(0.5), EV["quebra"], 0.3)           # banco rachando
    por(e, baque(), EV["quebra"] + 0.45, 0.8)
    por(e, pop(500), EV["fgc"], 0.5)                      # escudo
    por(e, sino(784, 1.0), EV["fgc"] + 0.03, 0.3)
    por(e, sino(1175, 1.0), EV["fgc"] + 0.03, 0.2)
    for j in range(3):
        por(e, pop(620 + j * 60), EV["fgc"] + 0.2 + j * 0.1, 0.3)
    por(e, pop(700), EV["mil"], 0.5)
    por(e, sino(2093, 0.9), EV["mil"] + 0.03, 0.34)
    por(e, pop(600), EV["governo"] - 0.6, 0.45)

    # final
    por(e, pop(520), CENA["final"] + 0.1, 0.45)
    por(e, pop(680), EV["escolher"], 0.5)
    for i, n in enumerate(("C5", "E5", "G5", "C6")):      # círculos 1 a 4
        por(e, pop(520 + i * 80), EV["votar"] + i * 0.32, 0.4)
        por(e, sino(som.hz(n) * 2, 0.6), EV["votar"] + i * 0.32, 0.3)
    por(e, sino(som.hz("E6") * 2, 1.1), EV["votar"] + 4 * 0.32 + 0.1, 0.2)
    return e


def main():
    entrada, saida = sys.argv[1:3]
    voz, sr = sf.read(entrada, dtype="float32")
    if voz.ndim > 1:
        voz = voz.mean(axis=1)
    if sr != SR:
        voz = resample_poly(voz, SR, sr)
    voz = np.pad(voz, (0, max(0, N - len(voz))))[:N]
    voz = voz / np.abs(voz).max() * 0.85

    musica = trilha()
    musica *= 0.11 / np.abs(musica).max()
    fx = efeitos()
    fx *= 0.30 / np.abs(fx).max()

    fala = som.envelope(voz)                              # trilha e efeitos abaixam na fala
    musica_d = musica * (1 - 0.5 * fala)
    fx_d = fx * (1 - 0.35 * fala)
    mix = voz + musica_d + fx_d
    mix = np.tanh(mix * 1.05) / np.tanh(1.05) * 0.95
    print(f"voz {som.rms_db(voz):.1f} dB | trilha {som.rms_db(musica_d):.1f} dB | "
          f"efeitos {som.rms_db(fx_d):.1f} dB | pico {np.abs(mix).max():.2f}")
    sf.write(saida, np.column_stack([mix, mix]), SR)


if __name__ == "__main__":
    main()
