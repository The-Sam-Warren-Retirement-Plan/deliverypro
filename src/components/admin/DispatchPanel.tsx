import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { format } from "date-fns";

interface Driver {
  id: string;
  display_name: string | null;
}

interface Props {
  selectedOrderIds: string[];
  onDispatched: () => void;
}

export default function DispatchPanel({ selectedOrderIds, onDispatched }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [routeDate, setRouteDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dispatching, setDispatching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDrivers = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "driver");
      if (!data?.length) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", data.map((d) => d.user_id));
      setDrivers(profiles || []);
    };
    fetchDrivers();
  }, []);

  const handleDispatch = async () => {
    if (!selectedDriver || selectedOrderIds.length === 0) return;
    setDispatching(true);
    try {
      // Create or get route for driver + date
      let { data: existingRoute } = await supabase
        .from("routes")
        .select("id")
        .eq("driver_id", selectedDriver)
        .eq("route_date", routeDate)
        .maybeSingle();

      let routeId: string;
      if (existingRoute) {
        routeId = existingRoute.id;
      } else {
        const { data: newRoute, error } = await supabase
          .from("routes")
          .insert({ driver_id: selectedDriver, route_date: routeDate })
          .select("id")
          .single();
        if (error) throw error;
        routeId = newRoute.id;
      }

      // Get max stop_order
      const { data: existingStops } = await supabase
        .from("route_orders")
        .select("stop_order")
        .eq("route_id", routeId)
        .order("stop_order", { ascending: false })
        .limit(1);

      let nextOrder = (existingStops?.[0]?.stop_order ?? -1) + 1;

      const routeOrders = selectedOrderIds.map((orderId, i) => ({
        route_id: routeId,
        order_id: orderId,
        stop_order: nextOrder + i,
        stop_type: "delivery" as const,
      }));

      const { error } = await supabase.from("route_orders").upsert(routeOrders, { onConflict: "route_id,order_id" });
      if (error) throw error;

      // Update order statuses to out_for_delivery
      await supabase
        .from("orders")
        .update({ delivery_status: "out_for_delivery" })
        .in("pkgplace_id", selectedOrderIds);

      toast({ title: "Dispatched", description: `${selectedOrderIds.length} orders assigned to route.` });
      onDispatched();
    } catch (err: any) {
      toast({ title: "Dispatch failed", description: err.message, variant: "destructive" });
    } finally {
      setDispatching(false);
    }
  };

  if (selectedOrderIds.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dispatch {selectedOrderIds.length} Orders</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Select value={selectedDriver} onValueChange={setSelectedDriver}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select driver" />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.display_name || d.id.slice(0, 8)}</SelectItem>
            ))}
            {drivers.length === 0 && (
              <SelectItem value="none" disabled>No drivers found</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} className="w-[160px]" />
        <Button onClick={handleDispatch} disabled={!selectedDriver || dispatching}>
          <Send className="mr-2 h-4 w-4" />
          {dispatching ? "Dispatching..." : "Dispatch"}
        </Button>
      </CardContent>
    </Card>
  );
}
