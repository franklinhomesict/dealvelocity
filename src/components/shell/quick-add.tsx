"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../ui/overlay";
import { Button } from "../ui/button";
import { Input, Label, Select, Textarea } from "../ui/field";
import { toast } from "../ui/toast";
import { createPropertyAction } from "@/app/actions";
import { PROPERTY_TYPES } from "@/lib/domain";

const empty = { street: "", unit: "", city: "Wichita", state: "KS", zip: "", propertyType: "single_family", beds: "", baths: "", sqft: "", yearBuilt: "", sellerName: "", sellerPhone: "", askingPrice: "", source: "manual", notes: "" };

export function QuickAddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [v, setV] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createPropertyAction(v);
      if (!r.ok) return setError(r.error);
      toast(r.message ?? "Property added");
      setV(empty);
      onClose();
      router.push(`/properties/${r.data!.propertyId}`);
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add property"
      description="Creates the property, seller contact and a new lead. Duplicate addresses open the existing record."
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" form="quick-add" loading={pending}>Add property</Button>
        </>
      }
    >
      <form id="quick-add" onSubmit={submit} className="grid grid-cols-6 gap-x-3 gap-y-3">
        <div className="col-span-6 sm:col-span-4">
          <Label htmlFor="qa-street">Street address</Label>
          <Input id="qa-street" required autoFocus value={v.street} onChange={set("street")} placeholder="1418 S Seneca St" autoComplete="off" />
        </div>
        <div className="col-span-6 sm:col-span-2">
          <Label htmlFor="qa-unit" hint="optional">Unit</Label>
          <Input id="qa-unit" value={v.unit} onChange={set("unit")} />
        </div>
        <div className="col-span-3">
          <Label htmlFor="qa-city">City</Label>
          <Input id="qa-city" required value={v.city} onChange={set("city")} />
        </div>
        <div className="col-span-1">
          <Label htmlFor="qa-state">State</Label>
          <Input id="qa-state" required maxLength={2} value={v.state} onChange={set("state")} />
        </div>
        <div className="col-span-2">
          <Label htmlFor="qa-zip">ZIP</Label>
          <Input id="qa-zip" required inputMode="numeric" pattern="\d{5}" value={v.zip} onChange={set("zip")} placeholder="67213" />
        </div>
        <div className="col-span-6 sm:col-span-2">
          <Label htmlFor="qa-type">Type</Label>
          <Select id="qa-type" value={v.propertyType} onChange={set("propertyType")}>
            {Object.entries(PROPERTY_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="qa-beds">Beds</Label>
          <Input id="qa-beds" inputMode="numeric" value={v.beds} onChange={set("beds")} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="qa-baths">Baths</Label>
          <Input id="qa-baths" inputMode="decimal" value={v.baths} onChange={set("baths")} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <Label htmlFor="qa-sqft">Sq ft</Label>
          <Input id="qa-sqft" inputMode="numeric" value={v.sqft} onChange={set("sqft")} />
        </div>
        <div className="col-span-6 mt-1 border-t border-line pt-3 eyebrow">Seller</div>
        <div className="col-span-6 sm:col-span-3">
          <Label htmlFor="qa-seller">Name</Label>
          <Input id="qa-seller" value={v.sellerName} onChange={set("sellerName")} autoComplete="off" />
        </div>
        <div className="col-span-6 sm:col-span-3">
          <Label htmlFor="qa-phone">Phone</Label>
          <Input id="qa-phone" type="tel" value={v.sellerPhone} onChange={set("sellerPhone")} placeholder="(316) 555-0100" />
        </div>
        <div className="col-span-3">
          <Label htmlFor="qa-ask">Asking price</Label>
          <Input id="qa-ask" prefix="$" inputMode="numeric" value={v.askingPrice} onChange={set("askingPrice")} />
        </div>
        <div className="col-span-3">
          <Label htmlFor="qa-source">Source</Label>
          <Select id="qa-source" value={v.source} onChange={set("source")}>
            <option value="manual">Manual entry</option>
            <option value="referral">Referral</option>
            <option value="inbound_call">Inbound call</option>
          </Select>
        </div>
        <div className="col-span-6">
          <Label htmlFor="qa-notes" hint="optional">Notes</Label>
          <Textarea id="qa-notes" rows={2} value={v.notes} onChange={set("notes")} />
        </div>
        {error && <div role="alert" className="col-span-6 rounded border border-neg/30 bg-neg-bg px-3 py-2 text-sm text-neg">{error}</div>}
        <p className="col-span-6 text-xs text-fg-3">Adding a phone number does not start any outreach. Messaging requires recorded consent (Phase 4).</p>
      </form>
    </Modal>
  );
}
