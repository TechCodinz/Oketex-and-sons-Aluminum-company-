import { useEffect, useState } from "react";
import { getActivityAsync, type ActivityEntry } from "@/lib/activity";
import { ROLE_INFO, isStaffRole } from "@/lib/staff";

// Admin → Activity (owner only). Who approved, assigned, priced, created
// or changed what — staff actions, owner actions and the Ops Agent's
// drafts (clearly labelled) in one audit trail.
export default function ActivityTab() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  useEffect(() => { void getActivityAsync().then(setEntries); }, []);
  const roleLabel = (role: string) => (isStaffRole(role) ? ROLE_INFO[role].label : role === "system" ? "System" : role);
  return (
    <section>
      <h2 className="font-display font-bold uppercase text-2xl mb-1">Activity log ({entries.length})</h2>
      <p className="font-tech text-[11px] text-muted-foreground mb-4 max-w-3xl">Staff creations, partner approvals, Snap &amp; Send assessments and assignments, settings saves, job awards and production milestones — newest first. Ops Agent entries are drafts a human approved; the agent never acts alone.</p>
      {!entries.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">Nothing logged yet — entries appear as staff work.</p>
      : <div className="border hairline">{entries.map((e, i) => (
        <div key={e.id} className={`px-5 py-3.5 flex flex-wrap gap-x-4 gap-y-1 items-baseline ${i > 0 ? "border-t hairline" : ""}`}>
          <span className="font-tech text-[11px] text-muted-foreground shrink-0">{new Date(e.ts).toLocaleString("en-NG")}</span>
          <span className="font-tech text-sm font-semibold">{e.actorName}{e.actorRole && <span className="text-muted-foreground font-normal"> · {roleLabel(e.actorRole)}</span>}</span>
          <span className="font-tech text-[11px] border hairline px-2 py-0.5 uppercase tracking-widest">{e.action.replace(/_/g, " ")}</span>
          {e.refCode && <span className="font-tech text-xs text-primary">{e.refCode}</span>}
          {e.detail && <span className="text-sm text-muted-foreground">{e.detail}</span>}
        </div>))}
      </div>}
    </section>
  );
}
