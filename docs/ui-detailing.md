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
  already enforces. The well's hard-drop flinch checks the query itself, because
  it runs through the Web Animations API rather than a stylesheet.
- **The game is the exception to "motion is decoration".** On the centre monitor
  motion *is* the feedback, and it's the difference between a game and a
  simulation of one:
  - **Line clear: 200ms.** Gravity stops, the rows blow out to white, and the
    stack drops only afterwards. Without the pause a tetris and a single are
    indistinguishable — the stack is simply shorter than it was a frame ago.
    200ms because it also has to be over before it becomes waiting.
  - **Hard drop: a 4px flinch, 140ms.** A piece that lands silently feels like
    nothing happened.
  - **Callout: 900ms rise and fade**, for a double, triple or tetris. Nothing
    for a single, which no game has ever congratulated anyone for.
  - **Danger: a 1.6s pulse** in the well's ring when the stack is four rows from
    the top. Slow deliberately — quicker reads as a fault rather than pressure.

## 5. Per-screen

### Left — about

Moved here from the ultrawide, and it reads better for the move: the two-column
split exists because a short bio in one column leaves a dead band down the middle
of a 16:9 panel, and this is the first 16:9 panel it has actually been on.

- Name stays large and unadorned. It's the only place in the whole project where
  restraint beats decoration.
- The role/location line is an accent pill.
- Contacts are **cards**: level 1, `--r-md`, label above value, the whole card a
  hit target. Underlined text was four small targets in a column, which looks
  like a footer, and a footer is the last thing anyone clicks.
- The contribution grid and the total that sums it sit **together at the bottom**
  of the column. The column has slack to absorb, and it belongs between two
  unrelated blocks rather than between a grid and the line that totals it.
- The commit-count line is a level-1 strip at `--r-full`.

### Centre — Tetris

A real game, on the largest panel in the room. Its own rules, for one reason
that decides everything else: **the game has to be self-contained on one
screen.** `CameraRig` flies the camera in until the focused panel fills the
frame, so a score panel on a neighbouring monitor is out of shot at exactly the
moment it's being read. That constraint is what the 2.37:1 aspect is for — the
rails, queue, leaderboard and controls all fit beside the well.

- **Five columns**, well centred: leaderboard · hold and counters · the well ·
  next queue · score and controls. The two outer columns are the same width and
  both filled to it. An outer column that doesn't fill its width pools its slack
  at the edge, and the board stops looking centred even when it is.
- **Level-1 filled rows** for both the leaderboard and the controls legend, which
  is what gives those two columns matching weight.
- **The prompt goes under the well, never over it.** Twenty rows are sized to
  leave a line free below. An overlay covering the board hides the stack it is
  inviting you to come and play with.
- **Attract mode is never covered.** A bot plays whenever nobody else is, because
  the rest pose is the frame almost every visitor sees and a still board on the
  biggest monitor would be worse than what it replaced.
- Paused and game-over *do* take the full cover — there is nothing behind them
  worth looking at.
- **Below 1180px the rails fold under the well** and the leaderboard goes last.
  Container query, not media: mounted in the room this DOM is on a plane at a
  fixed 1720px. The wide layout is the default and the narrow one overrides it,
  so the panel in the room never waits on a query to resolve.

### The commit feed — flat page only

No longer on a monitor. It survives on the flat page, where a linear log is
exactly what someone skimming wants, and the collector, the redaction rules and
their tests are all unchanged. The notes below still govern it.

**A terminal running `git log --oneline`.** The exception to the "round and
friendly" direction above, and the reason for the exception is that this screen
isn't showing you a designed view of commit data — it's showing you the data in
the format it natively has. Cards were a design decision about someone else's
output; a log is the output. It also happens to be the one format a reader can't
suspect of having been arranged flatteringly, which matters more here than on
any other surface.

The container still softens. What doesn't is the content: mono throughout, one
commit per line, columns rather than cards.

- **Window chrome** at level 1, `--r-md`: three neutral dots and `yash@desk:
  ~/dev`. The dots stay neutral rather than red/amber/green; three saturated hues
  for decoration would break the one-accent rule the room's colour rests on.
- The two totals stay as **pill badges** (`--r-full`, level 1) in the title bar.
  `updated 4m ago` moves to the bottom line, next to the cursor — the freshness
  stamp belongs with the thing that's waiting for the next commit.
- **Rows**: 7-char sha in accent (git colours it for the same reason — it's the
  only part of the line that's machine output), message, repo, age. `--r-sm`
  with a level-2 fill on hover, inset 8px.
- The **repo column prints only when it changes**, and a `# Sun 16 Aug · 6
  commits` comment goes in wherever the day turns over. That's all that survives
  of grouping: nothing is folded away, the log stays linear, and a burst on one
  repo still reads as one session.
- **Linear, never `--graph`.** The collector reads the events API, which carries
  no parent shas, so any topology drawn here would be invented.
- **Redaction blocks** stay `--r-full` capsules at a fixed width — *deliberately
  withheld*, not a loading skeleton, and a length-proportional bar would leak how
  long the subject was. The kind tag before it is fixed-width too, or the
  blackout starts in a different place on every row and reads as damage rather
  than as policy.
- The work-commit note becomes a `#` **comment line** above the prompt rather
  than a card. In a terminal a dim comment is already visibly an aside.
- **Below 720px the row reflows**: sha, repo and age on the first line, the
  message wrapped in full underneath. Columns at that width give the message
  ~50 characters and truncate every line to nothing. A narrow terminal wraps
  rather than truncates, so the reflow is the more faithful behaviour as well as
  the readable one. Container query, not media query — kept because the feed is
  still mounted inside a fixed-width panel on the flat page.
- **The live tail.** The client re-polls every two minutes and a commit that
  lands mid-session prints itself at the top with the 320ms fade-and-rise from
  §4. Only ids that weren't in the previous poll animate, so the hundred and
  forty already on screen stay still on first paint.

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

- No shadows on screen content — with one exception, for the same reason as the
  colour one. A tetromino gets an inset bevel: lit top-left, shaded
  bottom-right. That isn't elevation, which is what the rule is about; nothing
  is floating above anything. It's the block's own material, and without it the
  well is seven colours of flat rounded rectangle, which is what a UI looks
  like and not what a game looks like.
- No gradients on text.
- No second accent colour **for design**. Two surfaces are exempt, and the
  exemption is narrow enough to state precisely: a screen that is pretending to
  be a piece of software someone else made brings that software's palette with
  it. The green in the player is Spotify's. The seven piece colours in Tetris are
  Tetris's, and they are not decoration — they are how you tell an S from a Z at
  a glance, which is the game. Both are scoped to their own surface and neither
  leaks into a token.

  The tuning that keeps them in the room: the pieces are desaturated from the
  canonical seven so they sit in a warm space rather than glowing out of it, and
  S and Z reuse `--add` and `--del`, which already mean good-thing and bad-thing
  everywhere else on these screens.
- No animated skeletons. Content arrives or it says why it hasn't.
