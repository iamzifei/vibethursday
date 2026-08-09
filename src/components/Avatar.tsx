import { monogram } from "@/lib/members";

type Props = {
  id: string;
  name: string;
  hasAvatar: boolean;
  /** Cache-busting suffix. Never used to decide whether a photo exists. */
  version: number;
  size: "sm" | "lg";
};

/**
 * A member's face, or their initial.
 *
 * The monogram is the fallback rather than a generic silhouette: on a wall of
 * thirty people a letter at least distinguishes them, and it costs no request.
 */
export function Avatar({ id, name, hasAvatar, version, size }: Props) {
  const className = `monogram${size === "lg" ? " monogram--lg" : ""}`;

  if (hasAvatar) {
    return (
      // Plain img: the avatar is already resized and re-encoded in the browser
      // before upload, so there is nothing for an optimiser to do, and routing
      // it through one would add a second fetch of the same bytes.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`${className} monogram--photo`}
        src={`/api/avatar/${id}?v=${version}`}
        alt={name}
        width={size === "lg" ? 72 : 44}
        height={size === "lg" ? 72 : 44}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span className={className} aria-hidden="true">
      {monogram(name)}
    </span>
  );
}
