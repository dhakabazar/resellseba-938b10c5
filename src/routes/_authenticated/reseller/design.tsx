import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/ui-kit";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";

export const Route = createFileRoute("/_authenticated/reseller/design")({
  component: DesignPage,
});

function DesignPage() {
  const { user } = useAuth();
  const [rid, setRid] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [tagline, setTagline] = useState("");
  const [primary, setPrimary] = useState("#3b82f6");
  const [accent, setAccent] = useState("#f59e0b");
  const [whatsapp, setWhatsapp] = useState("");
  const [fb, setFb] = useState("");
  const [insta, setInsta] = useState("");
  const [logo, setLogo] = useState<UploadedImage[]>([]);
  const [og, setOg] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: r } = await supabase
        .from("resellers")
        .select("id,business_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!r) return setLoading(false);
      setRid(r.id);
      const { data: s } = await supabase
        .from("reseller_settings")
        .select("*")
        .eq("reseller_id", r.id)
        .maybeSingle();
      if (s) {
        setStoreName(s.store_name);
        setTagline(s.tagline ?? "");
        setPrimary(s.primary_color ?? "#3b82f6");
        setAccent(s.accent_color ?? "#f59e0b");
        setWhatsapp(s.whatsapp ?? "");
        setFb(s.facebook_url ?? "");
        setInsta(s.instagram_url ?? "");
        if (s.logo_url) setLogo([{ path: "", url: s.logo_url, bytes: 0 }]);
        if (s.og_image_url) setOg([{ path: "", url: s.og_image_url, bytes: 0 }]);
      } else {
        setStoreName(r.business_name);
      }
      setLoading(false);
    })();
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!rid) return;
    setBusy(true);
    const { error } = await supabase.from("reseller_settings").upsert(
      {
        reseller_id: rid,
        store_name: storeName,
        tagline: tagline || null,
        primary_color: primary,
        accent_color: accent,
        whatsapp: whatsapp || null,
        facebook_url: fb || null,
        instagram_url: insta || null,
        logo_url: logo[0]?.url ?? null,
        og_image_url: og[0]?.url ?? null,
      },
      { onConflict: "reseller_id" },
    );
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Store design saved");
  }

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Store design"
        description="Your branding — logo, colors, tagline, social links."
      />
      <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card space-y-3 p-6">
          <h3 className="text-sm font-semibold">Identity</h3>
          <Field label="Store name">
            <input required value={storeName} onChange={(e) => setStoreName(e.target.value)} className={inp} />
          </Field>
          <Field label="Tagline">
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} className={inp} />
          </Field>
          <Field label="Logo">
            <ImageUploader bucket="branding" folder={`reseller-${rid}`} value={logo} onChange={setLogo} />
          </Field>
          <Field label="OG share image">
            <ImageUploader bucket="branding" folder={`reseller-${rid}-og`} value={og} onChange={setOg} />
          </Field>
        </div>
        <div className="surface-card space-y-3 p-6">
          <h3 className="text-sm font-semibold">Colors & social</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary">
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-full rounded-md border" />
            </Field>
            <Field label="Accent">
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-full rounded-md border" />
            </Field>
          </div>
          <Field label="WhatsApp">
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inp} placeholder="8801XXXXXXXXX" />
          </Field>
          <Field label="Facebook page URL">
            <input value={fb} onChange={(e) => setFb(e.target.value)} className={inp} />
          </Field>
          <Field label="Instagram URL">
            <input value={insta} onChange={(e) => setInsta(e.target.value)} className={inp} />
          </Field>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save design
          </button>
        </div>
      </form>
    </div>
  );
}

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="mb-1 block text-xs font-medium">{label}</label>{children}</div>);
}
