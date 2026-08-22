import { useState } from "react";
import { Loader2, Save, KeyRound, Mail, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { ResellerAvatar } from "@/components/reseller-avatar";

const cls = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export type ResellerAccountValues = {
  id: string;
  business_name: string;
  contact_phone: string | null;
  address: string | null;
  nid_number?: string | null;
  avatar_url?: string | null;
};

/**
 * Reseller self-service account editor.
 * Info + avatar go straight to the resellers row; email/password go to auth
 * with no extra verification step (auto-confirm is enabled project-wide).
 */
export function ResellerAccountForm({
  reseller,
  email,
  onSaved,
}: {
  reseller: ResellerAccountValues;
  email: string | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(reseller.business_name);
  const [phone, setPhone] = useState(reseller.contact_phone ?? "");
  const [address, setAddress] = useState(reseller.address ?? "");
  const [nid, setNid] = useState(reseller.nid_number ?? "");
  const [avatar, setAvatar] = useState<string | null>(reseller.avatar_url ?? null);
  const [savingInfo, setSavingInfo] = useState(false);

  const [newEmail, setNewEmail] = useState(email ?? "");
  const [savingEmail, setSavingEmail] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  async function persistAvatar(url: string | null) {
    setAvatar(url);
    const { error } = await supabase.from("resellers").update({ avatar_url: url }).eq("id", reseller.id);
    if (error) return toast.error(error.message);
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await supabase.from("profiles").update({ avatar_url: url }).eq("id", auth.user.id);
    toast.success(url ? "Profile picture updated" : "Profile picture removed");
    onSaved();
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    setSavingInfo(true);
    const { error } = await supabase
      .from("resellers")
      .update({
        business_name: name.trim(),
        contact_phone: phone.trim() || null,
        address: address.trim() || null,
        nid_number: nid.trim() || null,
      })
      .eq("id", reseller.id);
    if (!error) {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user)
        await supabase
          .from("profiles")
          .update({ full_name: name.trim(), phone: phone.trim() || null })
          .eq("id", auth.user.id);
    }
    setSavingInfo(false);
    if (error) return toast.error(error.message);
    toast.success("Information updated");
    onSaved();
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    const next = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return toast.error("Enter a valid email address");
    if (next === (email ?? "").toLowerCase()) return toast.message("This is already your email");
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: next });
    setSavingEmail(false);
    if (error) return toast.error(error.message);
    toast.success("Email updated");
    onSaved();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPass(false);
    if (error) return toast.error(error.message);
    setPassword("");
    setConfirm("");
    toast.success("Password updated");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Info + avatar */}
      <form onSubmit={saveInfo} className="surface-card space-y-3 p-4">
        <h3 className="text-sm font-semibold">Edit my information</h3>

        <div className="flex items-center gap-4">
          <ResellerAvatar url={avatar} name={name} size={64} />
          <div className="min-w-0 flex-1">
            <ImageUploader
              bucket="branding"
              folder={`${reseller.id}/avatar`}
              square
              label={avatar ? "Change picture" : "Upload picture"}
              hint="Square image, auto-compressed"
              value={[]}
              onChange={(v: UploadedImage[]) => void persistAvatar(v[0]?.url ?? null)}
            />
            {avatar && (
              <button
                type="button"
                onClick={() => void persistAvatar(null)}
                className="mt-1 text-xs text-destructive underline"
              >
                Remove picture
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">Name / business name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={cls} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">Mobile</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={cls} placeholder="01XXXXXXXXX" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">NID (optional)</label>
            <input value={nid} onChange={(e) => setNid(e.target.value)} className={cls} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Address</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={cls} />
        </div>
        <button
          type="submit"
          disabled={savingInfo}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save information
        </button>
      </form>

      {/* Login credentials */}
      <div className="space-y-4">
        <form onSubmit={saveEmail} className="surface-card space-y-3 p-4">
          <h3 className="text-sm font-semibold">Login email</h3>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={cls}
            placeholder="you@example.com"
          />
          <p className="text-xs text-muted-foreground">Changes instantly — no verification link needed.</p>
          <button
            type="submit"
            disabled={savingEmail}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Update email
          </button>
        </form>

        <form onSubmit={savePassword} className="surface-card space-y-3 p-4">
          <h3 className="text-sm font-semibold">Change password</h3>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cls + " pr-10"}
              placeholder="New password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <input
            type={showPass ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={cls}
            placeholder="Confirm new password"
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={savingPass}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {savingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Update
            password
          </button>
        </form>
      </div>
    </div>
  );
}
