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
#   - No `-trim`. An earlier version of this art was ink on a uniform off-white
#     margin and trimming was safe; these are full-bleed painted panels, and
#     trimming a painted edge crops the picture.
#   - Chroma subsampling has to be off. Screentone is a fine dot grid, which
#     is the exact pattern JPEG is worst at, and the two spot colours sit on
#     top of it. 4:4:4 holds both; 4:2:0 turns the red bill into a smear.
#   - AVIF q45 was chosen by looking, not by guessing: side by side with the
#     source at display size it is indistinguishable, and it is a quarter of
#     the bytes of q68. Line art is unusually forgiving here because almost
#     every pixel is already either paper or ink.
#   - `-strip` because there is no reason to ship the generator's metadata.
#
# The two masters in art/ are PNG8, quantised to 160 colours with dithering
# OFF. That is not a compromise here: the drawings are ink, paper, one grey
# screentone and two spot colours, so 128 is far more than they contain, and
# turning dithering off is what keeps the screentone from being re-dithered
# into noise. It takes each master from about 1.7 MB to under 450 KB, which is the size the
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

# The comic is generated as one 2x2 image — one call, so the two birds are the
# same two birds in all four panels — and then cut into four here. The page
# needs them separately: 2x2 on a desktop, a single column on a phone, and each
# panel carries its own HTML speech bubble positioned relative to itself.
#
# Offsets come from the panel borders in the source (7 / 517 across, 7 / 518
# down, 500 to a side). If the comic is ever regenerated, re-measure — a new
# image will not land on the same pixels.
echo "Wharf comic →"
for panel in "1 7 7" "2 517 7" "3 7 518" "4 517 518"; do
  set -- $panel
  magick art/wharf-strip.png -crop "500x500+$2+$3" +repage "/tmp/vt-panel$1.png"
  # One width, not the usual ladder. The comic is generated 1024x1024, so a
  # panel is 500px at source and there is nothing above that to serve. The
  # figure is capped at 720px on the page, which puts a panel at about 350
  # CSS px — roughly 1.4x, which is where these flat painted fills still look
  # clean. Upscaling to fake a retina file would only add bytes.
  build "/tmp/vt-panel$1.png" "panel$1" 500
  rm -f "/tmp/vt-panel$1.png"
done

# The gull is generated with a lot of empty sky above it, which is right for
# the drawing and wrong for a 180px mascot. Cropped to the bird, its decking
# and the chip; the master keeps the full frame.
echo "Gull →"
magick art/gull.png -crop 920x790+0+234 +repage /tmp/vt-gull.png
build /tmp/vt-gull.png gull 240 480
rm -f /tmp/vt-gull.png

echo
echo "Sizes for content: $(magick identify -format '%wx%h' "$OUT/panel1-500.jpg") per panel, $(magick identify -format '%wx%h' "$OUT/gull-480.jpg") gull"
