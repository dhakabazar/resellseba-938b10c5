import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearAppDataCache } from "@/lib/app-data";
import { PageHeader } from "@/components/ui-kit";
import { Loader2, Save, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/privacy")({
  component: PrivacyEditor,
});

const STARTER = `<p>Your privacy is important to us. This policy explains how we collect, use, store, and protect your information when you use our reseller platform.</p>

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

function PrivacyEditor() {
  const [html, setHtml] = useState(STARTER);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("global_settings")
        .select("privacy_policy")
        .eq("id", 1)
        .maybeSingle();
      setHtml((data as any)?.privacy_policy || STARTER);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("global_settings")
      .update({ privacy_policy: html })
      .eq("id", 1);
    clearAppDataCache("settings");
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Privacy policy saved");
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Privacy policy"
        description="Edit the public /privacy page content. Basic HTML (h1, h2, ul, p, strong) is supported."
      />

      <div className="surface-card p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">HTML content</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <Eye className="h-3.5 w-3.5" /> {preview ? "Edit" : "Preview"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
          </div>
        </div>

        {preview ? (
          <div className="min-h-[24rem] rounded-xl border bg-background p-5">
            <div
              className="prose prose-sm max-w-none text-foreground/90 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1.5 [&_p]:mt-3"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        ) : (
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={24}
            className="w-full rounded-xl border bg-background p-4 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Paste or write HTML privacy policy content here..."
          />
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Public page: <code className="rounded bg-muted px-1 py-0.5">/privacy</code>
      </div>
    </div>
  );
}
