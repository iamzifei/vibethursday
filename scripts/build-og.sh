#!/usr/bin/env bash
#
# Composites the social share card from the generated artwork plus real text.
#
# The type is drawn here rather than asked of the image model, so it is always
# spelled correctly and always crisp. Run after generate-images.mjs; the output
# is committed, so this is not part of the build.
#
# Fonts come from the local machine, and each script needs its own file:
# ImageMagick cannot select a face out of a macOS .ttc collection, so PingFang
# has to be the standalone .ttf rather than /System/Library/Fonts/PingFang.ttc.

set -euo pipefail

cd "$(dirname "$0")/.."

SRC="art/og-bg.png"
OUT="public/og.jpg"

FONT_LATIN="$HOME/Library/Fonts/Inter_24pt-ExtraBold.ttf"
FONT_MONO="$HOME/Library/Fonts/GeistMono-Bold.ttf"
FONT_CJK="$HOME/Library/Fonts/pingfang-sc-regular.ttf"

for font in "$FONT_LATIN" "$FONT_MONO" "$FONT_CJK"; do
  [ -f "$font" ] || { echo "Missing font: $font" >&2; exit 1; }
done

LIME="#C6FF3D"
CYAN="#3DDCFF"
FG1="#F2F5F3"
FG2="#A4ACB4"

# Source is 1536x1024 (3:2); the card is 1200x630 (~1.9:1). Scaling to width
# and cropping the vertical centre keeps the dense right-hand detail while
# leaving the left side clear for type.
magick "$SRC" \
  -resize 1200x \
  -gravity center -crop 1200x630+0+0 +repage \
  -gravity northwest \
  -font "$FONT_MONO"  -fill "$CYAN" -pointsize 22 -kerning 4  -annotate +72+150 'SYDNEY · EVERY THURSDAY' \
  -font "$FONT_LATIN" -fill "$FG1"  -pointsize 100 -kerning -3 -annotate +72+265 'Vibe Thursday' \
  -font "$FONT_CJK"   -fill "$FG2"  -pointsize 36 -kerning 0  -annotate +74+385 '悉尼 · 每周四 15:00–18:00' \
  -font "$FONT_CJK"   -fill "$LIME" -pointsize 34             -annotate +74+472 '带上你用 AI 做的东西，讲 5 分钟' \
  -font "$FONT_CJK"   -fill "$FG2"  -pointsize 26             -annotate +74+522 '会坏的 demo 也欢迎 · 免费' \
  -quality 90 -sampling-factor 4:4:4 -strip \
  "$OUT"

echo "Wrote $OUT ($(magick identify -format '%wx%h' "$OUT"))"
