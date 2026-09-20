// Vector cursor rendered at output resolution (crisp at any zoom), with a click ripple and a brief
// press dip. Position is precomputed in window pixels so the cursor size stays constant while the
// content zooms underneath it.
import React from "react";

type Ripple = { x: number; y: number; progress: number };

const ARROW =
  "M4.5 2.2 L4.5 18.6 L8.9 14.3 L11.8 20.9 L14.4 19.8 L11.5 13.3 L17.7 13.3 Z";

export const Cursor: React.FC<{ x: number; y: number; press: number; ripples: Ripple[] }> = ({
  x,
  y,
  press,
  ripples,
}) => (
  <>
    {ripples.map((r, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: r.x,
          top: r.y,
          width: 22,
          height: 22,
          marginLeft: -11,
          marginTop: -11,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(217,119,87,0.55) 0%, rgba(217,119,87,0) 68%)",
          transform: `scale(${0.4 + r.progress * 3.4})`,
          opacity: (1 - r.progress) * 0.8,
        }}
      />
    ))}
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-5px,-2px) scale(${press})`,
        transformOrigin: "5px 3px",
        filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.55))",
      }}
    >
      <svg width={30} height={30} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d={ARROW} fill="#fbfbf8" stroke="#161615" strokeWidth={1.3} strokeLinejoin="round" />
      </svg>
    </div>
  </>
);
