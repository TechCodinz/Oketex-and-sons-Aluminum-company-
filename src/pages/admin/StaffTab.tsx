import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { STAFF_ROLES, ROLE_INFO, getStaffAsync, createStaffAsync, updateStaffAsync, type StaffMember, type StaffRole } from "@/lib/staff";
import { logActivity } from "@/lib/activity";

// Admin → Staff (owner only). Create staff logins, change roles,
// activate/deactivate, reset passwords. In live mode accounts are real
// (users table, role-gated APIs); in demo mode the same shapes run on the
// local `oketex-staff` store and passwords are demo-grade — labelled.
export default function StaffTab({ live }: { live: boolean }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "sales" as StaffRole, password: "" });
  const load = async () => setStaff(await getStaffAsync());
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (form.name.trim().length < 2) return toast.error("Enter the staff member's full name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return toast.error("Enter a valid email");
    if (form.password.length < 8) return toast.error("Temporary password must be at least 8 characters");
    const r = await createStaffAsync({ name: form.name, email: form.email, phone: form.phone, role: form.role, password: form.password });
    if (r.error || !r.member) return toast.error(r.error || "Could not create the account");
    logActivity("staff_created", r.member.email, `${r.member.name} added as ${ROLE_INFO[r.member.role].label}`);
    setForm({ name: "", email: "", phone: "", role: "sales", password: "" });
    await load();
    toast.success(`${r.member.name} can now sign in at /admin as ${ROLE_INFO[r.member.role].label}`);
  };
  const patch = async (m: StaffMember, p: { role?: StaffRole; active?: boolean; password?: string }, label: string) => {
    const r = await updateStaffAsync(m.id, p);
    if (r.error) return toast.error(r.error);
    logActivity("staff_updated", m.email, `${m.name}: ${label}`);
    await load();
    toast.success(`${m.name} — ${label}`);
  };
  const resetPw = async (m: StaffMember) => {
    const pw = window.prompt(`New temporary password for ${m.name} (8+ characters). They sign in with it at /admin.`);
    if (!pw) return;
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    await patch(m, { password: pw }, "password reset");
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Staff ({staff.length})</h2>
        <p className="font-tech text-[11px] text-muted-foreground max-w-3xl">
          Every employee signs in at /admin with their own email + password — the role on their account decides which tabs they see, and the API enforces the same roles server-side (a hidden tab is not the security). Deactivated staff are refused at login immediately.
          {!live && <span className="text-yellow-500"> Demo mode — staff accounts live in this browser with demo-grade passwords; real accounts activate with production mode.</span>}
        </p>
      </section>

      <section className="border hairline bg-card p-5">
        <p className="label-tech mb-4">Add a staff member</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><label className="label-tech">Full name</label><input className="field-tech" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Adaeze Nwosu" /></div>
          <div><label className="label-tech">Email (their login)</label><input type="email" className="field-tech" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@oketexandsons.ng" /></div>
          <div><label className="label-tech">Phone</label><input className="field-tech" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0803…" /></div>
          <div><label className="label-tech">Role</label>
            <select className="field-tech bg-background" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as StaffRole })}>
              {STAFF_ROLES.map(r => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
            </select>
            <p className="font-tech text-[10px] text-muted-foreground mt-1">{ROLE_INFO[form.role].duties}</p>
          </div>
          <div><label className="label-tech">Temporary password (8+)</label><input className="field-tech" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Share it with them in person" /></div>
          <div className="flex items-end"><Button className="rounded-none font-display uppercase h-11 w-full" onClick={() => void create()}>Create staff login</Button></div>
        </div>
      </section>

      <section>
        {!staff.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No staff accounts yet — add the first one above. (The owner account itself signs in with the admin credentials and is not listed here.)</p>
        : <div className="border hairline overflow-x-auto"><table className="w-full text-sm min-w-[820px]">
          <thead><tr className="border-b hairline text-left font-tech text-[10px] uppercase tracking-widest text-muted-foreground"><th className="px-4 py-3">Staff member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
          <tbody>{staff.map(m => (
            <tr key={String(m.id)} className="border-b hairline last:border-0">
              <td className="px-4 py-3"><span className="font-semibold">{m.name}</span><br /><span className="font-tech text-[11px] text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ""}</span></td>
              <td className="px-4 py-3">
                <select value={m.role} aria-label={`Role for ${m.name}`} onChange={e => void patch(m, { role: e.target.value as StaffRole }, `role → ${ROLE_INFO[e.target.value as StaffRole].label}`)} className="bg-background border hairline font-tech text-xs px-2 py-2">
                  {STAFF_ROLES.map(r => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
                </select>
              </td>
              <td className="px-4 py-3"><span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-0.5 ${m.active ? "border-emerald-500/60 text-emerald-400" : "border-red-500/60 text-red-400"}`}>{m.active ? "Active" : "Deactivated"}</span></td>
              <td className="px-4 py-3"><div className="flex gap-2 flex-wrap">
                <button onClick={() => void patch(m, { active: !m.active }, m.active ? "deactivated — login refused" : "reactivated")} className="font-tech text-[11px] border hairline px-2.5 py-1.5 hover:border-primary hover:text-primary cursor-pointer">{m.active ? "Deactivate" : "Reactivate"}</button>
                <button onClick={() => void resetPw(m)} className="font-tech text-[11px] border hairline px-2.5 py-1.5 hover:border-primary hover:text-primary cursor-pointer">Reset password</button>
              </div></td>
            </tr>))}
          </tbody>
        </table></div>}
      </section>
    </div>
  );
}
