/**
 * Confirms bytes really are the image type they claim to be.
 *
 * Trusting the declared MIME would let anyone store arbitrary bytes that a
 * browser is later told to interpret as an image, so the magic number is
 * checked instead of the label.
 *
 * Extracted when the Wharf's answers gained a picture: two upload paths with
 * two copies of this would be two places for one of them to fall behind.
 */
export function sniffImage(bytes: Buffer): string | null {
  if (bytes.length > 12) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      return "image/png";
    if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP")
      return "image/webp";
  }

  return null;
}
