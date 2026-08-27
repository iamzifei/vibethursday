#!/usr/bin/env bash
#
# Turns the Wharf's two generated drawings into the files the page serves.
#
# Run after generate-images.mjs; the output is committed, so this is not part
# of the build. Same shape as scripts/build-photos.mts — AVIF for almost
# everyone, JPEG as the floor that always works, several widths so a phone is
# not made to download a desktop-sized image.
#
# Both sources are ink-on-paper line art with halftone screentone. That is
# worth knowing before changing any setting here:
#
#   - `-trim` is safe. Each drawing has a uniform off-white margin and the
#     artwork inside is bounded by black. Trimming stops at the ink.
#   - Chroma subsampling has to be off. Screentone is a fine dot grid, which
#     is the exact pattern JPEG is worst at, and the two spot colours sit on
#     top of it. 4:4:4 holds both; 4:2:0 turns the red bill into a smear.
#   - AVIF q45 was chosen by looking, not by guessing: side by side with the
#     source at display size it is indistinguishable, and it is a quarter of
#     the bytes of q68. Line art is unusually forgiving here because almost
#     every pixel is already either paper or ink.
#   - `-strip` because there is no reason to ship the generator's metadata.
#
# The two masters in art/ are PNG8, quantised to 128 colours with dithering
# OFF. That is not a compromise here: the drawings are ink, paper, one grey
# screentone and two spot colours, so 128 is far more than they contain, and
# turning dithering off is what keeps the screentone from being re-dithered
# into noise. It took the strip from 4.5 MB to 1.1 MB, which is the size the
# rest of art/ runs at. Side by side at full resolution the two are the same
# image. Re-run this script after replacing either master.

set -euo pipefail

cd "$(dirname "$0")/.."

OUT="public/wharf"
mkdir -p "$OUT"

# The four-panel strip is the page's header, so it is wide and gets three
# sizes. 1600 covers a retina desktop, 1200 a laptop, 800 a phone at 2x.
build() {
  local src="$1" stem="$2"; shift 2

  for width in "$@"; do
    local jpg="$OUT/$stem-$width.jpg"

    magick "$src" \
      -fuzz 3% -trim +repage \
      -resize "${width}x>" \
      -quality 84 -sampling-factor 4:4:4 -strip \
      "$jpg"

    avifenc -q 45 --speed 4 "$jpg" "$OUT/$stem-$width.avif" > /dev/null

    printf '  %-28s %5sKB jpg / %5sKB avif\n' \
      "$stem-$width" \
      "$(( $(stat -f%z "$jpg") / 1024 ))" \
      "$(( $(stat -f%z "$OUT/$stem-$width.avif") / 1024 ))"
  done
}

echo "Wharf art →"
build art/wharf-strip.png strip 800 1200 1600
build art/gull.png gull 240 480

echo
echo "Sizes for content: $(magick identify -format '%wx%h' "$OUT/strip-1600.jpg") strip, $(magick identify -format '%wx%h' "$OUT/gull-480.jpg") gull"
