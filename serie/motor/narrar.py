"""Grava a narração de um vídeo e calcula a linha do tempo.

Uso: python3 narrar.py MODELO.onnx VOZES.npz PASTA_DO_VIDEO PASTA_DE_TRABALHO

Lê PASTA_DO_VIDEO/roteiro.json, sintetiza cada fala com o Kokoro (TTS aberto,
Apache 2.0) nas vozes masculina e feminina e gera:
  PASTA_DE_TRABALHO/pm_alex.wav e pf_dora.wav  - narrações completas
  PASTA_DO_VIDEO/dados.js                      - roteiro + tempos para o motor
Requer: pip install kokoro-onnx soundfile
"""
import hashlib
import json
import math
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOZES = ["pm_alex", "pf_dora"]
VELOCIDADE = 1.15
PAUSA_FALA = 0.22
PAUSA_CENA = 0.6
RESPIRO = 0.3
COMPASSO = 2.5  # 96 bpm: a trilha fecha em compassos inteiros


def aparar(x, sr, limiar=0.01, margem=0.03):
    idx = np.where(np.abs(x) > limiar)[0]
    if len(idx) == 0:
        return x
    m = int(margem * sr)
    return x[max(0, idx[0] - m): idx[-1] + m]


def main():
    modelo, vozes, pasta, trabalho = sys.argv[1:5]
    rt = json.load(open(os.path.join(pasta, "roteiro.json"), encoding="utf-8"))
    falas_rt = rt["falas"]
    global VOZES
    VOZES = rt.get("vozes", VOZES)  # vozes do narrador (uma versão de vídeo por voz)
    tts = None
    sr = 24000
    cache = os.path.join(trabalho, "cache")
    os.makedirs(cache, exist_ok=True)
    clipes = {v: [] for v in VOZES}
    for v in VOZES:
        for item in falas_rt:
            vel = item.get("vel", VELOCIDADE)
            voz = item.get("voz", v)  # personagem com voz própria
            chave = hashlib.sha1(f"{voz}|{vel}|{item['fala']}".encode()).hexdigest()[:16]
            arq = os.path.join(cache, chave + ".npy")
            if os.path.exists(arq):           # reaproveita falas que não mudaram
                clipes[v].append(np.load(arq))
                continue
            if tts is None:
                tts = Kokoro(modelo, vozes)
            audio, sr = tts.create(item["fala"], voice=voz, speed=vel, lang="pt-br")
            audio = aparar(audio, sr)
            np.save(arq, audio)
            clipes[v].append(audio)

    falas, cenas, t, silencios = [], {}, RESPIRO, []
    for i, item in enumerate(falas_rt):
        dur = max(len(clipes[v][i]) for v in VOZES) / sr
        if i > 0:
            t += PAUSA_CENA if item["cena"] != falas_rt[i - 1]["cena"] else PAUSA_FALA
            t += item.get("pausa", 0)
        if item["cena"] not in cenas:
            cenas[item["cena"]] = 0.0 if i == 0 else round(t - RESPIRO, 3)
            t += item.get("atraso", 0)
        legs = item.get("legendas") or [item["fala"]]
        total = sum(len(x) for x in legs)
        legendas, a = [], t
        for x in legs:
            b = a + dur * len(x) / total
            legendas.append({"s": round(a, 3), "e": round(b, 3), "t": x})
            a = b
        legendas[-1]["e"] = round(t + dur + PAUSA_FALA * 0.8, 3)
        falas.append({"cena": item["cena"], "s": round(t, 3), "e": round(t + dur, 3), "legendas": legendas})
        t += dur
        if item.get("suspense"):  # silêncio dramático depois da fala (a trilha some)
            silencios.append([round(t, 3), round(t + item["suspense"], 3)])
            t += item["suspense"]
    n_cenas = len(rt["cenas"])
    assert sorted(cenas) == list(range(n_cenas)), f"cenas sem fala: {set(range(n_cenas)) - set(cenas)}"
    duracao = math.ceil((t + rt.get("cauda", 1.2)) / COMPASSO) * COMPASSO
    tempos = {"duracao": duracao, "cenas": [cenas[i] for i in range(n_cenas)], "falas": falas,
              "silencios": silencios, "vozes": VOZES,
              "secoes": [cenas[i] for i in range(n_cenas) if rt["cenas"][i].get("capitulo")]}
    with open(os.path.join(pasta, "dados.js"), "w", encoding="utf-8") as f:
        f.write("// Gerado por narrar.py a partir de roteiro.json. Não edite à mão.\n")
        f.write("window.ROTEIRO = " + json.dumps(rt, ensure_ascii=False) + ";\n")
        f.write("window.TEMPOS = " + json.dumps(tempos, ensure_ascii=False) + ";\n")
    os.makedirs(trabalho, exist_ok=True)
    json.dump(tempos, open(os.path.join(trabalho, "tempos.json"), "w"), ensure_ascii=False)
    for v in VOZES:
        faixa = np.zeros(int(duracao * sr), dtype=np.float32)
        for f_, c in zip(falas, clipes[v]):
            a = int(f_["s"] * sr)
            faixa[a: a + len(c)] += c[: len(faixa) - a]
        faixa *= 0.9 / np.abs(faixa).max()
        sf.write(os.path.join(trabalho, v + ".wav"), faixa, sr)
    for f_ in falas:
        print(f"{f_['s']:6.2f}s  {f_['e'] - f_['s']:5.2f}s  cena {f_['cena']}  {f_['legendas'][0]['t'][:55]}")
    print(f"duração: {duracao:.1f}s")


if __name__ == "__main__":
    main()
