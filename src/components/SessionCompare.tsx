import type { ReactNode } from "react";
import type { Copy } from "@/lib/content";

/**
 * Thursday and Tuesday side by side (2026-10-15), so nobody has to guess
 * which one is theirs. Shown above the home page's form and, since
 * 2026-10-19, on /tuesday too — people arriving there were just as unsure.
 * `foot` is an optional last row under the Tuesday column (links).
 */
export function SessionCompare({ compare, foot }: { compare: Copy["signup"]["compare"]; foot?: ReactNode }) {
  return (
    <div className="compare" role="table" aria-label={`${compare.thursday.name} / ${compare.tuesday.name}`}>
      <div className="compare__head" role="row">
        <span role="columnheader" />
        <span role="columnheader">{compare.thursday.name}</span>
        <span role="columnheader">{compare.tuesday.name}</span>
      </div>
      {compare.rows.map((row, i) => (
        <div className="compare__row" role="row" key={row}>
          <span role="rowheader">{row}</span>
          <span role="cell">{compare.thursday.cells[i]}</span>
          <span role="cell">{compare.tuesday.cells[i]}</span>
        </div>
      ))}
      {foot && (
        <div className="compare__row compare__foot" role="row">
          <span role="cell" />
          <span role="cell" />
          <span role="cell">{foot}</span>
        </div>
      )}
    </div>
  );
}
