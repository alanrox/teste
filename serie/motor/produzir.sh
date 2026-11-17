#!/usr/bin/env bash
# Produz um vídeo da série: narração -> animação -> som -> MP4 (duas vozes) -> folha de conferência.
# Uso: motor/produzir.sh videos/01-juros-compostos [so-quadros]
#   MODELO e VOZES apontam para o Kokoro (model_q8.onnx e voices.npz); TRABALHO para uma pasta temporária.
set -euo pipefail
M="$(cd "$(dirname "$0")" && pwd)"
D="$(cd "$1" && pwd)"
NOME="$(basename "$D")"
: "${MODELO:?defina MODELO}" "${VOZES:?defina VOZES}" "${TRABALHO:?defina TRABALHO}"
W="$TRABALHO/$NOME"; mkdir -p "$W"
NUM=$((10#${NOME%%-*}))
TOM=$(( (NUM * 5) % 12 - 5 ))   # varia o tom da trilha entre os vídeos

python3 "$M/narrar.py" "$MODELO" "$VOZES" "$D" "$W" | tail -n 40

# quadros de conferência: fim de cada cena
QS=$(python3 -c "
import json; t=json.load(open('$W/tempos.json')); c=t['cenas']+[t['duracao']]
print(' '.join(f'{max(c[i]+0.5, c[i+1]-0.35):.2f}' for i in range(len(c)-1)))")
rm -rf "$W/quadros"
node "$M/render.js" "$D" "$W/quadros" x $QS
ffmpeg -y -loglevel error -pattern_type glob -i "$W/quadros/q_*.jpg" -vf "scale=360:-1,tile=$(echo $QS | wc -w)x1" -frames:v 1 "$W/folha.png"
echo "folha: $W/folha.png"
[ "${2:-}" = "so-quadros" ] && exit 0

node "$M/render.js" "$D" "$W/mudo.mp4" "$W/sons.json"
for v in pm_alex pf_dora; do
  python3 "$M/sonorizar.py" "$W/tempos.json" "$W/sons.json" "$W/$v.wav" "$W/mix_$v.wav" "$TOM"
done
ffmpeg -y -loglevel error -i "$W/mudo.mp4" -i "$W/mix_pm_alex.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart "$D/$NOME.mp4"
ffmpeg -y -loglevel error -i "$W/mudo.mp4" -i "$W/mix_pf_dora.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart "$D/$NOME-voz-feminina.mp4"
echo "pronto: $D/$NOME.mp4 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$D/$NOME.mp4")s)"
