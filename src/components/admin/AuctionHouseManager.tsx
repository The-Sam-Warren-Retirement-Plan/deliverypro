import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AuctionHouse = Tables<"auction_houses">;

const emptyForm = (): Omit<AuctionHouse, "id" | "created_at"> => ({
  name: "",
  address: null,
  phone: null,
  contact: null,
  delivery_zone: null,
  instructions: null,
  notes: null,
});

export default function AuctionHouseManager() {
  const { toast } = useToast();
  const [houses, setHouses] = useState<AuctionHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AuctionHouse | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("auction_houses").select("*").order("name");
    setHouses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (h: AuctionHouse) => {
    setEditing(h);
    setForm({
      name: h.name,
      address: h.address,
      phone: h.phone,
      contact: h.contact,
      delivery_zone: h.delivery_zone,
      instructions: h.instructions,
      notes: h.notes,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address?.trim() || null,
        phone: form.phone?.trim() || null,
        contact: form.contact?.trim() || null,
        delivery_zone: form.delivery_zone?.trim() || null,
        instructions: form.instructions?.trim() || null,
        notes: form.notes?.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("auction_houses").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Auction house updated" });
      } else {
        const { error } = await supabase.from("auction_houses").insert(payload);
        if (error) throw error;
        toast({ title: "Auction house added" });
      }
      setOpen(false);
      fetch();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("auction_houses").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted" });
      fetch();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value || null }));

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{houses.length} auction house{houses.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add Auction House</Button>
      </div>

      {houses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Building2 className="h-12 w-12" />
          <p className="text-sm">No auction houses yet</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Address</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Zone</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {houses.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{h.address || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{h.phone || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{h.contact || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{h.delivery_zone || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(h)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(h.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Auction House" : "Add Auction House"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block">Name *</label>
              <Input placeholder="Auction House Name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block">Address</label>
              <Input placeholder="Full address" value={form.address || ""} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Phone</label>
              <Input placeholder="(555) 000-0000" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Contact Name</label>
              <Input placeholder="Contact person" value={form.contact || ""} onChange={(e) => set("contact", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block">Delivery Zone</label>
              <Input placeholder="e.g. Hamilton West" value={form.delivery_zone || ""} onChange={(e) => set("delivery_zone", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block">Pickup Instructions</label>
              <Textarea placeholder="Instructions for driver at pickup..." value={form.instructions || ""} onChange={(e) => set("instructions", e.target.value)} rows={2} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block">Notes</label>
              <Textarea placeholder="Internal notes..." value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving ? "Saving..." : editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
