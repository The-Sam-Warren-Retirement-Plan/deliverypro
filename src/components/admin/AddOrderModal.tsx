import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const generateId = () => `DP-${Date.now()}`;

export default function AddOrderModal({ open, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    pkgplace_id: generateId(),
    customer_name: "",
    address: "",
    address_line2: "",
    zip_code: "",
    auction_house: "",
    payment_status: "unpaid" as "paid" | "unpaid",
    delivery_status: "ready" as "ready" | "requested" | "picked_up" | "warehouse" | "in_transit",
    zone: "",
    phone: "",
    email: "",
    delivery_instructions: "",
    box_count: "",
  });

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.customer_name.trim() && !form.address.trim()) {
      toast({ title: "Required", description: "Please enter at least a customer name or address.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        pkgplace_id: form.pkgplace_id.trim() || generateId(),
        customer_name: form.customer_name.trim() || null,
        address: form.address.trim() || null,
        address_line2: form.address_line2.trim() || null,
        zip_code: form.zip_code.trim() || null,
        auction_house: form.auction_house.trim() || null,
        payment_status: form.payment_status,
        delivery_status: form.delivery_status,
        zone: form.zone.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        delivery_instructions: form.delivery_instructions.trim() || null,
        box_count: form.box_count ? parseInt(form.box_count) : null,
      };

      const { error } = await supabase.from("orders").insert(payload);
      if (error) throw error;

      // Geocode if address provided
      if (payload.address) {
        supabase.functions.invoke("geocode-addresses", { body: { order_ids: [payload.pkgplace_id] } }).catch(() => {});
      }

      toast({ title: "Order added", description: `${payload.pkgplace_id} created.` });
      onCreated();
      onClose();
      setForm({ ...form, pkgplace_id: generateId(), customer_name: "", address: "", address_line2: "", zip_code: "", auction_house: "", zone: "", phone: "", email: "", delivery_instructions: "", box_count: "" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Order</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block">Order ID</label>
            <Input value={form.pkgplace_id} onChange={(e) => set("pkgplace_id", e.target.value)} placeholder="Auto-generated" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block">Customer Name</label>
            <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Full name" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block">Address</label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street address" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Address Line 2</label>
            <Input value={form.address_line2} onChange={(e) => set("address_line2", e.target.value)} placeholder="Apt, suite..." />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Zip / Postal Code</label>
            <Input value={form.zip_code} onChange={(e) => set("zip_code", e.target.value)} placeholder="Postal code" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block">Auction House (optional)</label>
            <Input value={form.auction_house} onChange={(e) => set("auction_house", e.target.value)} placeholder="Name of auction where items were picked up" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Delivery Status</label>
            <Select value={form.delivery_status} onValueChange={(v) => set("delivery_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="requested">Requested</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="picked_up">Picked Up</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Payment Status</label>
            <Select value={form.payment_status} onValueChange={(v) => set("payment_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Zone</label>
            <Input value={form.zone} onChange={(e) => set("zone", e.target.value)} placeholder="Delivery zone" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Box Count</label>
            <Input type="number" min="0" value={form.box_count} onChange={(e) => set("box_count", e.target.value)} placeholder="# boxes" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Phone</label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 000-0000" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Email</label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block">Delivery Instructions</label>
            <Textarea value={form.delivery_instructions} onChange={(e) => set("delivery_instructions", e.target.value)} placeholder="Gate code, buzzer, leave at door..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Add Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
