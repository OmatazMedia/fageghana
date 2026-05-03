import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/certificates")({
  head: () => ({ meta: [{ title: "Certificates — Admin" }] }),
  component: CertsPage,
});

function CertsPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [issuing, setIssuing] = useState(false);

  async function load() {
    const [t, c, m] = await Promise.all([
      supabase.from("certificate_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("certificates").select("*").order("issued_at", { ascending: false }).limit(50),
      supabase.from("member_profiles").select("*").not("member_id", "is", null),
    ]);
    setTemplates(t.data ?? []); setCerts(c.data ?? []); setMembers(m.data ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function uploadAsset(file: File, folder: string) {
    const path = `${folder}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("certificate-assets").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("certificate-assets").getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      let imageUrl = editing.image_url;
      let signatureUrl = editing.signature_url;
      const imgFile = (fd.get("image") as File);
      const sigFile = (fd.get("signature") as File);
      if (imgFile && imgFile.size > 0) imageUrl = await uploadAsset(imgFile, "templates");
      if (sigFile && sigFile.size > 0) signatureUrl = await uploadAsset(sigFile, "signatures");

      const positions = JSON.parse(String(fd.get("field_positions") || "{}"));
      const payload = {
        name: String(fd.get("name")),
        tier: String(fd.get("tier")) as any,
        image_url: imageUrl,
        signature_url: signatureUrl,
        authorized_name: String(fd.get("authorized_name") ?? "FAGE President"),
        field_positions: positions,
        is_active: fd.get("is_active") === "on",
      };
      const { error } = editing.id
        ? await supabase.from("certificate_templates").update(payload).eq("id", editing.id)
        : await supabase.from("certificate_templates").insert(payload);
      if (error) throw error;
      toast.success("Template saved"); setEditing(null); await load();
    } catch (err: any) { toast.error(err.message); }
  }

  async function issueCert(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const userId = String(fd.get("user_id"));
    const templateId = String(fd.get("template_id"));
    const expires = String(fd.get("expires_at"));
    const member = members.find(m => m.user_id === userId);
    if (!member) return toast.error("Pick a member");
    const code = `FAGE-${member.member_id}-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("certificates").insert({
      user_id: userId, template_id: templateId, member_id: member.member_id,
      full_name: member.contact_name || member.company_name, tier: member.tier,
      expires_at: new Date(expires).toISOString(), verification_code: code,
    });
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({ user_id: userId, title: "Your certificate is ready", body: "Visit your dashboard to download your FAGE membership certificate." });
    toast.success("Issued"); setIssuing(false); await load();
  }

  return (
    <AdminShell title="Certificates" description="Manage templates and issue certificates to confirmed members.">
      <div className="mb-6 flex gap-2">
        <button onClick={() => setEditing({ field_positions: { name: { x: 600, y: 500, fontSize: 48 }, member_id: { x: 600, y: 600, fontSize: 24 }, expires: { x: 600, y: 800, fontSize: 20 }, qr: { x: 1100, y: 850, size: 160 } } })} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">New template</button>
        <button onClick={() => setIssuing(true)} className="rounded-full border border-border px-5 py-2 text-sm font-semibold">Issue certificate</button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-bold">Templates</h2>
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div>
                  <div className="font-medium">{t.name} <span className="ml-2 text-xs capitalize text-muted-foreground">{t.tier}</span></div>
                  <div className="text-xs text-muted-foreground">{t.is_active ? "Active" : "Disabled"}</div>
                </div>
                <button onClick={() => setEditing(t)} className="text-sm text-primary">Edit</button>
              </div>
            ))}
            {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
          </div>
        </section>
        <section>
          <h2 className="mb-3 font-bold">Issued certificates</h2>
          <div className="space-y-2">
            {certs.map(c => (
              <div key={c.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                <div className="font-medium">{c.full_name} — {c.member_id}</div>
                <div className="text-xs text-muted-foreground">Expires {new Date(c.expires_at).toLocaleDateString()} · Code: {c.verification_code}</div>
              </div>
            ))}
            {certs.length === 0 && <p className="text-sm text-muted-foreground">No certs issued.</p>}
          </div>
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <form onSubmit={saveTemplate} className="w-full max-w-2xl space-y-3 rounded-2xl bg-card p-6 my-8">
            <h2 className="text-lg font-bold">{editing.id ? "Edit" : "New"} template</h2>
            <FormField label="Name"><input name="name" required className={inputCls} defaultValue={editing.name} /></FormField>
            <FormField label="Tier">
              <select name="tier" className={inputCls} defaultValue={editing.tier ?? "associate"}>
                <option value="associate">Associate</option>
                <option value="standard">Standard</option>
                <option value="corporate">Corporate</option>
              </select>
            </FormField>
            <FormField label="Certificate background image"><input name="image" type="file" accept="image/*" className={inputCls} /></FormField>
            {editing.image_url && <img src={editing.image_url} alt="" className="max-h-40 rounded" />}
            <FormField label="Signature image (optional)"><input name="signature" type="file" accept="image/*" className={inputCls} /></FormField>
            <FormField label="Authorized name"><input name="authorized_name" className={inputCls} defaultValue={editing.authorized_name ?? "FAGE President"} /></FormField>
            <FormField label="Field positions (JSON)" hint="Pixel coordinates on the background. Keys: name, member_id, tier, issued, expires, signature{x,y,w,h}, qr{x,y,size}">
              <textarea name="field_positions" rows={8} className={`${inputCls} font-mono text-xs`} defaultValue={JSON.stringify(editing.field_positions ?? {}, null, 2)} />
            </FormField>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={editing.is_active ?? true} /> Active</label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full px-4 py-2 text-sm">Cancel</button>
              <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save</button>
            </div>
          </form>
        </div>
      )}

      {issuing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={issueCert} className="w-full max-w-md space-y-3 rounded-2xl bg-card p-6">
            <h2 className="text-lg font-bold">Issue certificate</h2>
            <FormField label="Member">
              <select name="user_id" required className={inputCls}>
                <option value="">Select member…</option>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{m.member_id} — {m.contact_name || m.company_name}</option>)}
              </select>
            </FormField>
            <FormField label="Template">
              <select name="template_id" required className={inputCls}>
                <option value="">Select template…</option>
                {templates.filter(t => t.is_active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FormField>
            <FormField label="Expires at"><input name="expires_at" type="date" required className={inputCls} /></FormField>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIssuing(false)} className="rounded-full px-4 py-2 text-sm">Cancel</button>
              <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Issue</button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}
