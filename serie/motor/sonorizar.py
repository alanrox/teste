"""Sintetiza a trilha e os efeitos de um vídeo e mistura com a narração.

Uso: python3 sonorizar.py TEMPOS.json SONS.json NARRACAO.wav SAIDA.wav [TOM]

SONS.json é gerado pelo motor (render.js): cada item diz o instante e o tipo
de efeito. Tudo é sintetizado por código; nenhum arquivo de áudio externo é
usado. TOM transpõe a trilha em semitons para variar entre os vídeos.
Requer: pip install numpy scipy soundfile
"""
import json
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

SR = 44100
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def filtro(x, tipo, freq, ordem=2):
    return sosfilt(butter(ordem, freq, btype=tipo, fs=SR, output="sos"), x)


def por(faixa, som, inicio, ganho=1.0):
    a = int(inicio * SR)
    if a >= len(faixa) or a < 0:
        return
    som = som[: len(faixa) - a]
    faixa[a: a + len(som)] += som * ganho


def bordas(x, ataque=0.005, soltura=0.02):
    a, s = int(ataque * SR), int(soltura * SR)
    x = x.copy()
    x[:a] *= np.linspace(0, 1, a)
    x[-s:] *= np.linspace(1, 0, s)
    return x


# ---------- efeitos ----------
def pop(f=520.0, **_):
    t = t_(0.16)
    freq = f * (1 + 0.9 * np.minimum(t / 0.07, 1))
    return bordas(np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.045))


def tique(f=1700.0, **_):
    t = t_(0.03)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.006)


def sino(f=1320.0, dur=0.9, **_):
    t = t_(dur or 0.9)
    x = sum(a * np.sin(2 * np.pi * f * p * t) * np.exp(-t / (0.28 / p ** 0.6))
            for p, a in [(1, 1.0), (2.76, 0.45), (5.4, 0.2)])
    return bordas(x / 1.65)


def sopro(dur=0.45, sobe=True, **_):
    dur = dur or 0.45
    t = t_(dur)
    r = rng.standard_normal(len(t))
    grave, agudo = filtro(r, "bandpass", [250, 900]), filtro(r, "bandpass", [1200, 5000])
    k = t / dur if sobe else 1 - t / dur
    return bordas((grave * (1 - k) + agudo * k) * np.sin(np.pi * t / dur) ** 2, 0.02, 0.05)


def baque(**_):
    t = t_(0.3)
    freq = 95 * np.exp(-t / 0.09) + 42
    corpo = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.08)
    estalo = filtro(rng.standard_normal(len(t)), "lowpass", 1800) * np.exp(-t / 0.012) * 0.5
    return bordas(corpo + estalo)


def tesoura(**_):
    t = t_(0.2)
    r = filtro(rng.standard_normal(len(t)), "highpass", 3500)
    env = np.exp(-t / 0.012) + np.exp(-np.maximum(t - 0.08, 0) / 0.016) * (t >= 0.08)
    return bordas(r * env)


def deslize(dur=1.0, **_):
    t = t_(dur or 1.0)
    r = filtro(rng.standard_normal(len(t)), "bandpass", [110, 520])
    return bordas(r * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)), 0.08, 0.08)


def subida(dur=2.0, f0=260.0, f1=1150.0, **_):
    dur = dur or 2.0
    t = t_(dur)
    k = t / dur
    k = np.where(k < 0.5, 4 * k ** 3, 1 - (-2 * k + 2) ** 3 / 2)
    freq = f0 * (f1 / f0) ** k
    fase = 2 * np.pi * np.cumsum(freq) / SR
    x = (np.sin(fase) + 0.3 * np.sin(2 * fase)) * (0.75 + 0.25 * np.sin(2 * np.pi * 11 * t))
    return bordas(x * np.sin(np.pi * t / dur) ** 0.6, 0.15, 0.15)


def descida(dur=2.0, **_):
    return subida(dur, 1000.0, 220.0)


def cintilar(dur=1.4, **_):
    dur = dur or 1.4
    x = np.zeros(int(dur * SR))
    for _ in range(26):
        por(x, tique(rng.uniform(1800, 4800)) * rng.uniform(0.4, 1.0), rng.uniform(0, dur - 0.05))
    return x


def caixa(**_):
    """'Ka-tching' de caixa registradora."""
    x = np.zeros(int(0.8 * SR))
    por(x, tique(2600), 0, 0.8)
    por(x, tique(3100), 0.05, 0.8)
    por(x, sino(2349, 0.7), 0.1, 0.9)
    por(x, sino(3136, 0.6), 0.12, 0.5)
    return x


def erro(**_):
    """Buzina curta de 'errado'."""
    t = t_(0.45)
    f = 180 - 40 * t
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5
    return bordas(filtro(x, "lowpass", 1200) * np.exp(-t / 0.3), 0.01, 0.08)


EFEITOS = {"pop": pop, "tique": tique, "sino": sino, "sopro": sopro, "baque": baque, "tesoura": tesoura,
           "deslize": deslize, "subida": subida, "descida": descida, "cintilar": cintilar,
           "caixa": caixa, "erro": erro}


# ---------- trilha ----------
NOMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def hz(nome, tom=0):
    base, oit = nome[:-1], int(nome[-1])
    return 440 * 2 ** ((NOMES.index(base) - 9 + tom) / 12 + (oit - 4))


def marimba(f, dur=0.9):
    t = t_(dur)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.22) + 0.25 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.05)
    return bordas(x, 0.003, 0.05)


def almofada(freqs, dur):
    t = t_(dur)
    x = sum(np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.004 * t) for f in freqs)
    env = np.minimum(t / 0.5, 1) * np.minimum((dur - t) / 0.5, 1)
    return x * env / len(freqs)


def pluck(f, dur=0.6):
    t = t_(dur)
    x = sum(np.sin(2 * np.pi * f * h * t) / h for h in (1, 2, 3, 4)) * np.exp(-t / 0.12)
    return bordas(filtro(x, "lowpass", 3000), 0.002, 0.05)


def campainha(f, dur=0.9):
    return sino(f, dur) * 0.8


def marimba_alta(f, dur=0.9):
    return marimba(f * 2, dur) * 0.7


def trilha(dur, tom=0, secoes=()):
    """96 bpm, Dó – Lá menor – Fá – Sol (transposto por `tom`).
    Em vídeos com capítulos, o instrumento do arpejo muda a cada capítulo."""
    timbres = [marimba, pluck, campainha, marimba_alta]
    n = int(SR * dur)
    batida = 60 / 96
    compasso = 4 * batida
    acordes = [("C3", ["C4", "E4", "G4"]), ("A2", ["A3", "C4", "E4"]),
               ("F2", ["F3", "A3", "C4"]), ("G2", ["G3", "B3", "D4"])]
    m = np.zeros(n + SR)
    for c in range(int(round(dur / compasso))):
        baixo, notas = acordes[c % 4]
        ini = c * compasso
        por(m, almofada([hz(x, tom) for x in notas], compasso + 0.5), ini, 0.30)
        for b in (0, 2):
            t = t_(batida * 1.6)
            por(m, bordas(np.sin(2 * np.pi * hz(baixo, tom) * t) * np.exp(-t / 0.5)), ini + b * batida, 0.42)
        if c < 2:
            padrao = [0, None, 2, None, 1, None, 2, None]
        elif (c // 4) % 2 == 0:
            padrao = [0, 1, 2, 1, 0, 2, 1, 2]
        else:
            padrao = [2, 1, 0, 1, 2, 0, 1, 0]
        for i, p in enumerate(padrao):
            if p is not None:
                sec = sum(1 for x in secoes if x <= ini + i * batida / 2 + 0.01)
                por(m, timbres[sec % 4](hz(notas[p], tom) * 2), ini + i * batida / 2, 0.20 if i % 2 == 0 else 0.13)
    m = filtro(m[:n], "lowpass", 5200)
    k = np.arange(n)
    return m * np.minimum(k / (0.6 * SR), 1) * np.minimum((n - k) / (1.5 * SR), 1)


# ---------- bateria e transições (vídeos longos) ----------
def kick():
    t = t_(0.35)
    f = 45 + 85 * np.exp(-t / 0.05)
    return bordas(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16))


def caixa_bateria():
    t = t_(0.22)
    ruido = filtro(rng.standard_normal(len(t)), "bandpass", [1200, 6000]) * np.exp(-t / 0.07)
    return bordas(0.7 * ruido + 0.5 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05))


def chimbal(aberto=False):
    t = t_(0.25 if aberto else 0.05)
    x = filtro(rng.standard_normal(len(t)), "highpass", 7000) * np.exp(-t / (0.09 if aberto else 0.015))
    return bordas(x, 0.001, 0.01)


def prato():
    t = t_(1.6)
    return bordas(filtro(rng.standard_normal(len(t)), "highpass", 4000) * np.exp(-t / 0.5), 0.002, 0.2)


def riser(dur=1.6):
    """Ruído que sobe de grave para agudo e cresce: prepara uma entrada."""
    t = t_(dur)
    k = t / dur
    r = rng.standard_normal(len(t))
    x = (filtro(r, "bandpass", [400, 1200]) * (1 - k) + filtro(r, "bandpass", [2500, 8000]) * k) * k ** 2
    return bordas(x, 0.05, 0.02)


PROG = {"maior": [("C3", ["C4", "E4", "G4"]), ("A2", ["A3", "C4", "E4"]), ("F2", ["F3", "A3", "C4"]), ("G2", ["G3", "B3", "D4"])],
        "menor": [("A2", ["A3", "C4", "E4"]), ("F2", ["F3", "A3", "C4"]), ("D2", ["D3", "F3", "A3"]), ("E2", ["E3", "G#3", "B3"])]}


def trilha_climas(dur, tom, climas, impactos, secoes):
    """Trilha com clima por trecho: leve (sem bateria), normal (bateria), tenso (menor,
    pulso grave) e final (um tom acima, bateria cheia), mais subidas e impactos nas entradas."""
    n = int(SR * dur)
    batida = 60 / 96
    compasso = 4 * batida
    m = np.zeros(n + 2 * SR)
    K, S, H, HA = kick(), caixa_bateria(), chimbal(), chimbal(True)
    timbres = [marimba, pluck, campainha, marimba_alta]

    def clima_em(t):
        atual = "leve"
        for a, c in climas:
            if a <= t + 0.01:
                atual = c
        return atual

    for c in range(int(round(dur / compasso))):
        ini = c * compasso
        cl = clima_em(ini)
        tt = tom + (2 if cl == "final" else 0)
        baixo, notas = PROG["menor" if cl == "tenso" else "maior"][c % 4]
        por(m, almofada([hz(x, tt) for x in notas], compasso + 0.5), ini,
            {"leve": 0.30, "normal": 0.24, "tenso": 0.32, "final": 0.28}[cl])

        def grave(at, g, dd=1.6):
            t = t_(batida * dd)
            por(m, bordas(np.sin(2 * np.pi * hz(baixo, tt) * t) * np.exp(-t / 0.5)), ini + at * batida, g)
        if cl == "leve":
            grave(0, 0.4, 3.5)
        elif cl == "tenso":
            for i in range(8):
                grave(i * 0.5, 0.30 if i % 2 == 0 else 0.2, 0.45)
        elif cl == "final":
            for a in (0, 1.5, 2, 3):
                grave(a, 0.42)
        else:
            for a in (0, 2):
                grave(a, 0.42)

        if cl == "leve":
            padrao = [0, None, 2, None, 1, None, 2, None]
        elif cl == "tenso":
            padrao = [0, None, 1, None, 2, None, 1, None]
        elif (c // 4) % 2 == 0:
            padrao = [0, 1, 2, 1, 0, 2, 1, 2]
        else:
            padrao = [2, 1, 0, 1, 2, 0, 1, 0]
        sec = sum(1 for x in secoes if x <= ini + 0.01)
        timbre = pluck if cl == "tenso" else marimba_alta if cl == "final" else timbres[sec % 4]
        for i, p in enumerate(padrao):
            if p is not None:
                por(m, timbre(hz(notas[p], tt) * 2), ini + i * batida / 2, 0.20 if i % 2 == 0 else 0.13)
        if cl == "final" and c % 2 == 0:
            por(m, campainha(hz(notas[0], tt) * 4, 0.8), ini, 0.08)

        if cl == "normal":
            for b in (0, 2):
                por(m, K, ini + b * batida, 0.55)
            for b in (1, 3):
                por(m, S, ini + b * batida, 0.28)
            for i in range(8):
                por(m, H, ini + i * batida / 2, 0.10 if i % 2 else 0.06)
        elif cl == "tenso":
            por(m, K, ini, 0.6)
            por(m, K, ini + 2.5 * batida, 0.45)
            por(m, S, ini + 2 * batida, 0.3)
        elif cl == "final":
            for b in range(4):
                por(m, K, ini + b * batida, 0.5)
            for b in (1, 3):
                por(m, S, ini + b * batida, 0.3)
            for i in range(8):
                por(m, HA if i % 2 else H, ini + i * batida / 2, 0.08 if i % 2 else 0.07)

    for ti in impactos:  # subida antes da cena e impacto na entrada
        por(m, riser(1.6), ti - 1.6, 0.35)
        por(m, K, ti, 0.9)
        por(m, prato(), ti, 0.25)
    m = filtro(m[:n], "lowpass", 9000)
    k = np.arange(n)
    return m * np.minimum(k / (0.6 * SR), 1) * np.minimum((n - k) / (1.5 * SR), 1)


def acorde_destaque(tom=0):
    """Acorde curto depois de um silêncio de suspense."""
    x = sum(sino(hz(nota, tom) * 2, 1.4) for nota in ("C4", "E4", "G4")) / 3
    y = np.zeros(len(x))
    y[: len(kick())] += kick() * 0.8
    return x + y


def envelope(x, janela=0.05):
    n = int(janela * SR)
    env = np.sqrt(np.convolve(x ** 2, np.ones(n) / n, mode="same"))
    env = np.minimum(env / (np.percentile(env, 95) + 1e-9), 1)
    n2 = int(0.25 * SR)
    return np.minimum(np.convolve(env, np.ones(n2) / n2, mode="same") * 1.5, 1)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def main():
    tempos, sons_json, entrada, saida = sys.argv[1:5]
    tom = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    tp = json.load(open(tempos))
    dur = tp["duracao"]
    n = int(SR * dur)
    voz, sr = sf.read(entrada, dtype="float32")
    if voz.ndim > 1:
        voz = voz.mean(axis=1)
    if sr != SR:
        voz = resample_poly(voz, SR, sr)
    voz = np.pad(voz, (0, max(0, n - len(voz))))[:n]
    voz = voz / np.abs(voz).max() * 0.85

    if tp.get("climas"):
        musica = trilha_climas(dur, tom, tp["climas"], tp.get("impactos", []), tp.get("secoes", []))
    else:
        musica = trilha(dur, tom, tp.get("secoes", []))
    for a, b in tp.get("silencios", []):  # suspense: a trilha some e volta
        env = np.ones(n)
        i0, i1, rampa = int((a - 0.15) * SR), int(b * SR), int(0.25 * SR)
        env[max(0, i0): i1] = 0
        env[max(0, i0 - rampa): max(0, i0)] = np.linspace(1, 0, max(0, i0) - max(0, i0 - rampa))
        env[i1: i1 + rampa] = np.linspace(0, 1, len(env[i1: i1 + rampa]))
        musica = musica * env
    # trilha com bateria tem picos maiores: mira um nível um pouco mais alto para soar presente
    alvo = 0.16 if tp.get("climas") else 0.11
    if tp.get("silencios"):
        musica *= alvo / np.abs(musica).max()
        for a, b in tp["silencios"]:
            por(musica, acorde_destaque(tom) * 0.09, b)
    musica *= alvo / np.abs(musica).max()
    fx = np.zeros(n)
    for s in json.load(open(sons_json)):
        fn = EFEITOS[s["som"]]
        kw = {"dur": s.get("dur")}
        if s.get("f"):
            kw["f"] = s["f"]
        por(fx, fn(**kw), s["t"], s.get("g", 0.5))
    fx *= 0.30 / max(np.abs(fx).max(), 1e-9)

    fala = envelope(voz)
    mix = voz + musica * (1 - 0.5 * fala) + fx * (1 - 0.35 * fala)
    mix = np.tanh(mix * 1.05) / np.tanh(1.05) * 0.95
    print(f"voz {rms_db(voz):.1f} dB | trilha {rms_db(musica):.1f} dB | efeitos {rms_db(fx):.1f} dB | pico {np.abs(mix).max():.2f}")
    sf.write(saida, np.column_stack([mix, mix]), SR)


if __name__ == "__main__":
    main()
