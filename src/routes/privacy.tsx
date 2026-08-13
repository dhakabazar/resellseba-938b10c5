import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader, Brand } from "@/components/public-header";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Reseller Platform" },
      {
        name: "description",
        content: "How we collect, use, and protect reseller and customer data on our platform.",
      },
      { property: "og:title", content: "Privacy Policy — Reseller Platform" },
      { property: "og:description", content: "How we collect, use, and protect reseller and customer data on our platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const DEFAULT_POLICY = `<p>Your privacy is important to us. This policy explains how we collect, use, store, and protect your information when you use our reseller platform.</p>

<h2>Information We Collect</h2>
<ul>
<li>Account details: name, email, phone number, business name, and store information.</li>
<li>Order details: customer names, addresses, phone numbers, and product information.</li>
<li>Payment and transaction records needed to process commissions and payouts.</li>
<li>Usage data: login sessions, page visits, and actions taken in the admin or reseller panel.</li>
</ul>

<h2>How We Use Your Information</h2>
<ul>
<li>To create and manage your reseller account and store.</li>
<li>To process orders, deliveries, and courier bookings.</li>
<li>To calculate commissions, profits, and payout requests.</li>
<li>To send important notifications about orders, payments, and platform updates.</li>
<li>To improve platform security and prevent fraud.</li>
</ul>

<h2>How We Protect Your Data</h2>
<ul>
<li>We use secure, encrypted connections (SSL) for all data transfers.</li>
<li>Access to sensitive data is controlled by role-based permissions and authentication.</li>
<li>We do not sell or share your personal data with third parties for marketing.</li>
<li>Courier partners only receive the minimum information required to deliver parcels.</li>
</ul>

<h2>Your Responsibilities as a Reseller</h2>
<ul>
<li>Only collect customer information needed to fulfill orders.</li>
<li>Do not share customer data with unauthorized people or services.</li>
<li>Keep your login credentials safe and do not allow others to use your account.</li>
</ul>

<h2>Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. Any changes will be posted on this page, and we encourage you to review it regularly.</p>

<h2>Contact Us</h2>
<p>If you have any questions about this Privacy Policy, please contact the platform admin through the support channel provided in your dashboard.</p>

<p class="font-semibold">Last updated: Today</p>`;

function PrivacyPage() {
  const [policy, setPolicy] = useState<string>(DEFAULT_POLICY);
  const [siteName, setSiteName] = useState("Reseller");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("global_settings")
        .select("site_name, logo_url, privacy_policy")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setSiteName(data.site_name ?? "Reseller");
        setLogoUrl((data as any).logo_url ?? null);
        if ((data as any).privacy_policy) setPolicy((data as any).privacy_policy);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader siteName={siteName} logoUrl={logoUrl} />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> হোমে ফিরুন
        </Link>

        <article className="mt-8">
          <div className="mb-8">
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              Legal
            </span>
            <h1 className="mt-3 text-2xl font-extrabold sm:text-4xl">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              How {siteName} collects, uses, and protects your data.
            </p>
          </div>

          <div
            className="prose prose-sm max-w-none text-foreground/90 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: policy || DEFAULT_POLICY }}
          />
        </article>
      </main>

      <footer className="border-t border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Brand siteName={siteName} logoUrl={logoUrl} size="sm" />
            <span>© {new Date().getFullYear()} {siteName}. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-primary">Home</Link>
            <Link to="/catalog" search={{}} className="hover:text-primary">প্রোডাক্টস</Link>
            <Link to="/privacy" className="font-semibold text-primary">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
