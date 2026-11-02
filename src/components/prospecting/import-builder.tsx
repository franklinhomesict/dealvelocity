"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, ListChecks, Search as SearchIcon } from "lucide-react";
import { SIGNALS, TYPES } from "@/lib/dealmachine/presets";
import { estimateSearchAction, listDmListsAction, createListJobAction } from "@/app/(app)/prospecting/actions";
import { Panel, PanelHeader } from "../ui/misc";
import { Button } from "../ui/button";
import { Input, Label, Select } from "../ui/field";
import { notify } from "../ui/toast";
import { cn } from "../ui/cn";

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("h-7 rounded border px-2.5 text-sm transition-colors", on ? "border-fg/40 bg-surface-3 font-medium text-fg" : "border-line text-fg-2 hover:border-line-strong hover:text-fg")}
    >
      {children}
    </button>
  );
}

export function ImportBuilder({ connected, readOnly }: { connected: boolean; readOnly: boolean }) {
  const [tab, setTab] = useState<"list" | "search">("list");
  return (
    <Panel>
      <PanelHeader
        title="New import"
        actions={
          <div className="flex h-7 items-center rounded border border-line bg-surface-2 p-0.5" role="tablist" aria-label="Import type">
            {([["list", "Saved list · free"], ["search", "Search · paid"]] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("h-full rounded-sm px-2.5 text-xs font-medium", tab === k ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
                {l}
              </button>
            ))}
          </div>
        }
      />
      {tab === "list" ? <ListForm connected={connected} readOnly={readOnly} /> : <SearchForm connected={connected} readOnly={readOnly} />}
    </Panel>
  );
}

function SearchForm({ connected, readOnly }: { connected: boolean; readOnly: boolean }) {
  const [name, setName] = useState("");
  const [zipDraft, setZipDraft] = useState("");
  const [zips, setZips] = useState<string[]>([]);
  const [signals, setSignals] = useState<string[]>(["vacant"]);
  const [types, setTypes] = useState<string[]>(["sfr"]);
  const [max, setMax] = useState("50");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = (xs: string[], set: (v: string[]) => void, id: string) => set(xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]);
  const addZip = () => {
    const found = zipDraft.match(/\d{5}/g) ?? [];
    setZips((z) => [...new Set([...z, ...found])].slice(0, 25));
    setZipDraft("");
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await estimateSearchAction({ name: name || `${signals.join(" + ") || "All"} · ${zips.join(", ")}`.slice(0, 80), zips, signals, types, maxRecords: Number(max) || 0 });
      if (!r.ok) return setError(r.error);
      notify(r);
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="space-y-4 px-3.5 py-3.5">
      <div>
        <Label htmlFor="ib-zip" hint="up to 25">ZIP codes</Label>
        <div className="flex flex-wrap items-center gap-1.5 rounded border border-line bg-surface-2 px-1.5 py-1 focus-within:border-focus">
          {zips.map((z) => (
            <span key={z} className="num inline-flex h-6 items-center gap-1 rounded-sm bg-surface-3 pl-2 pr-1 text-sm">
              {z}
              <button type="button" aria-label={`Remove ${z}`} onClick={() => setZips((x) => x.filter((y) => y !== z))} className="rounded-sm p-0.5 text-fg-3 hover:text-fg"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <input
            id="ib-zip"
            value={zipDraft}
            onChange={(e) => setZipDraft(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === "," || e.key === " ") && zipDraft && (e.preventDefault(), addZip())}
            onBlur={() => zipDraft && addZip()}
            placeholder={zips.length ? "" : "67213, 67211, 67214…"}
            inputMode="numeric"
            className="h-6 min-w-[120px] flex-1 bg-transparent px-1 text-sm placeholder:text-fg-3 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <Label>Seller signals <span className="font-normal text-fg-3">· all selected must match</span></Label>
        <div className="flex flex-wrap gap-1.5">{SIGNALS.map((s) => <Toggle key={s.id} on={signals.includes(s.id)} onClick={() => toggle(signals, setSignals, s.id)}>{s.label}</Toggle>)}</div>
      </div>
      <div>
        <Label>Property type</Label>
        <div className="flex flex-wrap gap-1.5">{TYPES.map((t) => <Toggle key={t.id} on={types.includes(t.id)} onClick={() => toggle(types, setTypes, t.id)}>{t.label}</Toggle>)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ib-name" hint="optional">Import name</Label>
          <Input id="ib-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vacant SFR · 67213" />
        </div>
        <div>
          <Label htmlFor="ib-max" hint="caps credits">Max records</Label>
          <Input id="ib-max" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      {error && <p role="alert" className="rounded border border-neg/30 bg-neg-bg px-3 py-2 text-sm text-neg">{error}</p>}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-xs text-fg-3">Counting and estimating are free. Nothing is retrieved until the owner approves the credit amount. Owner phone numbers are never purchased by imports.</p>
        <Button type="submit" variant="primary" disabled={!connected || readOnly || !zips.length} loading={pending}>
          <SearchIcon className="h-3.5 w-3.5" /> Count &amp; estimate
        </Button>
      </div>
    </form>
  );
}

function ListForm({ connected, readOnly }: { connected: boolean; readOnly: boolean }) {
  const [lists, setLists] = useState<{ id: string; name: string; total: number }[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listId, setListId] = useState("");
  const [max, setMax] = useState("");
  const [details, setDetails] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    if (!connected) return;
    listDmListsAction().then((r) => (r.ok ? setLists(r.data ?? []) : setLoadError(r.error)));
  }, [connected]);
  const list = lists?.find((l) => l.id === listId);
  useEffect(() => {
    if (list) setMax(String(list.total));
  }, [list]);
  return (
    <form
      className="space-y-4 px-3.5 py-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!list) return;
        start(async () => {
          const r = await createListJobAction({ listId: list.id, listName: list.name, total: list.total, maxRecords: Number(max) || list.total, fetchDetails: details });
          notify(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <div>
        <Label htmlFor="ib-list">DealMachine list</Label>
        <Select id="ib-list" value={listId} onChange={(e) => setListId(e.target.value)} disabled={!connected || !lists}>
          <option value="">{!connected ? "Not connected" : loadError ? "Could not load lists" : lists ? "Choose a saved list…" : "Loading lists…"}</option>
          {lists?.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.total.toLocaleString("en-US")}</option>)}
        </Select>
        {loadError && <p className="mt-1 text-xs text-neg">{loadError}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ib-lmax">Max records</Label>
          <Input id="ib-lmax" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} disabled={!list} />
        </div>
        <label className="mt-5 flex items-center gap-2 text-sm text-fg-2">
          <input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} className="h-3.5 w-3.5 accent-current" />
          Include beds, baths &amp; sq ft (free, slower)
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-xs text-fg-3">Imports addresses and base facts from your saved prospects. Uses no credits. Duplicates merge into existing records.</p>
        <Button type="submit" variant="primary" disabled={!list || readOnly} loading={pending}>
          <ListChecks className="h-3.5 w-3.5" /> Prepare import
        </Button>
      </div>
    </form>
  );
}
