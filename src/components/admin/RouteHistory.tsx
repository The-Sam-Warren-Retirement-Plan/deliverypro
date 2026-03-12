import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, MapPin, Camera, Pencil, Save, X } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface RouteRecord {
  id: string;
  route_date: string;
  note: string | null;
  closed_at: string | null;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  vehicle_label: string | null;
  total_stops: number;
}

interface StopDetail {
  order: Tables<"orders">;
  photos: string[];
}

interface Driver { id: string; display_name: string | null; }
interface Vehicle { id: string; year: number | null; make: string; model: string; }

const statusColors: Record<string, string> = {
  requested: "bg-muted text-muted-foreground",
  ready: "bg-info/15 text-info",
  picked_up: "bg-pickup/15 text-pickup",
  warehouse: "bg-warning/15 text-warning",
  in_transit: "bg-primary/15 text-primary",
  delivered: "bg-success/15 text-success",
};

export default function RouteHistory() {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDriver, setFilterDriver] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [selectedRoute, setSelectedRoute] = useState<RouteRecord | null>(null);
  const [stopDetails, setStopDetails] = useState<StopDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Edit mode
  const [editingRoute, setEditingRoute] = useState<RouteRecord | null>(null);
  const [editDriver, setEditDriver] = useState("");
  const [editVehicle, setEditVehicle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
    const driverIds = (roles || []).map((r) => r.user_id);
    const { data: profiles } = driverIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", driverIds)
      : { data: [] };
    setDrivers(profiles || []);

    const { data: v } = await supabase.from("vehicles").select("id, year, make, model");
    setVehicles(v || []);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p.display_name]));
    const vehicleMap = new Map((v || []).map((vh) => [vh.id, `${vh.year} ${vh.make} ${vh.model}`]));

    const { data: routeData } = await supabase.from("routes").select("*").order("route_date", { ascending: false });
    if (!routeData?.length) { setRoutes([]); setLoading(false); return; }

    const records: RouteRecord[] = [];
    for (const r of routeData) {
      const { count } = await supabase.from("route_orders").select("id", { count: "exact", head: true }).eq("route_id", r.id);
      records.push({
        id: r.id,
        route_date: r.route_date,
        note: r.note,
        closed_at: r.closed_at,
        driver_id: r.driver_id,
        driver_name: r.driver_id ? (profileMap.get(r.driver_id) || r.driver_id.slice(0, 8)) : null,
        vehicle_id: r.vehicle_id,
        vehicle_label: r.vehicle_id ? (vehicleMap.get(r.vehicle_id) || null) : null,
        total_stops: count || 0,
      });
    }
    setRoutes(records);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = routes.filter((r) => {
    if (filterDriver !== "all" && r.driver_id !== filterDriver) return false;
    if (filterDateFrom && r.route_date < filterDateFrom) return false;
    if (filterDateTo && r.route_date > filterDateTo) return false;
    return true;
  });

  const openRouteDetails = async (route: RouteRecord) => {
    setSelectedRoute(route);
    setLoadingDetails(true);
    try {
      const { data: ro } = await supabase.from("route_orders").select("order_id").eq("route_id", route.id);
      const orderIds = (ro || []).map((r) => r.order_id);
      if (!orderIds.length) { setStopDetails([]); return; }
      const { data: orders } = await supabase.from("orders").select("*").in("pkgplace_id", orderIds);
      const { data: photos } = await supabase.from("delivery_proof_photos").select("order_id, photo_url").in("order_id", orderIds);
      const photoMap = new Map<string, string[]>();
      (photos || []).forEach((p) => {
        const list = photoMap.get(p.order_id) || [];
        list.push(p.photo_url);
        photoMap.set(p.order_id, list);
      });
      setStopDetails((orders || []).map((o) => ({ order: o, photos: photoMap.get(o.pkgplace_id) || [] })));
    } finally {
      setLoadingDetails(false);
    }
  };

  const startEdit = (r: RouteRecord) => {
    setEditingRoute(r);
    setEditDriver(r.driver_id || "");
    setEditVehicle(r.vehicle_id || "");
    setEditDate(r.route_date);
    setEditNote(r.note || "");
  };

  const saveEdit = async () => {
    if (!editingRoute) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("routes").update({
        driver_id: editDriver || null,
        vehicle_id: editVehicle || null,
        route_date: editDate,
        note: editNote.trim() || null,
      }).eq("id", editingRoute.id);
      if (error) throw error;
      toast({ title: "Route updated" });
      setEditingRoute(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input type="date" placeholder="From date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[160px]" />
        <Input type="date" placeholder="To date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[160px]" />
        <Select value={filterDriver} onValueChange={setFilterDriver}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Drivers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drivers</SelectItem>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.display_name || d.id.slice(0, 8)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterDateFrom || filterDateTo || filterDriver !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterDriver("all"); }}>
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} route{filtered.length !== 1 ? "s" : ""}</p>

      {/* Route table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead className="hidden md:table-cell">Vehicle</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="hidden md:table-cell">Stops</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No routes found</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openRouteDetails(r)}>
                <TableCell className="font-medium text-sm">{format(new Date(r.route_date + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-sm">{r.driver_name || "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">{r.vehicle_label || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.note || "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">{r.total_stops}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="secondary" className={r.closed_at ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}>
                    {r.closed_at ? "Closed" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRouteDetails(r)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Route detail dialog */}
      <Dialog open={!!selectedRoute} onOpenChange={() => setSelectedRoute(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRoute && format(new Date(selectedRoute.route_date + "T00:00:00"), "MMM d, yyyy")}
              {selectedRoute?.note && <span className="ml-2 text-muted-foreground font-normal text-sm">— {selectedRoute.note}</span>}
            </DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
          ) : (
            <div className="space-y-3">
              {stopDetails.map((sd) => (
                <div key={sd.order.pkgplace_id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{sd.order.customer_name || sd.order.auction_house || "—"}</p>
                      <p className="text-xs text-muted-foreground">{sd.order.pkgplace_id}</p>
                      <p className="text-xs text-muted-foreground">{sd.order.address}</p>
                    </div>
                    <Badge variant="secondary" className={statusColors[sd.order.delivery_status] || ""}>
                      {sd.order.delivery_status}
                    </Badge>
                  </div>
                  {sd.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      {sd.photos.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Proof ${i + 1}`} className="h-16 w-16 rounded-md object-cover border hover:opacity-90" />
                        </a>
                      ))}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Camera className="h-3 w-3" />{sd.photos.length} photo{sd.photos.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {stopDetails.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No stops</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit route dialog */}
      <Dialog open={!!editingRoute} onOpenChange={() => setEditingRoute(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Route</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium mb-1 block">Date</label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Driver</label>
              <Select value={editDriver} onValueChange={setEditDriver}>
                <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No driver</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.display_name || d.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Vehicle</label>
              <Select value={editVehicle} onValueChange={setEditVehicle}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No vehicle</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Route Note</label>
              <Input placeholder="e.g. Hamilton West" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setEditingRoute(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}><Save className="mr-1.5 h-4 w-4" />{saving ? "Saving..." : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
