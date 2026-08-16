"use client";

import { BOXES } from "@/lib/profile";
import type { BoxId } from "@/lib/store";

/**
 * The back of a board game box.
 *
 * Deliberately the real format — title, player count, play time, a blurb, and a
 * components list — because a box back is already a case study that people know
 * how to read. The "components" are the architecture, which is the joke and
 * also the most accurate description of what's in there.
 */
export function BoxBack({ id }: { id: BoxId }) {
  const box = BOXES[id];

  return (
    <div className="flex h-full w-full flex-col bg-[#efe7d8] px-9 py-8 font-sans text-[#2c2620]">
      <header className="flex items-end justify-between border-b-2 border-[#2c2620] pb-3">
        <div>
          <h2 className="font-mono text-[38px] font-bold leading-none tracking-[0.18em]">
            {box.title}
          </h2>
          <p className="mt-2 text-[15px] italic text-[#6a5f52]">{box.tagline}</p>
        </div>
        <dl className="text-right font-mono text-[12px] uppercase tracking-wider text-[#6a5f52]">
          <div className="flex items-baseline justify-end gap-2">
            <dt className="sr-only">Players</dt>
            <dd>{box.players}</dd>
          </div>
          <div className="mt-1 flex items-baseline justify-end gap-2">
            <dt className="sr-only">Play time</dt>
            <dd>{box.time}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-7 grid min-h-0 flex-1 grid-cols-[1.3fr_1fr] gap-9">
        <div className="space-y-4 overflow-y-auto pr-2 text-[16px] leading-[1.65]">
          {box.blurb.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>

        {/*
          The components list gets its own panel. On a square box back a plain
          second column floats, and giving it a tint and a rule makes it read as
          the "what's in the box" block that it's imitating.
        */}
        <div className="min-h-0 overflow-y-auto border-l border-[#2c262033] pl-7">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6a5f52]">
            Components
          </h3>
          <ul className="mt-4 space-y-3 text-[14px] leading-snug">
            {box.components.map((c) => (
              <li key={c.slice(0, 24)} className="flex gap-2.5">
                <span aria-hidden className="mt-[7px] size-[5px] shrink-0 bg-[#8a7d6b]" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="mt-5 flex items-center gap-4 border-t-2 border-[#2c2620] pt-4">
        {box.playHref && (
          <a
            href={box.playHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-sm bg-[#2c2620] px-5 py-2 font-mono text-[13px] uppercase tracking-wider text-[#efe7d8] transition-colors hover:bg-[#4a3f34] focus-visible:bg-[#4a3f34] focus-visible:outline-none"
          >
            <span aria-hidden>▶</span> Play
          </a>
        )}
        {box.repoHref && (
          <a
            href={box.repoHref}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[13px] uppercase tracking-wider text-[#6a5f52] underline underline-offset-4 hover:text-[#2c2620] focus-visible:text-[#2c2620] focus-visible:outline-none"
          >
            Source
          </a>
        )}
        {box.status && (
          <span className="font-mono text-[12px] uppercase tracking-wider text-[#a89880]">
            {box.status}
          </span>
        )}
      </footer>
    </div>
  );
}
