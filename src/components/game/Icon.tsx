import { ICON_SIZE, iconRuns, type IconName } from "./icons";

/**
 * One of /play's pixel icons, as crisp-edged SVG. Decorative by default: the
 * button it sits in carries the label.
 */
export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="vq-pixicon"
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {iconRuns(name).map((run, i) => (
        <rect key={i} x={run.x} y={run.y} width={run.w} height={1} fill={run.color} />
      ))}
    </svg>
  );
}
