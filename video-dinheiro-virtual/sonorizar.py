"""Cria a trilha sonora e os efeitos do vídeo e mistura com a narração.

Uso: python3 sonorizar.py NARRACAO.wav SAIDA.wav

Tudo é sintetizado por código (numpy/scipy): nenhum arquivo de áudio externo
é usado, então não há questão de direitos autorais.
Os instantes dos efeitos seguem a animação em index.html.
Requer: pip install numpy scipy soundfile
"""
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

SR = 44100
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(7)


# ---------- blocos básicos ----------
def t_(d):
    return np.arange(int(d * SR)) / SR


def filtro(x, tipo, freq, ordem=2):
    return sosfilt(butter(ordem, freq, btype=tipo, fs=SR, output="sos"), x)


def por(faixa, som, inicio, ganho=1.0):
    """Soma `som` em `faixa` a partir de `inicio` segundos."""
    a = int(inicio * SR)
    if a >= len(faixa) or a < 0:
        return
    som = som[: len(faixa) - a]
    faixa[a: a + len(som)] += som * ganho


def bordas(x, ataque=0.005, soltura=0.02):
    """Evita cliques no começo e no fim de um som."""
    a, s = int(ataque * SR), int(soltura * SR)
    x = x.copy()
    x[:a] *= np.linspace(0, 1, a)
    x[-s:] *= np.linspace(1, 0, s)
    return x


# ---------- efeitos ----------
def pop(f=520.0):
    """'Bloop' curto para elementos que surgem na tela."""
    t = t_(0.16)
    freq = f * (1 + 0.9 * np.minimum(t / 0.07, 1))
    return bordas(np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.045))


def tique(f=1700.0):
    t = t_(0.03)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.006)


def sino(f=1320.0, dur=0.9):
    """Tilintar metálico (moeda, ouro, destaque)."""
    t = t_(dur)
    x = sum(a * np.sin(2 * np.pi * f * p * t) * np.exp(-t / (0.28 / p ** 0.6))
            for p, a in [(1, 1.0), (2.76, 0.45), (5.4, 0.2)])
    return bordas(x / 1.65)


def sopro(dur=0.45, sobe=True):
    """Passagem de ar para as trocas de cena."""
    t = t_(dur)
    r = rng.standard_normal(len(t))
    grave, agudo = filtro(r, "bandpass", [250, 900]), filtro(r, "bandpass", [1200, 5000])
    k = t / dur if sobe else 1 - t / dur
    return bordas((grave * (1 - k) + agudo * k) * np.sin(np.pi * t / dur) ** 2, 0.02, 0.05)


def baque():
    """Batida grave (carimbo, porta do cofre)."""
    t = t_(0.3)
    freq = 95 * np.exp(-t / 0.09) + 42
    corpo = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.08)
    estalo = filtro(rng.standard_normal(len(t)), "lowpass", 1800) * np.exp(-t / 0.012) * 0.5
    return bordas(corpo + estalo)


def tesoura():
    t = t_(0.2)
    r = filtro(rng.standard_normal(len(t)), "highpass", 3500)
    env = np.exp(-t / 0.012) + np.exp(-np.maximum(t - 0.08, 0) / 0.016) * (t >= 0.08)
    return bordas(r * env)


def deslize(dur=1.0):
    """Porta pesada correndo."""
    t = t_(dur)
    r = filtro(rng.standard_normal(len(t)), "bandpass", [110, 520])
    return bordas(r * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)), 0.08, 0.08)


def subida(dur=2.0, f0=260.0, f1=1150.0):
    """Tom que sobe junto com a barra de ouro."""
    t = t_(dur)
    k = t / dur
    k = np.where(k < 0.5, 4 * k ** 3, 1 - (-2 * k + 2) ** 3 / 2)  # mesma curva da animação
    freq = f0 * (f1 / f0) ** k
    fase = 2 * np.pi * np.cumsum(freq) / SR
    x = (np.sin(fase) + 0.3 * np.sin(2 * fase)) * (0.75 + 0.25 * np.sin(2 * np.pi * 11 * t))
    return bordas(x * np.sin(np.pi * t / dur) ** 0.6, 0.15, 0.15)


def cintilar(dur=1.4):
    """Brilhos digitais (a nota virando zeros e uns)."""
    x = np.zeros(int(dur * SR))
    for _ in range(26):
        f = rng.uniform(1800, 4800)
        por(x, tique(f) * rng.uniform(0.4, 1.0), rng.uniform(0, dur - 0.05))
    return x


# ---------- trilha sonora ----------
NOTA = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(
    ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4"])}


def hz(nome):
    base, oit = nome[:-1], int(nome[-1])
    return NOTA[base + "4"] * 2 ** (oit - 4)


def marimba(f, dur=0.9):
    t = t_(dur)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.22) + 0.25 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.05)
    return bordas(x, 0.003, 0.05)


def almofada(freqs, dur):
    t = t_(dur)
    x = sum(np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.004 * t) for f in freqs)
    env = np.minimum(t / 0.5, 1) * np.minimum((dur - t) / 0.5, 1)
    return x * env / len(freqs)


def trilha():
    """12 compassos a 96 bpm (exatos 30 s): Dó – Lá menor – Fá – Sol."""
    batida = 60 / 96
    compasso = 4 * batida
    acordes = [("C3", ["C4", "E4", "G4"]), ("A2", ["A3", "C4", "E4"]),
               ("F2", ["F3", "A3", "C4"]), ("G2", ["G3", "B3", "D4"])]
    m = np.zeros(N + SR)
    for c in range(12):
        baixo, notas = acordes[c % 4]
        ini = c * compasso
        por(m, almofada([hz(n) for n in notas], compasso + 0.5), ini, 0.30)
        for b in (0, 2):  # baixo suave nos tempos 1 e 3
            t = t_(batida * 1.6)
            por(m, bordas(np.sin(2 * np.pi * hz(baixo) * t) * np.exp(-t / 0.5)), ini + b * batida, 0.42)
        # arpejo em colcheias; começa mais ralo e ganha corpo depois do gancho
        padrao = [0, 1, 2, 1, 0, 2, 1, 2] if c >= 2 else [0, None, 2, None, 1, None, 2, None]
        for i, p in enumerate(padrao):
            if p is None:
                continue
            f = hz(notas[p]) * 2
            por(m, marimba(f), ini + i * batida / 2, 0.20 if i % 2 == 0 else 0.13)
    m = m[:N]
    m = filtro(m, "lowpass", 5200)
    env = np.minimum(np.arange(N) / (0.6 * SR), 1) * np.minimum((N - np.arange(N)) / (1.3 * SR), 1)
    return m * env


# ---------- efeitos na linha do tempo ----------
def efeitos():
    e = np.zeros(N)
    # trocas de cena
    for corte in (3.5, 14.0, 20.5, 26.0):
        por(e, sopro(), corte - 0.25, 0.55)

    # 1. gancho
    por(e, pop(440), 0.15, 0.5)
    por(e, pop(520), 0.5, 0.5)
    por(e, pop(700), 1.1, 0.55)
    por(e, cintilar(), 1.6, 0.16)

    # 2. o recibo de ouro
    por(e, pop(520), 3.7, 0.45)
    por(e, deslize(0.9), 4.0, 0.22)                    # cofre abre
    por(e, pop(600), 4.5, 0.4)                         # etiqueta RECIBO
    por(e, subida(1.3, 500, 900), 5.1, 0.07)           # laço sendo desenhado
    por(e, sino(1568), 6.35, 0.4)                      # chega ao ouro

    # 3. 1971
    por(e, baque(), 9.3, 0.9)                          # carimbo
    por(e, tesoura(), 9.72, 0.45)                      # corte do laço
    por(e, deslize(1.0), 10.4, 0.3)                    # cofre fecha
    por(e, baque(), 11.38, 0.75)
    por(e, pop(600), 11.3, 0.35)
    por(e, pop(660), 11.7, 0.45)
    por(e, sino(1047, 0.7), 11.75, 0.22)

    # 4. a grade de 100 quadrados
    por(e, pop(520), 14.1, 0.45)
    for i in range(34):                                # quadrados surgindo
        por(e, tique(1200 + i * 28), 14.4 + i * 0.036, 0.22)
    for i in range(8):                                 # os 8% viram papel
        por(e, sino(1568 + i * 60, 0.25), 16.2 + i * 0.06, 0.2)
    por(e, pop(620), 16.7, 0.45)
    por(e, pop(700), 18.5, 0.45)
    por(e, pop(660), 19.2, 0.45)
    por(e, sino(1319, 0.7), 19.25, 0.22)

    # 5. o ouro se afasta
    por(e, pop(520), 20.6, 0.4)
    por(e, sino(1760), 20.75, 0.35)
    por(e, pop(620), 21.1, 0.4)
    por(e, subida(2.0), 22.9, 0.11)
    for i in range(24):                                # contador do preço
        k = i / 24
        por(e, tique(1500 + 900 * k), 23.0 + 1.8 * k ** 0.8, 0.13)
    por(e, sino(2093, 1.0), 24.9, 0.42)
    por(e, pop(660), 25.0, 0.4)

    # 6. moral e chamada final
    por(e, pop(520), 26.1, 0.45)
    for i, f in enumerate((560, 640, 720)):            # nota, celular, ouro
        por(e, pop(f), 26.6 + i * 0.2, 0.38)
    for i, n in enumerate(("C5", "E5", "G5")):         # círculos 1, 2, 3
        por(e, pop(520 + i * 90), 28.1 + i * 0.4, 0.4)
        por(e, sino(hz(n) * 2, 0.6), 28.1 + i * 0.4, 0.3)
    por(e, sino(hz("C6") * 2, 1.0), 29.05, 0.22)
    return e


def envelope(x, janela=0.05):
    """Volume da narração ao longo do tempo, entre 0 e 1."""
    n = int(janela * SR)
    env = np.sqrt(np.convolve(x ** 2, np.ones(n) / n, mode="same"))
    env = np.minimum(env / (np.percentile(env, 95) + 1e-9), 1)
    n2 = int(0.25 * SR)                                # suaviza a volta
    return np.minimum(np.convolve(env, np.ones(n2) / n2, mode="same") * 1.5, 1)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


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
    musica *= 0.11 / np.abs(musica).max() * 1.0
    fx = efeitos()
    fx *= 0.30 / np.abs(fx).max()

    # a trilha e os efeitos abaixam quando há fala
    fala = envelope(voz)
    musica_d = musica * (1 - 0.5 * fala)
    fx_d = fx * (1 - 0.35 * fala)

    mix = voz + musica_d + fx_d
    mix = np.tanh(mix * 1.05) / np.tanh(1.05) * 0.95   # limitador suave
    print(f"voz {rms_db(voz):.1f} dB | trilha {rms_db(musica_d):.1f} dB | efeitos {rms_db(fx_d):.1f} dB | pico {np.abs(mix).max():.2f}")
    sf.write(saida, np.column_stack([mix, mix]), SR)
    if len(sys.argv) > 3:                              # exporta as partes para conferência
        for nome, x in (("trilha", musica), ("efeitos", fx)):
            sf.write(f"{sys.argv[3]}/{nome}.wav", x, SR)


if __name__ == "__main__":
    main()
