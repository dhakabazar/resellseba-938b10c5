import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Phone, MessageCircle, Mail, Copy, Loader2, Headphones } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reseller/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Support & Contact — Reseller Panel" },
      {
        name: "description",
        content:
          "Reseller support: call, WhatsApp or email the admin team directly for orders, payouts and product help.",
      },
      { property: "og:title", content: "Support & Contact — Reseller Panel" },
      {
        property: "og:description",
        content: "Call, WhatsApp or email the admin team for any reseller support need.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Settings = {
  site_name: string | null;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

function digits(v: string) {
  return v.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function waNumber(phone: string) {
  let d = digits(phone);
  if (d.startsWith("0")) d = "88" + d;
  if (d.startsWith("1") && d.length === 10) d = "880" + d;
  return d;
}

function SupportPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("global_settings")
        .select("site_name, logo_url, contact_email, contact_phone")
        .eq("id", 1)
        .maybeSingle();
      setS((data ?? null) as Settings | null);
      setLoading(false);
    })();
  }, []);

  const copy = async (v: string, label: string) => {
    try {
      await navigator.clipboard.writeText(v);
      toast.success(`${label} কপি হয়েছে`);
    } catch {
      toast.error("কপি করা যায়নি");
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const phone = s?.contact_phone?.trim() || "";
  const email = s?.contact_email?.trim() || "";
  const brand = s?.site_name?.trim() || "Admin";
  const waText = encodeURIComponent("আসসালামু আলাইকুম, আমি একজন reseller. আমার সহায়তা প্রয়োজন।");

  const cards = [
    phone && {
      key: "call",
      icon: <Phone className="h-5 w-5" />,
      title: "ফোন কল",
      desc: "অফিস সময়ে সরাসরি কথা বলুন",
      value: phone,
      href: `tel:${digits(phone)}`,
      action: "কল করুন",
      tone: "from-primary/15 to-primary/5 text-primary",
    },
    phone && {
      key: "wa",
      icon: <MessageCircle className="h-5 w-5" />,
      title: "WhatsApp",
      desc: "অর্ডার, পেমেন্ট বা প্রোডাক্ট সংক্রান্ত মেসেজ",
      value: phone,
      href: `https://wa.me/${waNumber(phone)}?text=${waText}`,
      action: "মেসেজ পাঠান",
      tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    },
    email && {
      key: "mail",
      icon: <Mail className="h-5 w-5" />,
      title: "ইমেইল",
      desc: "বিস্তারিত সমস্যা বা ডকুমেন্ট পাঠাতে",
      value: email,
      href: `mailto:${email}?subject=${encodeURIComponent("Reseller support")}`,
      action: "মেইল করুন",
      tone: "from-sky-500/15 to-sky-500/5 text-sky-600",
    },
  ].filter(Boolean) as Array<{
    key: string;
    icon: React.ReactNode;
    title: string;
    desc: string;
    value: string;
    href: string;
    action: string;
    tone: string;
  }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support & Contact"
        description={`${brand} টিমের সাথে যেকোনো প্রয়োজনে সরাসরি যোগাযোগ করুন`}
      />

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Headphones className="mx-auto mb-3 h-6 w-6" />
          এখনো কোনো যোগাযোগের তথ্য যোগ করা হয়নি। অনুগ্রহ করে পরে চেষ্টা করুন।
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.key}
              className="group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md"
            >
              <div
                className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${c.tone}`}
              >
                {c.icon}
              </div>
              <h3 className="text-sm font-semibold">{c.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
              <p className="mt-3 break-all font-mono text-sm">{c.value}</p>
              <div className="mt-4 flex items-center gap-2">
                <a
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  {c.action}
                </a>
                <button
                  type="button"
                  onClick={() => copy(c.value, c.title)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border transition hover:bg-muted"
                  aria-label={`${c.title} কপি করুন`}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">দ্রুত সহায়তা পেতে</p>
        <p className="mt-1">
          মেসেজ করার সময় আপনার reseller কোড, অর্ডার নাম্বার বা পেমেন্ট TrxID উল্লেখ করুন — এতে সমস্যা
          দ্রুত সমাধান হবে।
        </p>
      </div>
    </div>
  );
}
