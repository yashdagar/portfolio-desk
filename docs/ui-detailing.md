# UI detailing

The brief for everything rendered as DOM: the three monitor screens, the box
backs, the HUD, and the flat page. The room is judged as a render; these are
judged as interfaces, and they have to survive being looked at from 30cm away
when someone leans in.

The direction is **round and friendly**. Sharp 2px corners and hairline rules
read as "developer dashboard", which is the one thing a portfolio can't afford
to look like — it's the visual language of every screenshot the reader has
already seen today. Generous radii, soft filled surfaces and pill-shaped
affordances read as designed. The content stays terse and technical; only the
container softens.

## 1. Radius scale

Five steps, and nothing off-scale. Radius is the single loudest signal here, so
it can't be picked per-component.

| Token | Value | Used for |
|---|---|---|
| `--r-xs` | 6px | Inline chips, key legends, redaction blocks |
| `--r-sm` | 10px | List rows, small buttons |
| `--r-md` | 16px | Cards, panels, list containers |
| `--r-lg` | 22px | Screen-level regions, sidebars, album art |
| `--r-full` | 999px | Badges, transport buttons, progress tracks |

The rule that keeps it coherent: **a child's radius is one step below its
parent's**, never equal. Equal radii on nested surfaces make the inner element
look like it's escaping the outer one.

## 2. Elevation

Three levels, expressed as fill rather than shadow. These are emissive screens
in a dark room; a drop shadow on a screen is a lie, and it muddies the panel.

| Level | Fill | Border |
|---|---|---|
| 0 — screen bed | `--screen` | none |
| 1 — panel | `--screen-raised` | none |
| 2 — active/hover | `--screen-hi` | `--screen-line` |

Level 1 is a *filled* surface, not an outlined one. A bordered box on a dark
panel reads as a table cell; a filled one reads as a card. Borders are reserved
for the moment something is genuinely active.

One exception: the screen bed itself gets a very slight radial lift toward the
top of each panel, so a 16:9 field of near-black isn't perfectly even. Real
panels aren't.

## 3. Density

Leaning in is the design case. At rest the panels are ~600px wide on screen and
nobody is reading them; focused, they're near 1:1. So the type scale is set for
the focused case and the rest pose gets shape and colour instead of words —
which is why chips and coloured pills matter more here than they would on an
ordinary page. From two metres back, `feat` as a green pill still parses; `feat`
as 13px text does not.

- Row height: 26px minimum, 30px for anything clickable.
- Section gap: 20px. Panel padding: 20px, 24px on the widest screen.
- Line length caps at 62 characters regardless of panel width.

## 4. Motion

Everything that changes state moves, and nothing moves linearly.

- Hover/focus: 140ms, `cubic-bezier(.2,.8,.3,1)`.
- Content swap (a new track, a new commit at the top): 320ms fade + 6px rise.
- Nothing animates on first paint. The room is already a lot; screens that also
  fly in read as a demo reel.
- All of it is off under `prefers-reduced-motion`, which the global sheet
  already enforces.

## 5. Per-screen

### Left — commit feed

The one screen where density is the point, so softening has to be careful:
rounding every row into a card would waste half the panel.

- Header becomes a row of **pill badges** — `123 this year`, `1d streak`,
  `updated 4m ago` — filled at level 1, `--r-full`. That's the part that reads
  from the rest pose.
- Repo group headings become a **chip** (repo name, accent, `--r-xs`) with the
  date trailing, and the hairline rule under them goes away. The chip is enough
  separation; the rule was doing the same job twice.
- Rows get `--r-sm` and a level-2 fill on hover, inset 8px so the highlight is
  clearly a row and not a full-bleed band.
- Redaction blocks become `--r-full` capsules rather than 1px-rounded bars. A
  capsule reads as *deliberately withheld*; a sharp bar reads as a loading
  skeleton, which is the wrong story entirely.
- The footer note about work commits sits in a level-1 card at `--r-md`, so the
  explanation is visibly an aside and not another commit.

### Centre — about

- Name stays large and unadorned. It's the only place in the whole project where
  restraint beats decoration.
- The role/location line becomes an accent pill.
- Contacts become **cards**: level 1, `--r-md`, label above value, the whole card
  a hit target. Currently they're underlined text, which is four small targets in
  a column and looks like a footer.
- The commit-count line at the bottom becomes a level-1 strip at `--r-full`.

### Right — now playing

Rebuilt as a full player client rather than a card: sidebar, main pane, and a
transport bar across the bottom. Detailed separately in the component; the parts
that belong to this document are the album art at `--r-lg` with a colour wash
pulled from the artwork behind it, `--r-full` transport buttons, and a `--r-full`
progress track that thickens on hover.

The empty state gets the same chrome as the full one — sidebar and transport bar
still present, main pane holding a single line. An empty state that discards the
layout looks broken; one that keeps it looks idle, which is the truth.

### Box backs

Warm paper, not screen. Different rules apply: this is printed matter.

- Panel corners `--r-lg`, because the mounted surface should read as a card
  sitting on the box rather than the box's own face.
- `Play` and `Source` become `--r-full` buttons — the pill is what makes them
  read as the call to action on a box back.
- The components list keeps its rules and bullets. It's imitating a real
  components list and that format is already right.

### HUD

- Both buttons `--r-full`, level 1 fill.
- The clock stays plain text. Chrome around it would make it look like a control.

## 6. What this pass explicitly does not do

- No shadows on screen content.
- No gradients on text.
- No second accent colour. The green in the player is the player's, and it is
  scoped to that one surface.
- No animated skeletons. Content arrives or it says why it hasn't.
