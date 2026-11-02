"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ASSUMPTION_META, DEFAULT_ASSUMPTIONS, type Assumptions } from "@/lib/underwriting/assumptions";
import { saveAssumptionsAction } from "@/app/actions";
import { Input, Select } from "./ui/field";
import { Button } from "./ui/button";
import { notify } from "./ui/toast";
import { Badge } from "./ui/badge";

export function AssumptionsForm({ values, canEdit }: { values: Assumptions; canEdit: boolean }) {
  const [v, setV] = useState<Record<string, string | boolean>>(() => Object.fromEntries(Object.entries(values).map(([k, x]) => [k, typeof x === "boolean" ? x : String(x)])));
  const [pending, start] = useTransition();
  const router = useRouter();
  const groups = [...new Set(Object.values(ASSUMPTION_META).map((m) => m.group))];
  const dirty = Object.entries(values).some(([k, x]) => String(x) !== String(v[k]));
  const save = () =>
    start(async () => {
      const parsed = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "boolean" || k === "acquisitionFinancing" ? x : Number(x)]));
      const r = await saveAssumptionsAction(parsed);
      notify(r);
      if (r.ok) router.refresh();
    });
  return (
    <div>
      <div className="grid gap-px bg-line md:grid-cols-2">
        {groups.map((g) => (
          <div key={g} className="bg-surface px-3.5 py-3">
            <div className="eyebrow mb-2">{g}</div>
            <div className="space-y-1.5">
              {(Object.keys(ASSUMPTION_META) as (keyof Assumptions)[]).filter((k) => ASSUMPTION_META[k].group === g).map((k) => {
                const m = ASSUMPTION_META[k];
                const changed = String(DEFAULT_ASSUMPTIONS[k]) !== String(v[k]);
                return (
                  <div key={k} className="grid grid-cols-[1fr_128px] items-center gap-3">
                    <label htmlFor={`as-${k}`} className="text-sm text-fg-2" title={m.help}>
                      {m.label}{changed && <span className="ml-1.5 text-2xs text-fg-3" title={`Default ${String(DEFAULT_ASSUMPTIONS[k])}`}>edited</span>}
                    </label>
                    {m.unit === "bool" ? (
                      <Select id={`as-${k}`} disabled={!canEdit} value={String(v[k])} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value === "true" }))} className="h-7">
                        <option value="true">Yes</option><option value="false">No</option>
                      </Select>
                    ) : m.unit === "enum" ? (
                      <Select id={`as-${k}`} disabled={!canEdit} value={String(v[k])} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} className="h-7">
                        <option value="private">Private money</option><option value="cash">All cash</option>
                      </Select>
                    ) : (
                      <Input id={`as-${k}`} disabled={!canEdit} inputMode="decimal" value={String(v[k])} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))}
                        prefix={m.unit === "$" ? "$" : undefined} suffix={m.unit === "%" ? "%" : m.unit === "mo" ? "mo" : m.unit === "yr" ? "yr" : m.unit === "x" ? "x" : undefined} className="[&_input]:h-7 [&_input]:text-right" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line px-3.5 py-2.5">
        <span className="text-xs text-fg-3">{canEdit ? "Saving creates a new version. Existing analyses keep the assumptions they were run with." : "Only the owner can change underwriting assumptions."}</span>
        {canEdit && <div className="flex items-center gap-2">{dirty && <Badge tone="warning" dot>Unsaved</Badge>}<Button variant="primary" size="sm" disabled={!dirty} loading={pending} onClick={save}>Save assumptions</Button></div>}
      </div>
    </div>
  );
}
