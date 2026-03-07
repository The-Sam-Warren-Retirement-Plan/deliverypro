import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, MapPin } from "lucide-react";
import { format } from "date-fns";

interface RouteRecord {
  id: string;
  route_date: string;
  total_stops: number;
  start_time: string | null;
  end_time: string | null;
}

export default function DriverHistory() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const { data: routeData } = await supabase
        .from("routes")
        .select("id, route_date")
        .eq("driver_id", user.id)
        .order("route_date", { ascending: false });

      if (!routeData?.length) { setRoutes([]); setLoading(false); return; }

      const records: RouteRecord[] = [];
      for (const route of routeData) {
        const { data: ro } = await supabase.from("route_orders").select("order_id").eq("route_id", route.id);
        const orderIds = (ro || []).map(r => r.order_id);
        let startTime: string | null = null;
        let endTime: string | null = null;
        if (orderIds.length) {
          const { data: orders } = await supabase.from("orders").select("created_at").in("pkgplace_id", orderIds).eq("delivery_status", "delivered").order("created_at", { ascending: true });
          if (orders?.length) { startTime = orders[0].created_at; endTime = orders[orders.length - 1].created_at; }
        }
        records.push({ id: route.id, route_date: route.route_date, total_stops: orderIds.length, start_time: startTime, end_time: endTime });
      }
      setRoutes(records);
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <History className="h-12 w-12" />
        <p className="text-sm">No route history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {routes.map(r => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{format(new Date(r.route_date + "T00:00:00"), "EEEE, MMM d, yyyy")}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.total_stops} stops</span>
                  {r.start_time && <span>Start: {format(new Date(r.start_time), "h:mm a")}</span>}
                  {r.end_time && <span>End: {format(new Date(r.end_time), "h:mm a")}</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
