import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { gzipSync, gunzipSync, zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { Database, Download, Image as ImageIcon, Loader2, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import {
  backupManifest,
  backupRows,
  backupUsers,
  imageEnsureBuckets,
  imageManifest,
  imageRead,
  imageWrite,
  restoreRows,
  restoreTriggers,
  restoreUsers,
  restoreWipe,
  type BackupManifest,
  type ImageManifest,
} from "@/lib/backup.functions";

export const Route = createFileRoute("/_authenticated/admin/backup")({
  component: BackupPage,
  head: () => ({
    meta: [
      { title: "Backup & restore · Admin" },
      { name: "description", content: "Download a full backup of every table, account and image, and restore it into any project." },
      { property: "og:title", content: "Backup & restore · Admin" },
      { property: "og:description", content: "Full data and image backup with one-click restore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PAGE = 2000;
const RESTORE_CHUNK = 500;

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

function saveFile(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode(...Array.from(bytes.subarray(i, i + CH)));
  }
  return btoa(s);
}

function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesLabel(n: number) {
  if (n > 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n > 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function BackupPage() {
  const getManifest = useServerFn(backupManifest);
  const getRows = useServerFn(backupRows);
  const getUsers = useServerFn(backupUsers);
  const putRows = useServerFn(restoreRows);
  const putUsers = useServerFn(restoreUsers);
  const setTriggers = useServerFn(restoreTriggers);
  const wipe = useServerFn(restoreWipe);
  const getImages = useServerFn(imageManifest);
  const readImage = useServerFn(imageRead);
  const writeImage = useServerFn(imageWrite);
  const ensureBuckets = useServerFn(imageEnsureBuckets);

  const [manifest, setManifest] = useState<BackupManifest | null>(null);
  const [images, setImages] = useState<ImageManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [pending, setPending] = useState<{ kind: "db" | "img"; file: File } | null>(null);
  const dbInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);

  const [imgLoading, setImgLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setManifest(await getManifest({}));
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read backup info");
    }
    setLoading(false);
  }

  /** Scanning image folders can take a while, so it runs on its own. */
  async function scanImages(): Promise<ImageManifest | null> {
    setImgLoading(true);
    try {
      const i = await getImages({});
      setImages(i);
      return i;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read image folders");
      return null;
    } finally {
      setImgLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalRows = (manifest?.tables ?? []).reduce((s, t) => s + Number(t.rows), 0);
  const imageFiles = (images?.buckets ?? []).reduce((s, b) => s + b.files.length, 0);
  const imageBytes = (images?.buckets ?? []).reduce((s, b) => s + b.files.reduce((x, f) => x + f.size, 0), 0);

  /* ------------------------------ DB backup ------------------------------ */
  async function downloadDatabase() {
    if (!manifest) return;
    setBusy("db-backup");
    try {
      const tables: Record<string, any[]> = {};
      const tasks: { table: string; offset: number }[] = [];
      for (const t of manifest.tables) {
        tables[t.name] = [];
        for (let off = 0; off < Number(t.rows); off += PAGE) tasks.push({ table: t.name, offset: off });
      }
      const userTasks: number[] = [];
      for (let off = 0; off < Number(manifest.users); off += PAGE) userTasks.push(off);

      const total = tasks.length + userTasks.length || 1;
      let done = 0;
      setProgress({ label: "Reading data", done, total });

      const users: any[] = [];
      await pool(tasks, 4, async (task) => {
        const rows = await getRows({ data: { table: task.table, offset: task.offset, limit: PAGE } });
        tables[task.table]!.push(...rows);
        setProgress({ label: "Reading data", done: ++done, total });
      });
      await pool(userTasks, 3, async (off) => {
        const rows = await getUsers({ data: { offset: off, limit: PAGE } });
        users.push(...rows);
        setProgress({ label: "Reading accounts", done: ++done, total });
      });

      setProgress({ label: "Packing file", done: total, total });
      const payload = JSON.stringify({ manifest, users, tables });
      const gz = gzipSync(strToU8(payload), { level: 6 });
      saveFile(gz, `data-backup-${stamp()}.json.gz`);
      toast.success(`Backup ready — ${totalRows.toLocaleString()} rows, ${users.length.toLocaleString()} accounts`);
    } catch (e: any) {
      toast.error(e?.message ?? "Backup failed");
    }
    setProgress(null);
    setBusy(null);
  }

  /* ------------------------------ DB restore ----------------------------- */
  async function restoreDatabase(file: File) {
    setBusy("db-restore");
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      const text = /\.gz$/i.test(file.name) ? strFromU8(gunzipSync(raw)) : strFromU8(raw);
      const data = JSON.parse(text) as { manifest: BackupManifest; users: any[]; tables: Record<string, any[]> };
      const order = (data.manifest?.tables ?? []).map((t) => t.name);
      const names = order.length ? order : Object.keys(data.tables ?? {});

      const total =
        1 +
        Math.ceil((data.users?.length ?? 0) / 200) +
        names.reduce((s, n) => s + Math.ceil((data.tables[n]?.length ?? 0) / RESTORE_CHUNK), 0) || 1;
      let done = 0;
      const tick = (label: string) => setProgress({ label, done: ++done, total });

      setProgress({ label: "Preparing", done: 0, total });
      await setTriggers({ data: { enabled: false } });
      try {
        await wipe({ data: { tables: null } });
        tick("Clearing old data");

        for (let i = 0; i < (data.users?.length ?? 0); i += 200) {
          await putUsers({ data: { rows: data.users.slice(i, i + 200) } });
          tick("Restoring accounts");
        }

        for (const name of names) {
          const rows = data.tables?.[name] ?? [];
          for (let i = 0; i < rows.length; i += RESTORE_CHUNK) {
            await putRows({ data: { table: name, rows: rows.slice(i, i + RESTORE_CHUNK) } });
            tick(`Restoring ${name}`);
          }
        }
      } finally {
        await setTriggers({ data: { enabled: true } });
      }
      toast.success("Restore finished — everyone signs in with their existing password");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Restore failed");
    }
    setProgress(null);
    setBusy(null);
  }

  /* ---------------------------- image backup ----------------------------- */
  async function downloadImages() {
    setBusy("img-backup");
    try {
      setProgress({ label: "Scanning image folders", done: 0, total: 1 });
      const list = images ?? (await scanImages());
      if (!list) throw new Error("Could not read image folders");
      const tasks: { bucket: string; path: string }[] = [];
      for (const b of list.buckets) for (const f of b.files) tasks.push({ bucket: b.id, path: f.path });
      const total = tasks.length || 1;
      let done = 0;
      setProgress({ label: "Downloading images", done, total });

      const entries: Record<string, Uint8Array> = {
        "_buckets.json": strToU8(JSON.stringify(list.buckets.map((b) => ({ id: b.id, public: b.public })))),
      };
      await pool(tasks, 5, async (t) => {
        const res = await readImage({ data: { bucket: t.bucket, path: t.path } });
        entries[`${t.bucket}/${t.path}`] = fromBase64(res.base64);
        setProgress({ label: "Downloading images", done: ++done, total });
      });

      setProgress({ label: "Packing archive", done: total, total });
      const zip = zipSync(entries, { level: 0 });
      saveFile(zip, `image-backup-${stamp()}.zip`);
      toast.success(`${tasks.length.toLocaleString()} image(s) packed`);
    } catch (e: any) {
      toast.error(e?.message ?? "Image backup failed");
    }
    setProgress(null);
    setBusy(null);
  }

  /* ---------------------------- image restore ---------------------------- */
  async function restoreImages(file: File) {
    setBusy("img-restore");
    try {
      const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const bucketsRaw = zip["_buckets.json"];
      const names = Object.keys(zip).filter((k) => k !== "_buckets.json" && zip[k]!.length >= 0 && !k.endsWith("/"));
      const bucketList: { id: string; public: boolean }[] = bucketsRaw
        ? JSON.parse(strFromU8(bucketsRaw))
        : Array.from(new Set(names.map((n) => n.split("/")[0]!))).map((id) => ({ id, public: false }));

      await ensureBuckets({ data: { buckets: bucketList } });

      const total = names.length || 1;
      let done = 0;
      setProgress({ label: "Uploading images", done, total });
      await pool(names, 5, async (key) => {
        const slash = key.indexOf("/");
        const bucket = key.slice(0, slash);
        const path = key.slice(slash + 1);
        if (!bucket || !path) return;
        await writeImage({ data: { bucket, path, base64: toBase64(zip[key]!) } });
        setProgress({ label: "Uploading images", done: ++done, total });
      });
      toast.success(`${names.length.toLocaleString()} image(s) restored`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Image restore failed");
    }
    setProgress(null);
    setBusy(null);
  }

  const working = !!busy;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Backup & restore"
        description="Download everything — all tables, all accounts with their existing passwords, and all images — then restore it into this or a brand-new project. New tables and fields are picked up automatically, and missing image buckets are created during restore."
        actions={
          <button
            onClick={load}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> Refresh
          </button>
        }
      />

      {progress && (
        <div className="surface-card space-y-2 p-4">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {progress.label}
            </span>
            <span className="text-muted-foreground">
              {progress.done}/{progress.total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (progress.done / Math.max(1, progress.total)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Data */}
        <div className="surface-card space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-black">Data backup</div>
              <div className="text-xs text-muted-foreground">
                {loading
                  ? "Reading…"
                  : `${(manifest?.tables?.length ?? 0).toLocaleString()} tables · ${totalRows.toLocaleString()} rows · ${Number(
                      manifest?.users ?? 0,
                    ).toLocaleString()} accounts`}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Includes every setting saved in the app (couriers, payment gateways, notifications, domains) and every
            account with its stored password, so after a restore users log in exactly as before and notice nothing.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadDatabase}
              disabled={working || loading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy === "db-backup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download data backup
            </button>
            <button
              onClick={() => dbInput.current?.click()}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-bold hover:bg-muted disabled:opacity-60"
            >
              {busy === "db-restore" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Restore data
            </button>
            <input
              ref={dbInput}
              type="file"
              accept=".gz,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) setPending({ kind: "db", file: f });
              }}
            />
          </div>
        </div>

        {/* Images */}
        <div className="surface-card space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-black">Image backup</div>
              <div className="text-xs text-muted-foreground">
                {imgLoading
                  ? "Scanning image folders…"
                  : images
                    ? `${images.buckets.length.toLocaleString()} folders · ${imageFiles.toLocaleString()} files · ${bytesLabel(
                        imageBytes,
                      )}`
                    : "Not scanned yet"}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Separate option, so you can back up images on their own. On restore any missing image folder is created
            automatically — nothing to set up in a new project.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => scanImages()}
              disabled={working || imgLoading}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-bold hover:bg-muted disabled:opacity-60"
            >
              {imgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Scan images
            </button>
            <button
              onClick={downloadImages}
              disabled={working || imgLoading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy === "img-backup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download image backup
            </button>
            <button
              onClick={() => imgInput.current?.click()}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-bold hover:bg-muted disabled:opacity-60"
            >
              {busy === "img-restore" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Restore images
            </button>
            <input
              ref={imgInput}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) setPending({ kind: "img", file: f });
              }}
            />
          </div>
        </div>
      </div>

      {!loading && manifest && (
        <div className="surface-card overflow-hidden">
          <div className="border-b px-4 py-3 text-sm font-bold">What the data backup contains</div>
          <div className="max-h-80 divide-y overflow-auto">
            {manifest.tables.map((t) => (
              <div key={t.name} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="font-medium">{t.name}</span>
                <span className={Number(t.rows) > 0 ? "font-black" : "text-muted-foreground"}>
                  {Number(t.rows).toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="font-medium">user accounts (with passwords)</span>
              <span className="font-black">{Number(manifest.users).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const job = pending;
          setPending(null);
          if (!job) return;
          if (job.kind === "db") await restoreDatabase(job.file);
          else await restoreImages(job.file);
        }}
        isLoading={working}
        variant="danger"
        title={pending?.kind === "db" ? "Restore data from this file?" : "Restore images from this file?"}
        description={
          pending?.kind === "db"
            ? "All current data and accounts are replaced by the backup. Users keep their existing passwords. This cannot be undone."
            : "Images from the archive are written back. Files with the same name are overwritten, and missing folders are created."
        }
        detail={pending?.file.name}
        confirmText="Start restore"
      />
    </div>
  );
}
