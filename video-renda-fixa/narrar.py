"""Grava a narração e calcula a linha do tempo do vídeo.

Uso: python3 narrar.py MODELO.onnx VOZES.npz PASTA_SAIDA

Lê roteiro.json, sintetiza cada fala com o Kokoro (TTS aberto, Apache 2.0)
nas vozes masculina e feminina e gera:
  PASTA_SAIDA/pm_alex.wav e pf_dora.wav  - narrações completas
  tempos.json / tempos.js                - início e fim de cada fala, cenas e eventos

A animação (index.html) e o som (sonorizar.py) leem esses tempos, então
imagem, voz e efeitos ficam sincronizados mesmo se o roteiro mudar.
Requer: pip install kokoro-onnx soundfile
"""
import json
import math
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

AQUI = os.path.dirname(os.path.abspath(__file__))
VOZES = ["pm_alex", "pf_dora"]
VELOCIDADE = 1.15
PAUSA_FALA = 0.22      # entre falas da mesma cena
PAUSA_CENA = 0.6       # entre cenas
RESPIRO = 0.3          # imagem entra antes da fala
COMPASSO = 2.5         # a trilha fecha em compassos inteiros (96 bpm)


def aparar(x, sr, limiar=0.01, margem=0.03):
    idx = np.where(np.abs(x) > limiar)[0]
    if len(idx) == 0:
        return x
    m = int(margem * sr)
    return x[max(0, idx[0] - m): idx[-1] + m]


def main():
    modelo, vozes, saida = sys.argv[1:4]
    roteiro = json.load(open(os.path.join(AQUI, "roteiro.json"), encoding="utf-8"))
    tts = Kokoro(modelo, vozes)
    sr = 24000
    clipes = {v: [] for v in VOZES}
    for v in VOZES:
        for item in roteiro:
            audio, sr = tts.create(item["fala"], voice=v, speed=VELOCIDADE, lang="pt-br")
            clipes[v].append(aparar(audio, sr))

    # Cada fala ocupa o tempo da voz mais lenta, para um só vídeo servir às duas.
    falas, t, cenas = [], RESPIRO, {}
    for i, item in enumerate(roteiro):
        dur = max(len(clipes[v][i]) for v in VOZES) / sr
        if i > 0:
            t += PAUSA_CENA if item["cena"] != roteiro[i - 1]["cena"] else PAUSA_FALA
        if item["cena"] not in cenas:
            cenas[item["cena"]] = 0.0 if i == 0 else round(t - RESPIRO, 3)
        # legendas dividem o tempo da fala proporcionalmente ao tamanho do texto
        total = sum(len(x) for x in item["legendas"])
        legendas, a = [], t
        for x in item["legendas"]:
            b = a + dur * len(x) / total
            legendas.append({"s": round(a, 3), "e": round(b, 3), "t": x})
            a = b
        legendas[-1]["e"] = round(t + dur + PAUSA_FALA * 0.8, 3)
        falas.append({"cena": item["cena"], "s": round(t, 3), "e": round(t + dur, 3), "legendas": legendas})
        print(f"{t:6.2f}s  {dur:5.2f}s  {item['legendas'][0][:50]}")
        t += dur
    duracao = math.ceil((t + 0.9) / COMPASSO) * COMPASSO

    def em(i, fracao):  # instante dentro da fala i (1 = primeira)
        f = falas[i - 1]
        return round(f["s"] + (f["e"] - f["s"]) * fracao, 3)

    eventos = {
        # gancho: cada sigla aparece quando é dita
        "p_tesouro": em(1, 0.0), "p_cdb": em(1, 0.2), "p_lci": em(1, 0.38), "p_lca": em(1, 0.54), "sopa": em(1, 0.7),
        # premissa
        "vai": em(2, 0.33), "volta": em(2, 0.64), "quem": em(3, 0.1),
        # ciclos: dinheiro vai, (banco repassa), nome é dito
        "c1_vai": em(4, 0.08), "c1_nome": em(4, 0.52),
        "c2_vai": em(5, 0.08), "c2_nome": em(5, 0.55),
        "c3_vai": em(6, 0.05), "c3_repassa": em(6, 0.38), "c3_nome": em(6, 0.8),
        "c4_vai": em(7, 0.05), "c4_repassa": em(7, 0.3), "c4_nome": em(7, 0.7),
        # imposto
        "ir": em(8, 0.55), "isenta": em(9, 0.3), "preso": em(9, 0.46),
        # proteção
        "quebra": em(10, 0.2), "fgc": em(10, 0.42), "mil": em(10, 0.62), "governo": em(11, 0.45),
        # final
        "escolher": em(12, 0.45), "votar": em(13, 0.1),
    }
    tempos = {"duracao": duracao, "cenas": cenas, "falas": falas, "eventos": eventos}
    json.dump(tempos, open(os.path.join(AQUI, "tempos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(os.path.join(AQUI, "tempos.js"), "w", encoding="utf-8") as f:
        f.write("// Gerado por narrar.py. Não edite à mão.\nwindow.TEMPOS = " + json.dumps(tempos, ensure_ascii=False) + ";\n")

    os.makedirs(saida, exist_ok=True)
    for v in VOZES:
        faixa = np.zeros(int(duracao * sr), dtype=np.float32)
        for f, c in zip(falas, clipes[v]):
            a = int(f["s"] * sr)
            faixa[a: a + len(c)] += c
        faixa *= 0.9 / np.abs(faixa).max()
        sf.write(os.path.join(saida, v + ".wav"), faixa, sr)
    print(f"duração do vídeo: {duracao:.1f}s")


if __name__ == "__main__":
    main()
