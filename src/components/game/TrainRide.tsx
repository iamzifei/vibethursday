"use client";

import { useEffect, useRef, useState } from "react";
import { T1_STOPS } from "@/lib/game/world";
import type { GameCopy } from "@/lib/game/copy";
import { fill } from "@/lib/game/copy";

type Props = {
  copy: GameCopy;
  /** Which way: to Chatswood (north) or back to Milsons Point. */
  north: boolean;
  onDone: () => void;
};

const W = 160;
const H = 96;
const TRAVEL = 1.7; // seconds between stops
const DWELL = 0.9; // seconds at each stop

/**
 * The T1 between the two maps, seen through a carriage window.
 *
 * Every stop is a real one, in the real order. Outside, the view changes the
 * way it does on that line: North Sydney's towers first, then the leafy
 * stretch through Waverton and Wollstonecraft, the St Leonards towers, and
 * Chatswood's skyline at the end. Tap to skip.
 */
export function TrainRide({ copy, north, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stops = north ? [...T1_STOPS] : [...T1_STOPS].reverse();
  const [line, setLine] = useState(fill(copy.train.next, { name: stops[1] }));
  const doneRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    const start = performance.now();
    const legs = stops.length - 1;
    const total = legs * (TRAVEL + DWELL);
    let lastLine = "";

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };

    const frame = (now: number) => {
      const t = (now - start) / 1000;
      if (t >= total) {
        finish();
        return;
      }
      const leg = Math.min(legs - 1, Math.floor(t / (TRAVEL + DWELL)));
      const inLeg = t - leg * (TRAVEL + DWELL);
      const moving = inLeg < TRAVEL;
      // Distance travelled, with easing in and out of every stop.
      const eased = moving ? 0.5 - Math.cos((inLeg / TRAVEL) * Math.PI) / 2 : 1;
      const distance = (leg + eased) * 400;
      const progress = (leg + eased) / legs; // 0 at the harbour … 1 at Chatswood
      const along = north ? progress : 1 - progress;

      const text = moving ? fill(copy.train.next, { name: stops[leg + 1] }) : fill(copy.train.arriving, { name: stops[leg + 1] });
      if (text !== lastLine) {
        lastLine = text;
        setLine(text);
      }

      draw(ctx, distance, along, moving ? null : stops[leg + 1], t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
    // Runs once per ride.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="vq-train" role="dialog" aria-label={copy.train.title}>
      <div className="vq-train__head">
        <span className="vq-train__line">T1</span>
        <span>
          {copy.train.title} · {north ? copy.train.toChatswood : copy.train.toCity}
        </span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="vq-train__view" />
      <p className="vq-train__announce" aria-live="polite">
        {line}
      </p>
      <button
        type="button"
        className="vq-btn vq-btn--ghost"
        onClick={() => {
          if (doneRef.current) return;
          doneRef.current = true;
          onDone();
        }}
      >
        {copy.train.skip}
      </button>
    </div>
  );
}

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function draw(ctx: CanvasRenderingContext2D, distance: number, along: number, station: string | null, t: number) {
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, 60);
  sky.addColorStop(0, "#7cc4f2");
  sky.addColorStop(1, "#cfeaff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Far layer: towers near the ends of the line (North Sydney at the start,
  // St Leonards two thirds of the way, Chatswood at the end); low houses
  // and trees in between.
  const far = distance * 0.15;
  for (let i = -2; i < 14; i += 1) {
    const worldX = Math.floor(far / 16) + i;
    const x = worldX * 16 - far;
    const zone = along + (i - 5) * 0.01;
    const towers = zone < 0.22 || (zone > 0.6 && zone < 0.72) || zone > 0.88;
    const h = towers ? 20 + rand(worldX) * 28 : 6 + rand(worldX) * 8;
    ctx.fillStyle = towers ? (rand(worldX + 3) > 0.5 ? "#9fb2c4" : "#b8c6d3") : "#8fae6a";
    ctx.fillRect(Math.round(x), 60 - h, 14, h);
    if (towers) {
      ctx.fillStyle = "#dbe6ef";
      for (let wy = 60 - h + 3; wy < 58; wy += 4) ctx.fillRect(Math.round(x) + 3, wy, 8, 1);
    }
  }

  // Near layer: rooftops and gums rushing past.
  const near = distance * 0.6;
  for (let i = -1; i < 8; i += 1) {
    const worldX = Math.floor(near / 28) + i;
    const x = worldX * 28 - near;
    const kind = rand(worldX * 7);
    if (kind < 0.45) {
      ctx.fillStyle = "#b86a4c";
      ctx.fillRect(Math.round(x), 50, 20, 6);
      ctx.fillStyle = "#e6d3b8";
      ctx.fillRect(Math.round(x) + 2, 56, 16, 8);
    } else {
      ctx.fillStyle = kind < 0.6 ? "#8c6ed0" : "#2e7a3d";
      ctx.beginPath();
      ctx.arc(Math.round(x) + 12, 52, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ground, and the overhead-wire poles closest of all.
  ctx.fillStyle = "#6e665e";
  ctx.fillRect(0, 62, W, 6);
  const poles = distance * 1.4;
  ctx.fillStyle = "#4b4f58";
  for (let i = -1; i < 4; i += 1) {
    const x = Math.floor(poles / 60) * 60 + i * 60 - poles;
    ctx.fillRect(Math.round(x), 18, 2, 50);
  }

  if (station) {
    // Platform and the station's name.
    ctx.fillStyle = "#c8c1b3";
    ctx.fillRect(0, 56, W, 12);
    ctx.fillStyle = "#f5c518";
    ctx.fillRect(0, 66, W, 2);
    ctx.fillStyle = "#1d2a44";
    ctx.fillRect(38, 26, 84, 14);
    ctx.fillStyle = "#f28c28";
    ctx.fillRect(40, 28, 10, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(43, 29, 4, 2);
    ctx.fillRect(44, 31, 2, 6);
    ctx.font = "bold 8px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(station, 54, 33.5);
  }

  // The carriage: window frame, seats, a strap swaying with the motion.
  ctx.fillStyle = "#d9dde3";
  ctx.fillRect(0, 0, W, 10);
  ctx.fillRect(0, 70, W, 26);
  ctx.fillRect(0, 0, 8, H);
  ctx.fillRect(W - 8, 0, 8, H);
  ctx.fillStyle = "#b9bfc8";
  ctx.fillRect(8, 10, W - 16, 2);
  ctx.fillRect(8, 68, W - 16, 2);
  ctx.fillStyle = "#2c5f8a";
  for (let x = 12; x < W - 20; x += 36) {
    ctx.fillRect(x, 76, 28, 12);
    ctx.fillStyle = "#f2a33a";
    ctx.fillRect(x, 76, 28, 2);
    ctx.fillStyle = "#2c5f8a";
  }
  const sway = station ? 0 : Math.sin(t * 7) * 1.5;
  ctx.fillStyle = "#f2a33a";
  ctx.fillRect(Math.round(80 + sway), 10, 1, 8);
  ctx.fillRect(Math.round(78 + sway), 18, 5, 4);
}
