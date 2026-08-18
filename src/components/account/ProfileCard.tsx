import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserRound, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/uploadImage";

type ProfileMeta = {
  full_name: string;
  phone: string;
  bio: string;
  job_title: string;
  avatar_url: string;
};

const EMPTY: ProfileMeta = { full_name: "", phone: "", bio: "", job_title: "", avatar_url: "" };

/**
 * Profile editor stored on the auth user's metadata so it works for members,
 * staff and admins alike (no per-role table required).
 */
export function ProfileCard() {
  const [form, setForm] = useState<ProfileMeta>(EMPTY);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const m = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      setEmail(data.user?.email ?? "");
      setForm({
        full_name: String(m['full_name'] ?? m['name'] ?? ""),
        phone: String(m['phone'] ?? ""),
        bio: String(m['bio'] ?? ""),
        job_title: String(m['job_title'] ?? ""),
        avatar_url: String(m['avatar_url'] ?? ""),
      });
      setLoading(false);
    });
  }, []);

  function set<K extends keyof ProfileMeta>(k: K, v: ProfileMeta[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 4 * 1024 * 1024) return toast.error("Image must be smaller than 4 MB");
    setUploading(true);
    try {
      const url = await uploadImage(file, "avatars");
      set("avatar_url", url);
      toast.success("Photo uploaded — remember to save.");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Full name is required");
    if (form.phone && !/^\+?[0-9 ()-]{7,20}$/.test(form.phone.trim()))
      return toast.error("Enter a valid phone number");
    if (form.bio.length > 1000) return toast.error("Bio must be under 1000 characters");

    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        job_title: form.job_title.trim(),
        avatar_url: form.avatar_url,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UserRound className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold">My profile</h3>
          <p className="text-xs text-muted-foreground">
            Your photo, name and contact details. Shown in the dashboard header.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt="Profile photo"
                  className="h-20 w-20 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-xl font-bold text-muted-foreground">
                  {(form.full_name || email || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
                aria-label="Change profile photo"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickAvatar}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{email}</p>
              <p className="mt-1">JPG or PNG, up to 4 MB. Square images look best.</p>
              {form.avatar_url && (
                <button
                  type="button"
                  onClick={() => set("avatar_url", "")}
                  className="mt-1 text-destructive hover:underline"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" value={form.full_name} onChange={(v) => set("full_name", v)} />
            <Field
              label="Phone number"
              value={form.phone}
              onChange={(v) => set("phone", v)}
              placeholder="+233 20 123 4567"
            />
            <Field
              label="Job title / role"
              value={form.job_title}
              onChange={(v) => set("job_title", v)}
              placeholder="Export Manager"
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Short bio</span>
            <textarea
              rows={4}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              maxLength={1000}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Tell us a little about you and your business."
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              {form.bio.length}/1000
            </span>
          </label>

          <button
            disabled={busy || uploading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save profile"}
          </button>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
