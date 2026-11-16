"""Gera a narração do vídeo com o Kokoro (TTS de código aberto, Apache 2.0).

Uso: python3 narrar.py MODELO.onnx VOZES.npz VOZ SAIDA.wav
  VOZ: pm_alex (masculina), pf_dora (feminina) ou pm_santa.

Cada fala começa no instante da legenda correspondente em index.html.
Se uma fala não couber na sua janela, a velocidade dela sobe até caber.
Requer: pip install kokoro-onnx soundfile
"""
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

DURATION = 30.0
VELOCIDADE = 1.2  # ritmo base, acelerado como é comum em vídeos curtos
# (início, fim da janela, texto falado)
FALAS = [
    (0.3, 3.5, "Onde está o seu dinheiro de verdade?"),
    (3.8, 9.0, "Antes, cada nota era um recibo de ouro, guardado no cofre."),
    (9.15, 12.0, "Em setenta e um, os americanos cortaram esse laço."),
    (12.1, 14.0, "Isso se chama moeda fiduciária."),
    (14.2, 17.85, "De todo o dinheiro do mundo, só oito por cento é papel e moeda."),
    (18.0, 20.5, "O resto são números em computadores."),
    (20.6, 23.0, "E o ouro? A onça valia trinta e cinco dólares."),
    (23.1, 26.0, "Hoje, passa de três mil. Cada vez mais longe."),
    (26.15, 28.3, "O dinheiro não é ouro. É confiança."),
    (28.45, 29.95, "E você, confia em quê?"),
]


def aparar(x, sr, limiar=0.01, margem=0.03):
    """Remove o silêncio do começo e do fim."""
    idx = np.where(np.abs(x) > limiar)[0]
    if len(idx) == 0:
        return x
    m = int(margem * sr)
    return x[max(0, idx[0] - m): idx[-1] + m]


def main():
    modelo, vozes, voz, saida = sys.argv[1:5]
    tts = Kokoro(modelo, vozes)
    sr = 24000
    faixa = np.zeros(int(DURATION * sr), dtype=np.float32)
    for ini, fim, texto in FALAS:
        vel = VELOCIDADE
        while True:
            audio, sr = tts.create(texto, voice=voz, speed=vel, lang="pt-br")
            audio = aparar(audio, sr)
            dur = len(audio) / sr
            if dur <= fim - ini or vel >= 1.5:
                break
            vel = min(1.5, vel * dur / (fim - ini) + 0.02)
        print(f"{ini:5.1f}s  janela {fim - ini:.2f}s  fala {dur:.2f}s  vel {vel:.2f}  {texto}")
        a = int(ini * sr)
        audio = audio[: len(faixa) - a]
        faixa[a: a + len(audio)] += audio
    pico = np.abs(faixa).max()
    if pico > 0:
        faixa *= 0.9 / pico
    sf.write(saida, faixa, sr)


if __name__ == "__main__":
    main()
