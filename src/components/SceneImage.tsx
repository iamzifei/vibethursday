import { sceneSrc } from "@/lib/scenes";

/**
 * One redrawn scene (`scenes.ts`), sized for phones first: a 640-wide file
 * unless the screen is wide. 3:2, so the layout does not jump as it loads.
 */
export function SceneImage({ id, alt, eager = false, sizes = "(min-width: 720px) 680px, 100vw" }: { id: string; alt: string; eager?: boolean; sizes?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="scene-img"
      src={sceneSrc(id, 640)}
      srcSet={`${sceneSrc(id, 640)} 640w, ${sceneSrc(id, 1200)} 1200w`}
      sizes={sizes}
      width={1200}
      height={800}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
