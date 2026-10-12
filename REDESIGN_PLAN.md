# Licht Visual Redesign: Synthesized Plan

Status: design agreed by the arena pass, awaiting checkpoint before implementation.
Keeps all current features and the blue + status color identity. Restructures layout,
refreshes tokens, makes room for the pod log viewer. Supersedes the ad-hoc single-scroll
layout.

Produced by the architect + frontend-design skills. Two structurally distinct candidates
were sketched by separate models (operator console, focus workspace) and synthesized here.
Synthesis decision at the bottom.

## Design stance (what makes this not a generic admin template)

1. Monospace is the UI identity, not just code. The whole interface is set in one mono
   family. Admin templates never do this. It reads as a tool an operator keeps open, not a
   product. Prose-length text (drawer descriptions, empty states) is the only exception.
2. Status color is the only resting saturation. Blue is identity, focus, and the active
   nav marker. The green/amber/red/blue status dots are the one thing that lights up. Color
   means a resource needs you.
3. Borders and background steps separate surfaces. No drop shadow on cards. Shadow is
   reserved for truly floating layers (the Cmd+K overlay). This is the clearest break from
   the SaaS-card look the current app leans on.
4. No centered max-width shell. Content fills the viewport like a terminal.
5. Persistent chrome, swapping content. A rail and top bar that never scroll away, with
   the cluster's live pulse always visible.

Explicitly avoided AI-design tells: cream+serif+terracotta, near-black+acid accent,
broadsheet hairlines, identical-rounded-card kit with one shadow, ALL-CAPS tracked
eyebrows, middle-dot meta strings, `WORD — fragment` labels, `->` on buttons. Mono here is
a deliberate identity choice, not the "mono for all small labels" tell, because it is the
whole UI face carrying the operator-tool character, not decoration on labels.

## Typeface

**JetBrains Mono** (OFL, free), one family, the entire UI. Slashed zero, unambiguous
`l1I`/`O0`, tabular lining figures (`font-feature-settings: "tnum" 1`) so counts and
`2/2`, `0`, `3h` align in tables. Ligatures OFF in logs and YAML (operators read exact
bytes), on elsewhere is fine. Weight carries hierarchy: 400 data, 500 labels, 600
active/headings. Chose JetBrains Mono over Berkeley Mono (paid web license) and Geist
(less terminal character). A short-prose fallback stack (`-apple-system, system-ui`) is
used only for multi-line descriptions.

## Color tokens

Keep every existing token name. Blue ramp and status colors unchanged (hard constraint).

### Light theme neutrals (refined, named slate steps)
```
--n-0   #ffffff   card / elevated
--n-50  #f8fafc   app background (existing --surface-bg)
--n-100 #eef2f6   rail, sunken panels
--n-150 #e2e8f0   strong border, table header
--n-300 #cbd5e1   dividers
--n-600 #475569   text secondary strong (new; #64748b too faint at 13px)
--n-800 #1e293b   text primary (existing)
```

### Dark theme (new, `[data-theme="dark"]`, toggle not default)
Cool desaturated slate, not pure black.
```
--surface-bg       #0f172a   app canvas (slate-900)
--surface-card     #16213a   card / panel
--surface-elevated #1c2a45   drawer, overlays
--rail-bg          #0b1220   rail recedes darker than content
--surface-border        rgba(148,163,184,0.14)
--surface-border-strong rgba(148,163,184,0.24)
--text-primary   #e2e8f0
--text-secondary #94a3b8
--text-tertiary  #64748b
```
Dark active/focus brightens to `--color-primary-400 #3d8bff`. Status hex unchanged
(semantics fixed), backed by existing `-bg` rgba fills. No card shadow in dark; border +
bg step only. `--shadow-glow` reserved for the live-connection pulse.

### The 6 named palette values
`#1669e8` primary blue (identity/focus), `#0f172a` slate-900 (dark canvas), `#e2e8f0`
slate-200 (dark text / light strong border), `#22c55e` running green, `#f59e0b` pending
amber, `#ef4444` failed red.

## Type scale (tighten, drop display sizes)
```
--text-xs   0.6875rem (11px)  status chips, table meta, rail labels
--text-sm   0.8125rem (13px)  table body, dense default — the workhorse
--text-base 0.9375rem (15px)  drawer body, form fields
--text-lg   1.0625rem (17px)  section / drawer titles
--text-xl   1.375rem  (22px)  single page/view heading
```
Retire `--text-3xl`/`--text-4xl` (a console has no 40px headline). Line-height 1.3 body,
1.15 tables, 1.4 logs.

## Spacing and radius
Keep the 4px spacing scale, shift table/list defaults down one step (`--space-2`/`-3`).
Two radii with intent: `--radius-sm 6px` for interactive controls, `--radius-md 10px` for
containers. Logs, YAML, tables get radius 0 on their inner scroll area, flush and
terminal-like. Retire `--radius-lg/xl` from use.

## Layout: persistent shell, swapping center, split-pane drawer

Three fixed frames around one swapping center.

- **Left icon rail (56px, expands to 200px on hover/pin).** Resource-type nav, one glyph
  per the 10 kinds, each with a live count badge from `useKubernetesData`. Active kind =
  2px blue left bar + blue glyph, not a filled pill. Licht mark top, theme toggle bottom.
- **Top bar (48px).** Cluster host (mono) | namespace scope selector (type-ahead, "all"
  default; namespace is orthogonal to kind so it is a global filter here, not in the rail)
  | Cmd+K search trigger | right: live connection pill (green "live" + glow pulse while
  streaming, amber "reconnecting", red "disconnected") + last-updated.
- **Center.** A view header strip (view name + result count + Grid/Table/Topology toggle on
  the right) over the swapping content region. Namespace cards (pod squares + status rings)
  become the "Namespaces" view, one view among the kinds, not a separate top section.
  Topology folds into the explorer's Topology view.
- **Right drawer as resizable split-pane.** Selecting a resource opens a vertical split of
  the center (default 40% drawer / 60% content, draggable handle), full height below the
  top bar. Tabs: Overview | YAML | Logs. The split gives logs real vertical room in one
  mode (no competing dock modes).

### Desktop wireframe (light default shown)
```
+----+---------------------------------------------------------------------------+
| L  | prod-eu-1   [ns: all v]        ( Cmd+K )            [* live]  12:04:51     |  top bar 48px
+----+----------------------------------------+------------------------------------+
| [] | Pods                   142   [Grid|Table|Topo] | nginx-deployment      [x] |
| [] |------------------------------------------------| Deployment   kube-system  |
|[>] | NAME          NS       STATUS   READY RST AGE  | [Overview][YAML][Logs]    |
| [] | api-7f9c..d2  default  * Running 2/2   0  3h   |---------------------------|
| [] | worker-5b..9  jobs     ! Pending 0/1   0  45s  | (Logs active)             |
| [] | migrate-once  jobs     x Failed  0/1   4  12m  | container:[nginx v][wrap] |
| [] | ...                                            | 14:22:01 server started   |
| [] |                                                | 14:22:05 GET /healthz 200 |
| [] |                                                | 14:22:08 WARN retry 2/3   |
|----|                                                | [following]      [bottom] |
| th | +3 ~11 -1  (event ticker)                      |<-drag                     |
+----+------------------------------------------------+---------------------------+
 rail 56px, active = blue left bar          drawer split-pane, resizable
```

### Mobile (< 720px)
Rail collapses to a bottom tab bar (5 most-used kinds + more sheet). Top bar keeps cluster
+ live pill; namespace scope moves to a filter sheet. Grid/Table only (Topology hidden).
Drawer becomes a full-screen bottom sheet with the same 3 tabs; Logs goes full-height. No
hamburger (there is no persistent nav to collapse).

## Hero / first view

Not a marketing hero. On load: Pods, all namespaces, Table view, sorted broken-first
(Failed, then Pending, then the rest). An operator opening the dashboard is usually
checking what is broken, not browsing. The live pill confirms data is current. Namespace
grid is one click away as the Namespaces view. Empty state is one muted line, no
illustration.

## Log viewer treatment

Lives as the third drawer tab in the split-pane (gets height from the resizable split, no
separate dock mode).

- Always dark surface (`#0b1220`), even in light theme. Logs are terminal output; the
  context shift is intentional and is the one component that breaks theme consistency on
  purpose.
- JetBrains Mono 13px, line-height 1.4, ligatures off, tabular timestamps in muted color.
- Toolbar row, all toggles labeled (no icon-only): container selector (dropdown), wrap
  toggle, follow toggle, scroll-to-bottom, timestamp show/hide, download.
- Follow is the key interaction. While following, a subtle blue bottom border pulses.
  Scrolling up auto-pauses follow and shows a "jump to live" chip (reuses the live glow).
- Level coloring reuses status tokens exactly: WARN = pending amber, ERROR = failed red,
  INFO/default = primary text. No new palette.
- Flush to panel edges, no inner borders, no card radius. Reads as a pane, not a card.

## Component-structure changes (from current single-scroll)

- NEW `AppShell`: owns rail + top bar + optional status footer, renders center `children`.
  `app/page.tsx` becomes the center host; drops the centered single-column CSS.
- NEW `ResourceRail`: icon nav, 10 kinds, live counts. Owns `resourceType` (lifted from
  page).
- NEW `TopBar`: `NamespaceScope` selector (lifts `selectedNamespace`), cluster context,
  Cmd+K trigger, `ConnectionStatus` pill.
- `NamespaceCanvas` becomes the Namespaces center view (unchanged internally).
- `ResourceExplorer` loses its section wrapper; `ViewToggle` moves into a new `ViewHeader`
  (view name + count + toggle). Topology folds in as the Topology view.
- `ResourceDrawer`: gains a `Logs` tab and becomes a resizable split-pane host.
  `ResourceTabs` gains the third tab.
- NEW `LogViewer`: container selector, wrap/follow/scroll-to-bottom, always-dark surface.
  Consumes a logs stream endpoint (backend work, separate).
- `QuickFilter` (Cmd+K): behavior unchanged, re-anchored to the shell z-layer.
- `useKubernetesData`: expose `connectionState` (live/reconnecting/disconnected) and
  per-kind counts for rail badges. SSE core unchanged.
- `tokens.css`: add dark set under `[data-theme="dark"]`, add slate ramp + `--n-600`,
  retire `--text-3xl/4xl` and `--radius-lg/xl` from use, swap `--font-sans`/`--font-mono`
  to JetBrains Mono. Fill the empty dark-mode stub, gate on the theme attribute (light
  default).

## Sequencing (scaffold first, log viewer early)

1. **Tokens + AppShell scaffold.** New tokens (mono font, slate ramp, dark set), build
   `AppShell` + `ResourceRail` + `TopBar`, move page content into the center. Behavior
   preserved, just restructured. Verify: builds, renders, all views reachable, light/dark
   toggle works.
2. **ResourceDrawer -> split-pane + ViewHeader.** Drawer becomes resizable split with the
   Overview/YAML tabs; add the empty Logs tab shell. This lands the surface the log viewer
   needs EARLY so it is not gated on the whole overhaul.
3. **Visual pass on the views.** Namespace cards (borders not shadows), tables (dense mono,
   tabular figures), toggle as flat tabs. The restyle of existing content.
4. **LogViewer component** (frontend) once the backend logs stream endpoint exists.
   Backend: a `GET /api/logs` or SSE stream using client-go `GetLogs().Stream()`.

## Synthesis decision

Two shapes were sketched. A: persistent operator console (icon rail + top bar + swapping
center). B: focus workspace (no sidebar, a full-width scope bar is the navigation,
split-pane drawer, mono everything).

Took A's persistent-shell structure. For a dashboard an operator keeps open to answer
"what is broken," always-visible resource-type nav with live count badges makes cluster
state ambient. B's scope-bar-only hides kind switching behind a command action, better for
a calm canvas than a monitor.

Took B's corrections. Mono as the primary UI face, not A's safe sans-labels/mono-data
split, because the all-mono face is the braver, more characterful identity and the whole
point is to read as a tool. Reserved a prose fallback only for multi-line text so mono does
not tire the eye. And took B's single resizable split-pane for logs over A's two-mode
drawer+bottom-dock, which A itself flagged as competing for screen space. Subtract the
second mode.

Corrected both on the default theme. A made dark default (A flagged this as beyond the
brief). The brief said add a dark theme, not make it default. Light stays default, dark is
a toggle, log pane always dark. One attribute flip if dark-default is wanted later.

Typeface is JetBrains Mono (free, OFL) not Berkeley Mono (paid web license, B's flagged
risk) or Geist.

## Open items for the reviewer

- Dark as default vs light as default. Plan says light; one line to flip.
- The rail's 10 glyphs need picking (an icon set, or simple lettered marks). Not blocking.
- Backend logs endpoint shape (plain streaming GET vs SSE) is designed in step 4, not now.
- Topology view internals are not redesigned here, only relocated into the explorer.
