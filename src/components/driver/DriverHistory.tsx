import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { History, MapPin, ChevronRight, Camera } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface RouteRecord {
  id: string;
  route_date: string;
  total_stops: number;
  start_time: string | null;
  end_time: string | null;
}

interface StopDetail {
  order: Tables<"orders">;
  photos: string[];
}

export default function DriverHistory() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<RouteRecord | null>(null);
  const [stopDetails, setStopDetails] = useState<StopDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchRoutes = async () => {
      setLoading(true);
      const { data: routeData } = await supabase
        .from("routes").select("id, route_date").eq("driver_id", user.id)
        .order("route_date", { ascending: false });

      if (!routeData?.length) { setRoutes([]); setLoading(false); return; }

      const records: RouteRecord[] = [];
      for (const route of routeData) {
        const { data: ro } = await supabase.from("route_orders").select("order_id").eq("route_id", route.id);
        const orderIds = (ro || []).map(r => r.order_id);
        let startTime: string | null = null;
        let endTime: string | null = null;
        if (orderIds.length) {
          const { data: orders } = await supabase.from("orders").select("created_at")
            .in("pkgplace_id", orderIds).eq("delivery_status", "delivered")
            .order("created_at", { ascending: true });
          if (orders?.length) { startTime = orders[0].created_at; endTime = orders[orders.length - 1].created_at; }
        }
        records.push({ id: route.id, route_date: route.route_date, total_stops: orderIds.length, start_time: startTime, end_time: endTime });
      }
      setRoutes(records);
      setLoading(false);
    };
    fetchRoutes();
  }, [user]);

  const openRouteDetails = async (route: RouteRecord) => {
    setSelectedRoute(route);
    setLoadingDetails(true);
    try {
      const { data: ro } = await supabase.from("route_orders").select("order_id").eq("route_id", route.id);
      const orderIds = (ro || []).map(r => r.order_id);
      if (!orderIds.length) { setStopDetails([]); return; }

      const { data: orders } = await supabase.from("orders").select("*").in("pkgplace_id", orderIds);
      const { data: photos } = await supabase.from("delivery_proof_photos").select("order_id, photo_url").in("order_id", orderIds);

      const photoMap = new Map<string, string[]>();
      (photos || []).forEach(p => {
        const list = photoMap.get(p.order_id) || [];
        list.push(p.photo_url);
        photoMap.set(p.order_id, list);
      });

      setStopDetails((orders || []).map(o => ({
        order: o,
        photos: photoMap.get(o.pkgplace_id) || [],
      })));
    } finally {
      setLoadingDetails(false);
    }
  };

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
        <Card key={r.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openRouteDetails(r)}>
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
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!selectedRoute} onOpenChange={() => setSelectedRoute(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRoute && format(new Date(selectedRoute.route_date + "T00:00:00"), "MMM d, yyyy")} — {selectedRoute?.total_stops} stops
            </DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
          ) : (
            <div className="space-y-4">
              {stopDetails.map((sd) => (
                <div key={sd.order.pkgplace_id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{sd.order.customer_name || sd.order.auction_house || "—"}</p>
                      <p className="text-xs text-muted-foreground">{sd.order.pkgplace_id}</p>
                      <p className="text-xs text-muted-foreground">{sd.order.address}</p>
                    </div>
                    <Badge variant="secondary" className={sd.order.delivery_status === "delivered" ? "bg-success/15 text-success" : ""}>
                      {sd.order.delivery_status}
                    </Badge>
                  </div>
                  {sd.photos.length > 0 && (
                    <div className="flex gap-2">
                      {sd.photos.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={url} alt={`Proof ${i + 1}`} className="h-16 w-16 rounded-md object-cover border" />
                        </a>
                      ))}
                      <div className="flex items-center text-xs text-muted-foreground gap-1">
                        <Camera className="h-3 w-3" /> {sd.photos.length} photo{sd.photos.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
