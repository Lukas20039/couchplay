// QR-Code als SVG-Pfad (uqr). Ein Pfad statt vieler Rechtecke → billig zu rendern.
import { useMemo } from "preact/hooks";
import { encode } from "uqr";

/** Baut den SVG-Pfad aller dunklen Module (zeilenweise zusammengefasst). */
export function qrPath(data: boolean[][]): string {
  let d = "";
  data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      d += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return d;
}

export function Qr(props: { value: string; label: string; class?: string }) {
  const qr = useMemo(() => encode(props.value, { ecc: "M", border: 2 }), [props.value]);
  const path = useMemo(() => qrPath(qr.data), [qr]);
  return (
    <svg
      class={props.class}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      role="img"
      aria-label={props.label}
      shape-rendering="crispEdges"
      data-testid="join-qr"
      data-join-url={props.value}
    >
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={path} fill="#120f24" />
    </svg>
  );
}
