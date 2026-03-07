import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface DriverProfile {
  id: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  is_driver: boolean;
  status: string;
}

interface RouteHistory {
  id: string;
  route_date: string;
  total_stops: number;
  start_time: string | null;
  end_time: string | null;
}

export default function DriverManagement() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDriver, setEditDriver] = useState<DriverProfile | null>(null);
  const [historyDriver, setHistoryDriver] = useState<string | null>(null);
  const [routeHistory, setRouteHistory] = useState<RouteHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { toast } = useToast();

  const fetchDrivers = async () => {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
    if (!roles?.length) { setDrivers([]); setLoading(false); return; }
    const driverIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, full_name, phone, is_driver, status")
      .in("id", driverIds);
    setDrivers((profiles as DriverProfile[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDrivers(); }, []);

  const handleSave = async () => {
    if (!editDriver) return;
    const { error } = await supabase.from("profiles").update({
      full_name: editDriver.full_name,
      phone: editDriver.phone,
      status: editDriver.status,
    }).eq("id", editDriver.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Driver profile updated." });
      setEditDriver(null);
      fetchDrivers();
    }
  };

  const fetchHistory = async (driverId: string) => {
    setHistoryDriver(driverId);
    setHistoryLoading(true);
    const { data: routes } = await supabase
      .from("routes")
      .select("id, route_date")
      .eq("driver_id", driverId)
      .order("route_date", { ascending: false });

    if (!routes?.length) { setRouteHistory([]); setHistoryLoading(false); return; }

    const history: RouteHistory[] = [];
    for (const route of routes) {
      const { data: ro } = await supabase
        .from("route_orders")
        .select("order_id")
        .eq("route_id", route.id);
      const orderIds = (ro || []).map(r => r.order_id);
      let startTime: string | null = null;
      let endTime: string | null = null;

      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from("orders")
          .select("delivery_status, created_at")
          .in("pkgplace_id", orderIds)
          .eq("delivery_status", "delivered")
          .order("created_at", { ascending: true });

        if (orders?.length) {
          startTime = orders[0].created_at;
          endTime = orders[orders.length - 1].created_at;
        }
      }

      history.push({
        id: route.id,
        route_date: route.route_date,
        total_stops: orderIds.length,
        start_time: startTime,
        end_time: endTime,
      });
    }
    setRouteHistory(history);
    setHistoryLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Driver Profiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No drivers found</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.full_name || d.display_name || "—"}</TableCell>
                      <TableCell>{d.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={d.status === "Active" ? "secondary" : "outline"} className={d.status === "Active" ? "bg-success/15 text-success" : ""}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditDriver(d)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => fetchHistory(d.id)}>
                          <Eye className="mr-1 h-3 w-3" /> History
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

      {/* Edit Dialog */}
      <Dialog open={!!editDriver} onOpenChange={() => setEditDriver(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Driver</DialogTitle></DialogHeader>
          {editDriver && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editDriver.full_name || ""} onChange={e => setEditDriver({ ...editDriver, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editDriver.phone || ""} onChange={e => setEditDriver({ ...editDriver, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editDriver.status} onValueChange={v => setEditDriver({ ...editDriver, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDriver(null)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route History Dialog */}
      <Dialog open={!!historyDriver} onOpenChange={() => setHistoryDriver(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Route History</DialogTitle></DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : routeHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No routes found</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Stops</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routeHistory.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.route_date}</TableCell>
                      <TableCell>{r.total_stops}</TableCell>
                      <TableCell className="text-xs">{r.start_time ? format(new Date(r.start_time), "h:mm a") : "—"}</TableCell>
                      <TableCell className="text-xs">{r.end_time ? format(new Date(r.end_time), "h:mm a") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
