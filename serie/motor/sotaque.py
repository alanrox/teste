"""Ajusta a pronúncia gerada pelo espeak para soar mais como português do Brasil.

O espeak-ng (usado pelo Kokoro) produz alguns sons que lembram Portugal ou
o inglês. Estas regras trocam esses sons pelos equivalentes brasileiros:
  - "e" átono final: y (ü) -> ɪ           ("verdade" -> verdadʒɪ)
  - "a" átono: æ -> ɐ                      ("tia" -> tʃiɐ)
  - "r" antes de consoante: ɾə -> h        ("mercado" -> mehkadu)
  - "r" final de palavra: r/ɾ -> h         ("emprestar" -> emprestah)
  - "de-"/"es-" átonos iniciais -> dʒi/is   ("demais" -> dʒimais)
"""
import re

from kokoro_onnx.tokenizer import Tokenizer

_tok = Tokenizer()
VOGAIS = "aeiouɐɛɔəɪʊæyãẽĩõũ"


def ajustar(fon):
    fon = fon.replace("æ", "ɐ")
    fon = re.sub(r"ɾə(?=[^\s" + VOGAIS + r"ˈˌ])", "h", fon)
    fon = re.sub(r"ɾə", "ɾ", fon)
    fon = re.sub(r"(?<=[" + VOGAIS + r"ː])[rɾ](?=[\s,.;:!?…]|$)", "h", fon)
    fon = re.sub(r"y(?=[\s,.;:!?…]|$)", "ɪ", fon)
    fon = re.sub(r"(?<=[ʃʒsz])y", "ɪ", fon)
    # "de-"/"es-" átonos no início da palavra: "demais" -> dʒimais, "esperando" -> isperando
    fon = re.sub(r"(?:(?<=\s)|^)(ˌ?)de(?=[^ˈ\s])", r"\1dʒi", fon)
    fon = re.sub(r"(?:(?<=\s)|^)(ˌ?)es(?=[^ˈ\s])", r"\1is", fon)
    return fon


def fonemas(texto, br=True):
    f = _tok.phonemize(texto, lang="pt-br")
    return ajustar(f) if br else f


if __name__ == "__main__":
    import sys
    for s in sys.argv[1:]:
        print(fonemas(s, False), "->", fonemas(s))
