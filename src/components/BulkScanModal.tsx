import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScanLine, X, Camera, CameraOff, CheckCircle2, XCircle, Volume2, VolumeX, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/courier-status";

type ScanMode = "auto" | "confirmed_to_rts" | "rts_to_courier";

const MODES: { value: ScanMode; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Confirmed → Ready to ship, Ready to ship → To courier" },
  { value: "confirmed_to_rts", label: "Confirmed → Ready to ship", hint: "Only confirmed orders" },
  { value: "rts_to_courier", label: "Ready to ship → To courier", hint: "Handover to courier" },
];

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
  const allowConfirm = mode === "auto" || mode === "confirmed_to_rts";
  const allowCourier = mode === "auto" || mode === "rts_to_courier";
  if (current === "confirmed" && allowConfirm) return { to: "ready_to_ship" };
  if (current === "ready_to_ship" && allowCourier) return { to: "shipped" };
  if (current === "ready_to_ship" && !allowCourier)
    return { error: "Already ready to ship" };
  if (current === "shipped") return { error: "Already handed to courier" };
  return { error: `Not allowed from ${orderStatusLabel(current)}` };
}

/* ---------------- component ---------------- */

export function BulkScanButton({
  compact = false,
  onDone,
  className,
}: {
  compact?: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Bulk scan handover"
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20",
          className,
        )}
      >
        <ScanLine className="h-4 w-4" />
        {compact ? <span className="hidden sm:inline">Bulk scan</span> : <span>Bulk scan</span>}
      </button>
      {open && (
        <BulkScanModal
          onClose={() => {
            setOpen(false);
            onDone?.();
          }}
        />
      )}
    </>
  );
}

function BulkScanModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<ScanMode>("auto");
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
      if (seenAt && nowTs - seenAt < 2500) return;
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
        const step = nextStatus(mode, order.status as string);
        if ("error" in step) {
          if (sound) beepError();
          setLast({ ok: false, text: step.error, sub: order.order_number });
          push({ code: order.order_number, ok: false, message: step.error });
          return;
        }
        const { error } = await supabase
          .from("orders")
          .update({ status: step.to as any })
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
          note: "Bulk scan handover",
        });
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
    [mode, push, sound],
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

  const modeHint = MODES.find((m) => m.value === mode)?.hint ?? "";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border bg-card shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3 sm:px-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <ScanLine className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold">Bulk scan · courier handover</div>
            <div className="truncate text-xs text-muted-foreground">{modeHint}</div>
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
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ScanMode)}
                className="h-10 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
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
            {counts.ok} handed over · {counts.fail} failed
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
