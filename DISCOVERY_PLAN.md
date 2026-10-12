# Dynamic Resource Discovery: Design (synthesized)

Status: design agreed by the arena pass, awaiting checkpoint before implementation.
Goal: the sidebar reflects what the cluster actually holds. Built-in kinds AND CRDs show
up, a kind appears only when instances exist, and a newly-created kind gets its own section
within ~60s. Supersedes nothing; this is additive to the current typed resource layer.

Produced by the architect skill. Two candidates (full generic rewrite, hybrid tier) were
sketched by separate models and synthesized here. Decision at the bottom.

## Decision in one line

Keep the 10 curated typed kinds exactly as they are. Add a generic discovery tier beside
them for every other kind, using Kubernetes server-side Table printing for that tier's
columns. Do not rewrite the core resource layer.

## Why (the fork both candidates exposed)

The full-generic rewrite (candidate A) is elegant but has a disqualifying cost it named
itself. Server-side Table cells are computed by the apiserver, so a live watch event cannot
recompute them. Pods would lose their live `2/3 Ready` and restart columns between relists.
That is a regression in the exact view operators care about most, traded for uniformity.
The curated typed views are Licht's current quality. Keep them.

The hybrid (candidate B) keeps the curated path untouched and adds discovery alongside, so
there is zero regression risk to pods/deployments. Its one weakness was a bland
name/namespace/age/status projection for unknown kinds. Candidate A's server-side Table
printing fixes exactly that. So the synthesis is B's structure with A's column mechanism in
the generic tier.

## Architecture

Two tiers, one rail.

- **Curated tier (unchanged).** The 10 typed fetchers, their REST routes, the typed
  `watch_multi` stream, and the typed frontend rendering stay exactly as they are. Live
  Ready/Restarts/IP preserved. No regression.
- **Generic tier (new).** A discovery service enumerates every other resource type, lists
  it via server-side Table printing (so each kind gets its own `kubectl get` columns,
  including CRD `additionalPrinterColumns`), and a generic SSE stream keeps counts and rows
  live. The rail merges both tiers, count-gated.

### Discovery service (shared state, concurrency crux)

Both candidates converged on this shape. One `*Service` for the pod lifetime, RWMutex,
copy-on-write snapshot.

```go
// go/handlers/discovery/discovery.go (new package)

type GVRInfo struct {
	GVR        schema.GroupVersionResource
	Kind       string
	Namespaced bool
}

type Service struct {
	disco discovery.DiscoveryInterface
	dyn   dynamic.Interface
	mu    sync.RWMutex // guards gvrs
	gvrs  []GVRInfo    // rebuilt atomically by Refresh, read by handlers + SSE
}

// curatedKinds are owned by the typed path; discovery skips them so a kind is
// never rendered twice.
var curatedKinds = map[string]bool{
	"Pod": true, "Service": true, "Deployment": true, "ReplicaSet": true,
	"StatefulSet": true, "DaemonSet": true, "Job": true, "CronJob": true,
	"Node": true, "Namespace": true,
}

func New(disco discovery.DiscoveryInterface, dyn dynamic.Interface) *Service
func (s *Service) Refresh(ctx context.Context) error // ServerPreferredResources, build new slice, swap under write lock
func (s *Service) GVRs() []GVRInfo                    // read lock, returns a COPY (callers never mutate the backing array)
func (s *Service) Run(ctx context.Context, every time.Duration) // ticker calling Refresh (60s)
```

Concurrency rules, stated so the next engineer does not break them:
- `gvrs` is the only shared mutable state. `Refresh` builds a brand-new slice off-lock and
  swaps it under the write lock. It never mutates in place.
- `GVRs()` returns a copy, so a reader iterating during a refresh is never torn.
- No handler touches `s.gvrs` directly. One `*Service`, built in main.go, injected.

### API surface (generic routes added alongside the curated 10)

```
GET /api/discovery                                  -> []GVRInfo (kinds present, namespaced flag)
GET /api/resources/{group}/{version}/{resource}     -> metav1.Table (columns + rows)
GET /api/watch/generic                              -> SSE, generic events for discovered GVRs
```

The curated `/api/pods` etc. and `/api/watch/stream` stay. `{group}` uses the literal
`core` for the empty group (URLs cannot carry an empty segment); resolve back to "" in the
handler. Pin this convention once, shared Go and TS, so no one invents `_` or `v1`.

```go
// go/handlers/resources.go (new)
func Discovery(d *discovery.Service) http.HandlerFunc
func ListResource(dyn dynamic.Interface) http.HandlerFunc // sets Accept: application/json;as=Table;g=meta.k8s.io;v=v1
```

### Columns: server-side Table printing (A's mechanism, for the generic tier only)

The generic list handler sets `Accept: application/json;as=Table;g=meta.k8s.io;v=v1` and
decodes `metav1.Table`. That returns `ColumnDefinitions` and `Rows` the apiserver computed,
the same columns `kubectl get` shows, correct for built-ins and CRDs with no per-kind code.
The frontend renders columns straight from `ColumnDefinitions` (dropping priority>0 to match
kubectl's default view) and cells from `Rows`.

Honest limit, scoped to the generic tier only: watch does not carry Table cells, so a live
ADDED/MODIFIED event on a discovered kind updates name/namespace/age generically and the
full curated cells refresh on the next relist (on rail click, or periodic). This limit does
NOT touch the curated 10, which keep live cells via their typed path. This is the price of
generic columns and it is paid only where there is no typed alternative.

### Counts and "appears when created"

Counts come from the live SSE stream, not from listing every GVR (both candidates agreed).
The rail shows a kind once its SYNC produces at least one object. A brand-new kind appears
when discovery's next 60s refresh adds its GVR and the generic stream SYNCs its first
object. CRD instances of an already-known kind appear instantly via the running watcher.
Only a brand-new kind waits up to the refresh interval.

### Generic SSE

A second stream at `/api/watch/generic`, not a graft onto `watch_multi` (keeps the tested
typed stream untouched, and an RBAC denial on one discovered GVR cannot break the curated
stream). Per connection: SYNC each `d.GVRs()`, then watch each from its resourceVersion,
one goroutine per watcher feeding the existing mutex-guarded `write()`. On each 60s tick,
re-read `d.GVRs()` and start watchers for newly-present GVRs (per-connection
`map[GVR]stopper` so none duplicate).

## RBAC (the real cost, named)

Watching arbitrary kinds cluster-wide needs broad grants. Both candidates independently said
the same thing: do NOT ship `*/*` with write by default.

- Default `rbac.discoverAll: false`. The generic tier returns empty for kinds the SA cannot
  list; the rail hides them (count 0). RBAC errors in Refresh are treated as absent. No code
  branch needed.
- `rbac.discoverAll: true` renders a second ClusterRole: `verbs: [get, list, watch]` on
  `resources: ["*"]`, `apiGroups: ["*"]`. READ ONLY. Writes stay restricted to the curated
  kinds. The Helm comment must say: enables cluster-wide read of every resource including
  all Secrets; review your threat model before enabling on shared clusters.

Stated plainly for the operator: turning this on lets anyone who reaches the login-less
dashboard read every Secret in the cluster. That is the cost of "discover any kind." Read is
the default; write on `*` is never shipped.

## Frontend

Additive. The typed views are untouched.

- NEW `hooks/useDiscovery.ts` (polls `/api/discovery`), `hooks/useGenericStream.ts`
  (EventSource `/api/watch/generic`, keyed by `group/version/resource`).
- NEW `components/GenericTable.tsx`: renders `ColumnDefinitions` + `Rows` from the Table
  snapshot. The existing `ResourceTable` already takes `columns` + `data`, so this is a thin
  wrapper, not a new table engine.
- CHANGED `ResourceRail`: `RailView` widens to `string`. Curated 10 render first, a divider,
  then discovered kinds (count>0) with keys `group/version/resource` (no collision with
  curated keys, which contain no `/`). `page.tsx` switches on whether the active key is
  curated (ResourceExplorer) or generic (GenericTable).
- `useKubernetesData.ts` unchanged. Generic data lives in the new hooks.

## Dependencies

`k8s.io/client-go/dynamic` and `/discovery` are already in the client-go v0.31 tree,
transitive today. Add explicit `require` lines and `go mod tidy`. No new external modules.

## Sequencing

1. **Discovery service + /api/discovery** (Go). The service, Refresh/Run/GVRs, the discovery
   route. Verify with `discoveryfake` + `dynamicfake` that it enumerates non-curated GVRs and
   swaps snapshots safely.
2. **Generic list route** (Table printing) + **generic SSE stream**. Verify a CRD lists with
   its own columns and streams.
3. **Helm RBAC toggle** (`rbac.discoverAll`, default off, read-only wildcard when on).
4. **Frontend**: discovery hook, generic stream hook, GenericTable, rail merge. Verify a
   discovered kind appears in the rail and renders its columns.

## Synthesis decision

Two shapes. A: full generic rewrite, delete the typed fetchers, Table printing everywhere.
B: keep curated typed kinds, add a generic tier beside them.

Took B's hybrid structure. A's own report named the disqualifying cost of going fully
generic: server-side Table cells cannot update on watch events, so pods lose their live
Ready/restart columns between relists. That regresses the most-used view to buy uniformity.
The curated typed views are Licht's quality; keep them untouched, zero regression risk.

Took A's column mechanism for the generic tier. B proposed a flat name/namespace/age/status
projection for unknown kinds, but A's server-side Table printing gives each discovered kind
its own real columns (including CRD additionalPrinterColumns) with no code. That is literally
"a new resource type gets its own section" done right. The live-cell lag limit is accepted
only in the generic tier, where there is no typed alternative anyway.

Both agreed on the rest: one RWMutex discovery service with copy-on-write snapshots, counts
from the live stream, a separate generic SSE stream, and broad-read-only RBAC gated off by
default with no `*` write.

## Open items

- Relist cadence for refreshing generic Table cells (rail click vs periodic). Decide in step 4.
- Whether discovered kinds get YAML view/edit too (the curated drawer is typed; generic
  drawer is more work). Propose: YAML view yes (it is already string/map based), edit later.
- The 60s discovery interval is a guess; tune if "new kind appears" feels slow.
