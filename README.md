# The Desk

A 3D portfolio. You're sitting at a desk; the monitors show what I'm actually
working on right now.

There is no projects section. The left monitor is a live GitHub commit feed, the
right one is whatever I'm playing on Spotify, and the centre one is who I am.
The only work on display is two board games sitting on the shelf as boxes.

The point is that it's present tense. It can't go stale, and it gets better on
its own as commits accumulate.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 ·
react-three-fiber 9 · drei 10 · three · zustand

## Notes

- **Monitors are real DOM**, not textures — mounted onto the screen planes with
  drei's `<Html transform occlude>`. The commit feed is selectable text with
  working links, indexable and keyboard-reachable, while still being physically
  mounted on a monitor in the room.
- **The room runs on Gurugram time.** Real IST drives the window light, the desk
  lamp and the RGB strip.
- **Work commits are redacted at the source.** Private-repo activity is
  processed inside a scheduled GitHub Action and committed as static JSON, so
  the token that can read them is never present at request time.

## Development

```sh
npm run dev
node scripts/shot.mjs out.png        # screenshot the running dev server
```

`scripts/shot.mjs` drives the system Chrome and waits for the canvas to actually
draw before capturing — a frame grabbed too early is indistinguishable from a
broken scene.
