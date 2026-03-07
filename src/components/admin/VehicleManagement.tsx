import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Car, Plus, Wrench, Upload } from "lucide-react";
import { format } from "date-fns";

interface Vehicle {
  id: string;
  year: number | null;
  make: string;
  model: string;
  vin: string | null;
  current_mileage: number | null;
  mileage_of_last_oil_change: number | null;
  insurance_url: string | null;
  registration_url: string | null;
}

interface MaintenanceLog {
  id: string;
  service_date: string;
  description: string;
  mileage_at_service: number | null;
  cost: number | null;
}

const emptyVehicle = { year: new Date().getFullYear(), make: "", model: "", vin: "", current_mileage: 0, mileage_of_last_oil_change: 0 };

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyVehicle);
  const [editId, setEditId] = useState<string | null>(null);
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<Vehicle | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [logForm, setLogForm] = useState({ description: "", mileage_at_service: 0, cost: 0, service_date: format(new Date(), "yyyy-MM-dd") });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchVehicles = async () => {
    setLoading(true);
    const { data } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
    setVehicles((data as Vehicle[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchVehicles(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase.from("vehicles").update({
          year: form.year, make: form.make, model: form.model, vin: form.vin || null,
          current_mileage: form.current_mileage, mileage_of_last_oil_change: form.mileage_of_last_oil_change,
        }).eq("id", editId);
        if (error) throw error;
        toast({ title: "Updated", description: "Vehicle updated." });
      } else {
        const { error } = await supabase.from("vehicles").insert({
          year: form.year, make: form.make, model: form.model, vin: form.vin || null,
          current_mileage: form.current_mileage, mileage_of_last_oil_change: form.mileage_of_last_oil_change,
        });
        if (error) throw error;
        toast({ title: "Added", description: "Vehicle added." });
      }
      setShowAdd(false);
      setEditId(null);
      setForm(emptyVehicle);
      fetchVehicles();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleUploadDoc = async (vehicleId: string, field: "insurance_url" | "registration_url", file: File) => {
    const path = `vehicles/${vehicleId}/${field}_${Date.now()}.${file.name.split(".").pop()}`;
    const { error: uploadErr } = await supabase.storage.from("delivery_proof").upload(path, file);
    if (uploadErr) { toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" }); return; }
    const { data: { publicUrl } } = supabase.storage.from("delivery_proof").getPublicUrl(path);
    await supabase.from("vehicles").update({ [field]: publicUrl }).eq("id", vehicleId);
    toast({ title: "Uploaded", description: `${field === "insurance_url" ? "Insurance" : "Registration"} document saved.` });
    fetchVehicles();
  };

  const fetchLogs = async (v: Vehicle) => {
    setMaintenanceVehicle(v);
    const { data } = await supabase.from("maintenance_logs").select("*").eq("vehicle_id", v.id).order("service_date", { ascending: false });
    setLogs((data as MaintenanceLog[]) || []);
  };

  const handleAddLog = async () => {
    if (!maintenanceVehicle) return;
    setSaving(true);
    const { error } = await supabase.from("maintenance_logs").insert({
      vehicle_id: maintenanceVehicle.id,
      description: logForm.description,
      mileage_at_service: logForm.mileage_at_service,
      cost: logForm.cost,
      service_date: logForm.service_date,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "Logged", description: "Maintenance entry saved." });
      setLogForm({ description: "", mileage_at_service: 0, cost: 0, service_date: format(new Date(), "yyyy-MM-dd") });
      fetchLogs(maintenanceVehicle);
    }
    setSaving(false);
  };

  const openEdit = (v: Vehicle) => {
    setForm({ year: v.year || new Date().getFullYear(), make: v.make, model: v.model, vin: v.vin || "", current_mileage: v.current_mileage || 0, mileage_of_last_oil_change: v.mileage_of_last_oil_change || 0 });
    setEditId(v.id);
    setShowAdd(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><Car className="h-4 w-4" /> Vehicles</CardTitle>
          <Button size="sm" onClick={() => { setForm(emptyVehicle); setEditId(null); setShowAdd(true); }}>
            <Plus className="mr-1 h-3 w-3" /> Add Vehicle
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No vehicles yet</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead>Mileage</TableHead>
                    <TableHead>Last Oil</TableHead>
                    <TableHead>Docs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.year} {v.make} {v.model}</TableCell>
                      <TableCell className="font-mono text-xs">{v.vin || "—"}</TableCell>
                      <TableCell>{v.current_mileage?.toLocaleString() || "0"} mi</TableCell>
                      <TableCell>{v.mileage_of_last_oil_change?.toLocaleString() || "0"} mi</TableCell>
                      <TableCell className="space-x-1">
                        <label className="cursor-pointer">
                          <Button size="sm" variant="outline" className="text-xs" asChild><span><Upload className="mr-1 h-3 w-3" />Ins</span></Button>
                          <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files?.[0] && handleUploadDoc(v.id, "insurance_url", e.target.files[0])} />
                        </label>
                        <label className="cursor-pointer">
                          <Button size="sm" variant="outline" className="text-xs" asChild><span><Upload className="mr-1 h-3 w-3" />Reg</span></Button>
                          <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files?.[0] && handleUploadDoc(v.id, "registration_url", e.target.files[0])} />
                        </label>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => fetchLogs(v)}>
                          <Wrench className="mr-1 h-3 w-3" /> Logs
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Vehicle */}
      <Dialog open={showAdd} onOpenChange={() => setShowAdd(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Vehicle</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2"><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm({ ...form, year: +e.target.value })} /></div>
            <div className="space-y-2"><Label>Make</Label><Input value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} /></div>
            <div className="space-y-2"><Label>Model</Label><Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></div>
            <div className="space-y-2"><Label>VIN</Label><Input value={form.vin} onChange={e => setForm({ ...form, vin: e.target.value })} /></div>
            <div className="space-y-2"><Label>Current Mileage</Label><Input type="number" value={form.current_mileage} onChange={e => setForm({ ...form, current_mileage: +e.target.value })} /></div>
            <div className="space-y-2"><Label>Last Oil Change (mi)</Label><Input type="number" value={form.mileage_of_last_oil_change} onChange={e => setForm({ ...form, mileage_of_last_oil_change: +e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.make || !form.model || saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Logs */}
      <Dialog open={!!maintenanceVehicle} onOpenChange={() => setMaintenanceVehicle(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Maintenance — {maintenanceVehicle?.year} {maintenanceVehicle?.make} {maintenanceVehicle?.model}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={logForm.service_date} onChange={e => setLogForm({ ...logForm, service_date: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Mileage</Label><Input type="number" value={logForm.mileage_at_service} onChange={e => setLogForm({ ...logForm, mileage_at_service: +e.target.value })} /></div>
              <div className="col-span-2 space-y-1"><Label className="text-xs">Description</Label><Input value={logForm.description} onChange={e => setLogForm({ ...logForm, description: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Cost ($)</Label><Input type="number" step="0.01" value={logForm.cost} onChange={e => setLogForm({ ...logForm, cost: +e.target.value })} /></div>
              <div className="flex items-end"><Button size="sm" onClick={handleAddLog} disabled={!logForm.description || saving}>Add Entry</Button></div>
            </div>
            {logs.length > 0 && (
              <div className="max-h-[250px] overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Service</TableHead><TableHead>Mileage</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {logs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{l.service_date}</TableCell>
                        <TableCell className="text-sm">{l.description}</TableCell>
                        <TableCell className="text-xs">{l.mileage_at_service?.toLocaleString() || "—"}</TableCell>
                        <TableCell className="text-xs">${l.cost?.toFixed(2) || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
