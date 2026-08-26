import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  MapPin,
  MapPinPlus,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginationFooter } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  assignMapLocation,
  clearMapLocationAssignment,
  addMapPin,
  deleteMapPlace,
  fetchAdminMapPins,
  fetchMapLocationReview,
  fetchMapPlaces,
  setMapPlaceHidden,
  type AdminMapPin,
  type MapLocationReview,
  type MapPlaceOption,
} from "@/features/map/api";

const WorldMap = lazy(() =>
  import("@/features/map/components/WorldMap").then((m) => ({ default: m.WorldMap })),
);

const PAGE_SIZE = 8;

/** "1 church", "2 churches". English plurals, and only where they are needed. */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The operator's half of the pin map.
 *
 * Three things it has to make possible, in the order they come up in practice:
 *
 *  1. See what the public map is showing, hidden pins included, so a bad pin
 *     can be found at all.
 *  2. Read a location the matcher got WRONG and put it right. This is the one
 *     that matters: the matcher is a gazetteer, not a geocoder, and the honest
 *     answer to "what if it misreads an answer" is a screen where a human
 *     corrects it -- not a promise that it never will.
 *  3. Drop a pin somewhere the gazetteer has never heard of.
 *
 * None of it writes to churches or download_signups. A correction is an
 * override recorded beside the answer, so the answer somebody actually gave
 * survives intact and the correction can be undone.
 */
export function MapPinsCard() {
  const [pins, setPins] = useState<AdminMapPin[] | null>(null);
  const [review, setReview] = useState<MapLocationReview[] | null>(null);
  const [places, setPlaces] = useState<MapPlaceOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * The map is armed to drop a pin.
   *
   * `null` when it is not. When it is, `answer` says whether the pin being
   * dropped is FOR a particular unreadable answer -- which is the flow that
   * matters, and the reason this is not just a boolean.
   */
  const [placing, setPlacing] = useState<{ answer: MapLocationReview | null } | null>(null);
  const [draft, setDraft] = useState<{
    lat: number;
    lng: number;
    name: string;
    answer: MapLocationReview | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const [assigning, setAssigning] = useState<MapLocationReview | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminMapPin | null>(null);
  const [search, setSearch] = useState("");
  const mapRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [p, r, g] = await Promise.all([
        fetchAdminMapPins(),
        fetchMapLocationReview(),
        fetchMapPlaces(),
      ]);
      setPins(p);
      setReview(r);
      setPlaces(g);
      setLoadError(null);
    } catch (err) {
      console.error(err);
      // Not setPins([]) -- an empty map and an unreadable one would render the
      // same "nothing here" and only one of them is true.
      setPins(null);
      setReview(null);
      setLoadError(err instanceof Error ? err.message : "Couldn't load the map.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, work: () => Promise<void>, message: string) {
    setBusy(key);
    try {
      await work();
      toast.success(message);
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate() {
    if (!draft || draft.name.trim().length < 2) return;
    setSaving(true);
    try {
      await addMapPin({
        name: draft.name.trim(),
        lat: draft.lat,
        lng: draft.lng,
        // Creating the pin and pointing the answer at it happen together in
        // one function, so a failure cannot leave a pin on the public map with
        // nothing behind it and the answer still unplaced.
        forLocationKey: draft.answer?.location_key ?? null,
      });
      toast.success(
        draft.answer
          ? `"${draft.answer.sample}" is now on the map.`
          : "Pin added to the map.",
      );
      setDraft(null);
      setPlacing(null);
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't add that pin.");
    } finally {
      setSaving(false);
    }
  }

  /** Arms the map to drop a pin, optionally for a particular answer. */
  function startPlacing(answer: MapLocationReview | null) {
    setAssigning(null);
    setPlacing({ answer });
    // The map is above the tables; without this the operator arms the picker
    // and is left looking at a table with no visible map to click.
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // The public map hides these; the operator's shows them hollow, because the
  // whole point of hiding one is being able to find it again.
  const mapPins = useMemo(
    () => (pins ?? []).map((pin) => ({ ...pin, muted: pin.is_hidden })),
    [pins],
  );

  // The answers nobody could place. Their own table, and the default tab,
  // because they are the only rows on this screen with work outstanding --
  // everything else is already on the map and correct until proven otherwise.
  // `is_ignored` ones are excluded: those were ruled off the map deliberately
  // and are not waiting on anybody.
  const unreadable = (review ?? []).filter((r) => r.place_id === null && !r.is_ignored);
  const hiddenCount = pins?.filter((p) => p.is_hidden).length ?? 0;

  const filteredReview = (review ?? []).filter((r) =>
    search ? r.sample.toLowerCase().includes(search.toLowerCase()) : true,
  );
  const reviewPage = usePagination(filteredReview, PAGE_SIZE, search);
  const unreadablePage = usePagination(unreadable, PAGE_SIZE, String(unreadable.length));
  const pinsPage = usePagination(pins ?? [], PAGE_SIZE, String(pins?.length ?? 0));

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-xl text-foreground">Pin map</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Every location answer from onboarding and the desktop download survey,
            resolved to a province or a country and drawn on the{" "}
            <a href="/" className="underline underline-offset-4 hover:text-foreground">
              landing page
            </a>
            . Nothing here is typed in twice — correct a reading and the public map
            follows.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void load()}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {loadError && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <TriangleAlert className="h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Couldn't load the map</p>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{loadError}</p>
          </div>
        </div>
      )}

      <div ref={mapRef} className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="aspect-[16/9] w-full sm:aspect-[2/1]">
          {pins === null ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <WorldMap
                pins={mapPins}
                tone="day"
                // The map IS this screen, not something to scroll past.
                gesture="direct"
                className="h-full w-full"
                onPickCoordinates={
                  placing
                    ? (lat, lng) =>
                        setDraft({
                          lat,
                          lng,
                          // Prefilled with what the church actually typed:
                          // when placing an answer, that IS the name of the
                          // place, and retyping it would be busywork.
                          name: placing.answer?.sample ?? "",
                          answer: placing.answer,
                        })
                    : undefined
                }
                toolbar={
                  <button
                    type="button"
                    title={placing ? "Stop placing pins" : "Place a pin by hand"}
                    aria-pressed={!!placing}
                    onClick={() => setPlacing((v) => (v ? null : { answer: null }))}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md ring-1 backdrop-blur transition-colors",
                      placing
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-white/90 text-foreground ring-border hover:bg-white",
                    )}
                  >
                    <MapPinPlus className="h-4 w-4" />
                  </button>
                }
              />
            </Suspense>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {placing ? (
            <span className="flex flex-wrap items-center gap-2 text-foreground">
              {placing.answer ? (
                <>
                  Click the map where{" "}
                  <strong className="font-medium">{placing.answer.sample}</strong> is.
                </>
              ) : (
                "Click the map to drop a pin."
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setPlacing(null)}
              >
                Cancel
              </Button>
            </span>
          ) : (
            <span>
              Drag to pan, scroll to zoom. Hollow pins are hidden from the public map.
            </span>
          )}
          {unreadable.length > 0 && !placing && (
            <span className="text-destructive">
              {plural(unreadable.length, "answer")} not on the map
            </span>
          )}
          {hiddenCount > 0 && !placing && <span>{hiddenCount} hidden</span>}
        </div>
      </div>

      <Tabs defaultValue="unreadable" className="mt-6">
        <TabsList>
          <TabsTrigger value="unreadable">
            Not on the map
            {unreadable.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">
                {unreadable.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="locations">
            All answers {review ? `(${review.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="pins">Pins {pins ? `(${pins.length})` : ""}</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------
            The answers the matcher could not read, and the two ways out of
            that: say where they are, or say they do not belong on the map.

            This is the default tab because it is the only one with work
            outstanding. A church that answered "Brgy. San Roque" is invisible
            on the landing page until somebody here says where that is, and
            without a list of them nobody would ever know.
        ------------------------------------------------------------------- */}
        <TabsContent value="unreadable" className="mt-4">
          {review === null ? (
            <Skeleton className="h-40 w-full" />
          ) : unreadable.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              Every answer is on the map. Nothing to do here.
            </p>
          ) : (
            <>
              <p className="mb-3 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                These churches told us where they are and the gazetteer could not
                read the answer — usually a barangay, a landmark, or a spelling
                nothing else uses. They are <strong>not on the public map</strong>{" "}
                until you place them. <em>Place on map</em> lets you pick a known
                province or drop a pin exactly where it belongs.
              </p>
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>What they answered</TableHead>
                      <TableHead className="hidden sm:table-cell">Behind it</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unreadablePage.visible.map((row) => (
                      <TableRow key={row.location_key}>
                        <TableCell>
                          <span className="block max-w-[20rem] truncate font-medium text-foreground">
                            {row.sample}
                          </span>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                          {row.churches > 0 && plural(row.churches, "church", "churches")}
                          {row.churches > 0 && row.downloads > 0 && " · "}
                          {row.downloads > 0 && plural(row.downloads, "download")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              className="h-8"
                              disabled={busy === row.location_key}
                              onClick={() => setAssigning(row)}
                            >
                              <MapPinPlus className="h-4 w-4" />
                              Place on map
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Keep this answer off the map"
                              disabled={busy === row.location_key}
                              onClick={() =>
                                void run(
                                  row.location_key,
                                  () => assignMapLocation(row.location_key, null),
                                  "Kept off the map.",
                                )
                              }
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {unreadable.length > PAGE_SIZE && (
                <PaginationFooter
                  page={unreadablePage.page}
                  pageCount={unreadablePage.pageCount}
                  pageSize={PAGE_SIZE}
                  total={unreadable.length}
                  onPageChange={unreadablePage.setPage}
                  noun="answer"
                />
              )}
            </>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------------
            What people typed, and where it landed. Unresolved answers sort to
            the top from the database, so the work to be done is the first
            thing on screen.
        ------------------------------------------------------------------- */}
        <TabsContent value="locations" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the answers..."
                className="pl-8"
              />
            </div>
          </div>

          {review === null ? (
            <Skeleton className="h-40 w-full" />
          ) : filteredReview.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              {review.length === 0
                ? "No location answers yet."
                : "No answers match your search."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Answer</TableHead>
                    <TableHead>Read as</TableHead>
                    <TableHead className="hidden sm:table-cell">Behind it</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewPage.visible.map((row) => (
                    <TableRow key={row.location_key}>
                      <TableCell>
                        <span className="block max-w-[16rem] truncate font-medium text-foreground">
                          {row.sample}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.is_ignored ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            Kept off the map
                          </Badge>
                        ) : row.place_name ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="text-foreground">{row.place_name}</span>
                            {row.is_assigned && (
                              <Badge variant="secondary" className="text-[10px]">
                                By hand
                              </Badge>
                            )}
                          </span>
                        ) : (
                          <Badge variant="destructive">Couldn't place it</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                        {row.churches > 0 && plural(row.churches, "church", "churches")}
                        {row.churches > 0 && row.downloads > 0 && " · "}
                        {row.downloads > 0 && plural(row.downloads, "download")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={busy === row.location_key}
                            onClick={() => setAssigning(row)}
                          >
                            {row.place_name ? "Move" : "Place it"}
                          </Button>
                          {row.is_assigned ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Hand it back to the matcher"
                              disabled={busy === row.location_key}
                              onClick={() =>
                                void run(
                                  row.location_key,
                                  () => clearMapLocationAssignment(row.location_key),
                                  "Back to the automatic reading.",
                                )
                              }
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Keep this answer off the map"
                              disabled={busy === row.location_key}
                              onClick={() =>
                                void run(
                                  row.location_key,
                                  () => assignMapLocation(row.location_key, null),
                                  "Kept off the map.",
                                )
                              }
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {review !== null && filteredReview.length > 0 && (
            <PaginationFooter
              page={reviewPage.page}
              pageCount={reviewPage.pageCount}
              pageSize={PAGE_SIZE}
              total={filteredReview.length}
              onPageChange={reviewPage.setPage}
              noun="answer"
            />
          )}
        </TabsContent>

        {/* ------------------------------------------------------------------
            The pins themselves. Hiding is offered for everything; deleting
            only for pins somebody added by hand, because deleting a seeded
            place would send every church in it back to unresolved.
        ------------------------------------------------------------------- */}
        <TabsContent value="pins" className="mt-4">
          {pins === null ? (
            <Skeleton className="h-40 w-full" />
          ) : pins.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing on the map yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Place</TableHead>
                    <TableHead className="hidden sm:table-cell">Churches</TableHead>
                    <TableHead className="hidden sm:table-cell">Downloads</TableHead>
                    <TableHead className="hidden lg:table-cell">Coordinates</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pinsPage.visible.map((pin) => (
                    <TableRow key={pin.id} className={pin.is_hidden ? "opacity-55" : undefined}>
                      <TableCell>
                        <span className="block font-medium text-foreground">{pin.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {pin.name === pin.country_name ? pin.kind : pin.country_name}
                          {pin.source === "manual" && " · added by hand"}
                          {pin.is_hidden && " · hidden"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">
                        {pin.churches}
                      </TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">
                        {pin.downloads}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap font-mono text-xs text-muted-foreground lg:table-cell">
                        {pin.lat.toFixed(2)}, {pin.lng.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={pin.is_hidden ? "Show on the public map" : "Hide from the public map"}
                            disabled={busy === pin.id}
                            onClick={() =>
                              void run(
                                pin.id,
                                () => setMapPlaceHidden(pin.id, !pin.is_hidden),
                                pin.is_hidden ? "Back on the map." : "Hidden from the map.",
                              )
                            }
                          >
                            {pin.is_hidden ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title={
                              pin.source === "manual"
                                ? "Delete this pin"
                                : "Seeded places can only be hidden, not deleted"
                            }
                            disabled={pin.source !== "manual" || busy === pin.id}
                            onClick={() => setPendingDelete(pin)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {pins !== null && pins.length > 0 && (
            <PaginationFooter
              page={pinsPage.page}
              pageCount={pinsPage.pageCount}
              pageSize={PAGE_SIZE}
              total={pins.length}
              onPageChange={pinsPage.setPage}
              noun="pin"
            />
          )}
        </TabsContent>
      </Tabs>

      <NameThePinDialog
        draft={draft}
        saving={saving}
        onChange={(name) => setDraft((d) => (d ? { ...d, name } : d))}
        onCancel={() => setDraft(null)}
        onSave={() => void handleCreate()}
      />

      <ChoosePlaceDialog
        row={assigning}
        places={places}
        onCancel={() => setAssigning(null)}
        onDropPin={() => startPlacing(assigning)}
        onChoose={(placeId) => {
          const row = assigning;
          setAssigning(null);
          if (row) {
            void run(
              row.location_key,
              () => assignMapLocation(row.location_key, placeId),
              "Placed on the map.",
            );
          }
        }}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this pin?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> is removed from the map for good.
              Any location answer that was assigned to it goes back to being
              unplaced. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                const pin = pendingDelete;
                setPendingDelete(null);
                if (pin) void run(pin.id, () => deleteMapPlace(pin.id), "Pin deleted.");
              }}
            >
              Delete pin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** Names a pin that has just been dropped on the map. */
function NameThePinDialog({
  draft,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  draft: { lat: number; lng: number; name: string; answer: MapLocationReview | null } | null;
  saving: boolean;
  onChange: (name: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Name this pin</DialogTitle>
          <DialogDescription>
            It shows on the public map straight away, whether or not any church has
            answered with this place.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pin-name">Name</Label>
            <Input
              id="pin-name"
              autoFocus
              maxLength={80}
              value={draft?.name ?? ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g. Sagada, Mountain Province"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (draft?.name.trim().length ?? 0) >= 2) onSave();
              }}
            />
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {draft ? `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}` : ""}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || (draft?.name.trim().length ?? 0) < 2}>
            {saving ? "Adding..." : "Add pin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Picks the place a misread answer really meant.
 *
 * A filtered list rather than a <select>: the gazetteer is over three hundred
 * entries, and the one you want is always findable by typing three letters of
 * it. Provinces come before countries because a correction almost always needs
 * one.
 */
function ChoosePlaceDialog({
  row,
  places,
  onCancel,
  onChoose,
  onDropPin,
}: {
  row: MapLocationReview | null;
  places: MapPlaceOption[];
  onCancel: () => void;
  onChoose: (placeId: string) => void;
  /** Escape hatch for an answer no gazetteer entry actually covers. */
  onDropPin: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (row) setQuery("");
  }, [row]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ranked = places.filter((p) => (q ? p.name.toLowerCase().includes(q) : true));
    return ranked
      .sort((a, b) => {
        // Anything sub-national first, then alphabetical.
        const rank = (p: MapPlaceOption) => (p.kind === "country" ? 1 : 0);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      })
      .slice(0, 60);
  }, [places, query]);

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Where does this belong?</DialogTitle>
          <DialogDescription>
            {row ? (
              <>
                Somebody answered <strong className="text-foreground">{row.sample}</strong>.
                Choosing a place here overrides the automatic reading for every
                church that gave that answer.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search provinces and countries..."
            className="pl-8"
          />
        </div>

        {/* Offered before the list, not after it. A barangay or a landmark is
            not in the gazetteer and never will be, so for the answers that
            reach this dialog most often, scrolling three hundred provinces
            looking for one that is not there is the wrong first move. */}
        <button
          type="button"
          onClick={onDropPin}
          className="flex w-full items-center gap-3 rounded-md border border-dashed border-border px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-muted"
        >
          <MapPinPlus className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">
              Drop a pin on the map instead
            </span>
            <span className="block text-xs text-muted-foreground">
              For somewhere the list below does not have — a barangay, a landmark,
              a village.
            </span>
          </span>
        </button>

        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          {matches.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing matches that.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {matches.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    onClick={() => onChoose(place.id)}
                  >
                    <span className="truncate text-foreground">{place.name}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                      {place.kind}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
