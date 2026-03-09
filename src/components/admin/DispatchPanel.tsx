import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Zap } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface Driver {
  id: string;
  display_name: string | null;
}

interface Vehicle {
  id: string;
  year: number | null;
  make: string;
  model: string;
}

interface Props {
  selectedOrderIds: string[];
  orders: Tables<"orders">[];
  onDispatched: () => void;
}

export default function DispatchPanel({ selectedOrderIds, orders, onDispatched }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [routeDate, setRouteDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dispatching, setDispatching] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
      if (roles?.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", roles.map((d) => d.user_id));
        setDrivers(profiles || []);
      }
      const { data: v } = await supabase.from("vehicles").select("id, year, make, model");
      setVehicles(v || []);
    };
    fetchData();
  }, []);

  const handleDispatch = async () => {
    if (!selectedDriver || selectedOrderIds.length === 0) return;
    setDispatching(true);
    try {
      let { data: existingRoute } = await supabase
        .from("routes").select("id").eq("driver_id", selectedDriver).eq("route_date", routeDate).maybeSingle();

      let routeId: string;
      if (existingRoute) {
        routeId = existingRoute.id;
        if (selectedVehicle) {
          await supabase.from("routes").update({ vehicle_id: selectedVehicle }).eq("id", routeId);
        }
      } else {
        const { data: newRoute, error } = await supabase.from("routes")
          .insert({ driver_id: selectedDriver, route_date: routeDate, vehicle_id: selectedVehicle || null })
          .select("id").single();
        if (error) throw error;
        routeId = newRoute.id;
      }

      const { data: existingStops } = await supabase
        .from("route_orders").select("stop_order").eq("route_id", routeId)
        .order("stop_order", { ascending: false }).limit(1);

      let nextOrder = (existingStops?.[0]?.stop_order ?? -1) + 1;

      // Determine stop_type based on order status
      const orderMap = new Map(orders.map((o) => [o.pkgplace_id, o]));
      const routeOrders = selectedOrderIds.map((orderId, i) => {
        const order = orderMap.get(orderId);
        const isPickup = order && (order.delivery_status === "requested" || order.delivery_status === "ready");
        return {
          route_id: routeId,
          order_id: orderId,
          stop_order: nextOrder + i,
          stop_type: isPickup ? "pickup" as const : "delivery" as const,
        };
      });

      const { error } = await supabase.from("route_orders").upsert(routeOrders, { onConflict: "route_id,order_id" });
      if (error) throw error;

      // Update order statuses
      const pickupIds = routeOrders.filter((ro) => ro.stop_type === "pickup").map((ro) => ro.order_id);
      const deliveryIds = routeOrders.filter((ro) => ro.stop_type === "delivery").map((ro) => ro.order_id);
      if (deliveryIds.length) await supabase.from("orders").update({ delivery_status: "in_transit" }).in("pkgplace_id", deliveryIds);

      toast({ title: "Dispatched", description: `${selectedOrderIds.length} orders assigned to route.` });
      onDispatched();
    } catch (err: any) {
      toast({ title: "Dispatch failed", description: err.message, variant: "destructive" });
    } finally {
      setDispatching(false);
    }
  };

  const handleOptimize = async () => {
    if (!selectedDriver) return;
    setOptimizing(true);
    try {
      const { data: route } = await supabase
        .from("routes").select("id").eq("driver_id", selectedDriver).eq("route_date", routeDate).maybeSingle();
      if (!route) throw new Error("No route found for this driver and date");

      const { data, error } = await supabase.functions.invoke("optimize-route", {
        body: { route_id: route.id },
      });
      if (error) throw error;
      toast({ title: "Route Optimized", description: "Stop order has been updated." });
      onDispatched();
    } catch (err: any) {
      toast({ title: "Optimization failed", description: err.message, variant: "destructive" });
    } finally {
      setOptimizing(false);
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
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select driver" /></SelectTrigger>
          <SelectContent>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.display_name || d.id.slice(0, 8)}</SelectItem>
            ))}
            {drivers.length === 0 && <SelectItem value="none" disabled>No drivers found</SelectItem>}
          </SelectContent>
        </Select>
        <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No vehicle</SelectItem>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} className="w-[160px]" />
        <Button onClick={handleDispatch} disabled={!selectedDriver || dispatching}>
          <Send className="mr-2 h-4 w-4" />
          {dispatching ? "Dispatching..." : "Dispatch"}
        </Button>
        <Button variant="outline" onClick={handleOptimize} disabled={!selectedDriver || optimizing}>
          <Zap className="mr-2 h-4 w-4" />
          {optimizing ? "Optimizing..." : "Optimize Stop Order"}
        </Button>
      </CardContent>
    </Card>
  );
}
