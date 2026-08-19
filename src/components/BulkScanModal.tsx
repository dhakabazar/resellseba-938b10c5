import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ScanLine, X, Camera, CameraOff, CheckCircle2, XCircle, Volume2, VolumeX, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/courier-status";

/** Two fixed logics — no auto detection. */
export type ScanMode = "handover" | "return";

const MODES: Record<ScanMode, { title: string; hint: string; from: string; to: string; note: string }> = {
  handover: {
    title: "Bulk scan · Courier Handover",
    hint: "Packaging → Courier Handover",
    from: "packaging",
    to: "ready_to_ship",
    note: "Bulk scan handover",
  },
  return: {
    title: "Bulk scan · Return received",
    hint: "Pending Return → Returned",
    from: "pending_return",
    to: "returned",
    note: "Bulk scan return received",
  },
};

type LogRow = {
  id: string;
  code: string;
  ok: boolean;
  message: string;
  at: number;
};

/* ---------------- sound ---------------- */

let audioCtx: AudioContext | null = null;
function ctx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}
function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.16) {
  const ac = ctx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.02);
}
function beepSuccess() {
  tone(1180, 0, 0.09, "sine", 0.18);
  tone(1560, 0.08, 0.1, "sine", 0.14);
}
function beepError() {
  tone(220, 0, 0.18, "square", 0.12);
  tone(160, 0.2, 0.28, "square", 0.12);
}

/* ---------------- helpers ---------------- */

function cleanCode(raw: string) {
  return raw.trim().replace(/^#/, "").replace(/\s+/g, "");
}

async function findOrder(code: string) {
  const c = cleanCode(code);
  if (!c) return null;
  const { data: byNumber } = await supabase
    .from("orders")
    .select("id, order_number, status, customer_name")
    .ilike("order_number", c)
    .limit(1)
    .maybeSingle();
  if (byNumber) return byNumber;

  const { data: ship } = await supabase
    .from("shipments")
    .select("order_id")
    .or(`tracking_id.eq.${c},consignment_id.eq.${c}`)
    .limit(1)
    .maybeSingle();
  if (!ship?.order_id) return null;
  const { data: byShip } = await supabase
    .from("orders")
    .select("id, order_number, status, customer_name")
    .eq("id", ship.order_id)
    .maybeSingle();
  return byShip ?? null;
}

function nextStatus(mode: ScanMode, current: string): { to: string } | { error: string } {
  const m = MODES[mode];
  if (current === m.from) return { to: m.to };
  if (current === m.to) return { error: `Already in ${orderStatusLabel(m.to)}` };
  return {
    error: `Not allowed — order is in ${orderStatusLabel(current)} (needs ${orderStatusLabel(m.from)})`,
  };
}

/* ---------------- component ---------------- */

export function BulkScanButton({
  compact = false,
  mode = "handover",
  onDone,
  className,
}: {
  compact?: boolean;
  mode?: ScanMode;
  onDone?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={MODES[mode].hint}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20",
          className,
        )}
      >
        <ScanLine className="h-4 w-4" />
        {(() => {
          const label = mode === "return" ? "Bulk return" : "Bulk scan";
          return compact ? <span className="hidden sm:inline">{label}</span> : <span>{label}</span>;
        })()}
      </button>
      {open && mounted
        ? createPortal(
            <BulkScanModal
              mode={mode}
              onClose={() => {
                setOpen(false);
                onDone?.();
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function BulkScanModal({ mode: initialMode, onClose }: { mode: ScanMode; onClose: () => void }) {
  const [mode, setMode] = useState<ScanMode>(initialMode);
  const cfg = MODES[mode];
  const [sound, setSound] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [last, setLast] = useState<{ ok: boolean; text: string; sub?: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const seenRef = useRef<Map<string, number>>(new Map());
  const doneRef = useRef<Map<string, string>>(new Map());
  const busyRef = useRef(false);



  const counts = useMemo(
    () => ({
      ok: logs.filter((l) => l.ok).length,
      fail: logs.filter((l) => !l.ok).length,
    }),
    [logs],
  );

  const push = useCallback((row: Omit<LogRow, "id" | "at">) => {
    setLogs((prev) => [{ ...row, id: crypto.randomUUID(), at: Date.now() }, ...prev].slice(0, 200));
  }, []);

  const handleCode = useCallback(
    async (raw: string) => {
      const code = cleanCode(raw);
      if (!code || busyRef.current) return;
      const nowTs = Date.now();
      const seenAt = seenRef.current.get(code);
      if (seenAt && nowTs - seenAt < 900) return;
      seenRef.current.set(code, nowTs);

      busyRef.current = true;
      setBusy(true);
      try {
        const order = await findOrder(code);
        if (!order) {
          if (sound) beepError();
          setLast({ ok: false, text: "Order not found", sub: code });
          push({ code, ok: false, message: "Order not found" });
          return;
        }
        // one order = one scan, no matter which code (order no / tracking / consignment) was used
        const already = doneRef.current.get(order.id);
        if (already) {
          if (sound) beepError();
          setLast({
            ok: false,
            text: `Duplicate scan · ${order.order_number}`,
            sub: `Already scanned (${already})`,
          });
          push({ code: order.order_number, ok: false, message: `Duplicate — already scanned (${already})` });
          return;
        }
        const step = nextStatus(mode, order.status as string);
        if ("error" in step) {

          if (sound) beepError();
          setLast({ ok: false, text: step.error, sub: order.order_number });
          push({ code: order.order_number, ok: false, message: step.error });
          return;
        }
        const { error } = await supabase
          .from("orders")
          .update(
            mode === "return"
              ? ({ status: step.to, received_amount: 0, settled_at: new Date().toISOString() } as any)
              : ({ status: step.to } as any),
          )
          .eq("id", order.id);
        if (error) {
          if (sound) beepError();
          setLast({ ok: false, text: error.message, sub: order.order_number });
          push({ code: order.order_number, ok: false, message: error.message });
          return;
        }
        await supabase.from("order_status_history").insert({
          order_id: order.id,
          status: step.to as any,
          note: cfg.note,
        });
        doneRef.current.set(order.id, orderStatusLabel(step.to));
        if (sound) beepSuccess();

        setLast({
          ok: true,
          text: `${order.order_number} → ${orderStatusLabel(step.to)}`,
          sub: order.customer_name ?? undefined,
        });
        push({ code: order.order_number, ok: true, message: orderStatusLabel(step.to) });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [push, sound, mode, cfg.note],
  );

  // keep the scan box focused for hardware scanners, but never steal focus
  // away from other controls (mode dropdown, buttons) the user is using.
  useEffect(() => {
    const t = setInterval(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el === inputRef.current) return;
      const tag = el?.tagName;
      const interactive =
        tag === "SELECT" || tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "OPTION";
      if (interactive) return;
      inputRef.current?.focus();
    }, 1200);
    inputRef.current?.focus();
    return () => clearInterval(t);
  }, []);

  // esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // lock page scroll while the modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);


  // camera scanning
  useEffect(() => {
    let cancelled = false;
    async function start() {
      setCamError(null);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 250 });
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (result) => {
            if (result) void handleCode(result.getText());
          },
        );
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch (e: any) {
        if (!cancelled) {
          setCamError(e?.message ?? "Camera unavailable");
          setCamOn(false);
        }
      }
    }
    if (camOn) {
      // unlock audio on the same user gesture
      ctx();
      void start();
    }
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [camOn, handleCode]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border bg-card shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3 sm:px-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <ScanLine className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold">{cfg.title}</div>
            <div className="truncate text-xs text-muted-foreground">{cfg.hint}</div>
          </div>
          <button
            type="button"
            onClick={() => setSound((s) => !s)}
            title={sound ? "Mute beeps" : "Enable beeps"}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1.1fr_1fr]">
          {/* left: controls */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Scan mode</label>
              <div className="grid grid-cols-2 gap-2">
                {(["handover", "return"] as ScanMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors",
                      mode === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span className="block">{m === "return" ? "Return received" : "Courier handover"}</span>
                    <span className="block text-[10px] font-normal opacity-80">{MODES[m].hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
              {cfg.hint}
            </div>


            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = value;
                setValue("");
                void handleCode(v);
              }}
            >
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Scanner / manual entry
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Scan barcode or type order number…"
                  autoComplete="off"
                  className="h-11 w-full rounded-md border bg-background pl-3 pr-10 text-sm font-mono outline-none focus:ring-2 focus:ring-primary"
                />
                {busy && (
                  <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                USB/Bluetooth scanner works directly — this box stays focused.
              </p>
            </form>

            <button
              type="button"
              onClick={() => setCamOn((v) => !v)}
              className={cn(
                "inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors",
                camOn
                  ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              {camOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {camOn ? "Stop camera" : "Use mobile camera"}
            </button>

            <div
              className={cn(
                "overflow-hidden rounded-xl border bg-black/90",
                camOn ? "aspect-video" : "hidden",
              )}
            >
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            </div>
            {camError && <p className="text-xs text-destructive">{camError}</p>}

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border bg-emerald-500/10 p-3 text-center">
                <div className="text-2xl font-extrabold text-emerald-600">{counts.ok}</div>
                <div className="text-[11px] font-medium text-emerald-700/80">Success scans</div>
              </div>
              <div className="rounded-xl border bg-destructive/10 p-3 text-center">
                <div className="text-2xl font-extrabold text-destructive">{counts.fail}</div>
                <div className="text-[11px] font-medium text-destructive/80">Errors</div>
              </div>
            </div>
          </div>

          {/* right: last result + log */}
          <div className="space-y-3">
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4 transition-colors",
                last == null
                  ? "bg-muted/40"
                  : last.ok
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-destructive/40 bg-destructive/10",
              )}
            >
              {last == null ? (
                <ScanLine className="h-6 w-6 text-muted-foreground" />
              ) : last.ok ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">
                  {last?.text ?? "Waiting for first scan…"}
                </div>
                {last?.sub && <div className="truncate text-xs text-muted-foreground">{last.sub}</div>}
              </div>
            </div>

            <div className="rounded-xl border">
              <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">
                Scan history
              </div>
              <div className="max-h-72 overflow-y-auto no-scrollbar divide-y">
                {logs.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No scans yet.</p>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 px-3 py-2">
                      {l.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                      )}
                      <span className="font-mono text-xs font-medium">{l.code}</span>
                      <span className="ml-auto truncate text-[11px] text-muted-foreground">
                        {l.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3 sm:px-5">
          <div className="text-xs text-muted-foreground">
            {counts.ok} updated · {counts.fail} failed
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
