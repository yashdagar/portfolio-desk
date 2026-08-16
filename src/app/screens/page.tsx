import { About } from "@/components/screens/About";
import { BoxBack } from "@/components/screens/BoxBack";
import { CommitFeed } from "@/components/screens/CommitFeed";
import { NowPlaying } from "@/components/screens/NowPlaying";
import { BOX_DESIGN, SCREEN_DESIGN } from "@/lib/layout";

/**
 * Every mounted surface, flat, at its true design size.
 *
 * The 3D scene makes it easy to ship a screen that's unreadable, badly spaced
 * or broken in an empty state without noticing, because it's small and at an
 * angle. This page is where those get judged.
 */
export const metadata = { robots: { index: false } };

function Frame({
  label,
  w,
  h,
  children,
}: {
  label: string;
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-mono text-[12px] uppercase tracking-widest text-ink-faint">
        {label} · {w}×{h}
      </h2>
      <div
        className="overflow-hidden rounded-sm ring-1 ring-white/10"
        style={{ width: w, height: h }}
      >
        {children}
      </div>
    </section>
  );
}

export default function ScreensPreview() {
  return (
    <main className="min-h-dvh space-y-10 bg-graphite p-10">
      <Frame label="left · commits" w={SCREEN_DESIGN.w} h={SCREEN_DESIGN.h}>
        <CommitFeed />
      </Frame>
      <Frame label="centre · about" w={SCREEN_DESIGN.w} h={SCREEN_DESIGN.h}>
        <About />
      </Frame>
      <Frame label="right · music" w={SCREEN_DESIGN.w} h={SCREEN_DESIGN.h}>
        <NowPlaying />
      </Frame>
      <Frame label="box · catan" w={BOX_DESIGN.w} h={BOX_DESIGN.h}>
        <BoxBack id="catan" />
      </Frame>
      <Frame label="box · chess" w={BOX_DESIGN.w} h={BOX_DESIGN.h}>
        <BoxBack id="chess" />
      </Frame>
    </main>
  );
}
