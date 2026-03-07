import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Play, Flag } from "lucide-react";

// Warehouse coordinates — 14-2470 Lucknow Dr, Mississauga, ON
const WAREHOUSE_LAT = 43.6629;
const WAREHOUSE_LNG = -79.6197;
const GEOFENCE_RADIUS_KM = 1;
const SKIP_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Props {
  hasActiveStops: boolean;
}

export default function GeofencePrompt({ hasActiveStops }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [promptType, setPromptType] = useState<"start" | "finish" | null>(null);
  const [mileage, setMileage] = useState("");
  const [saving, setSaving] = useState(false);

  const checkGeofence = useCallback(() => {
    if (!user || !("geolocation" in navigator)) return;

    // Check skip cooldown
    const skipKey = `geofence_skip_${user.id}`;
    const lastSkip = localStorage.getItem(skipKey);
    if (lastSkip && Date.now() - parseInt(lastSkip) < SKIP_COOLDOWN_MS) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dist = haversineKm(pos.coords.latitude, pos.coords.longitude, WAREHOUSE_LAT, WAREHOUSE_LNG);
        if (dist > GEOFENCE_RADIUS_KM) return;

        // Check if already logged today
        const today = new Date().toISOString().split("T")[0];
        const { data: todayLogs } = await supabase
          .from("daily_logs")
          .select("event_type")
          .eq("driver_id", user.id)
          .gte("logged_at", today + "T00:00:00")
          .lte("logged_at", today + "T23:59:59");

        const hasStart = todayLogs?.some(l => l.event_type === "Start");
        const hasFinish = todayLogs?.some(l => l.event_type === "Finish");

        if (!hasStart) {
          setPromptType("start");
        } else if (hasActiveStops && !hasFinish) {
          // Don't prompt finish while stops are active - wait until done
        } else if (!hasFinish && hasStart) {
          setPromptType("finish");
        }
      },
      () => {} // silently fail if permission denied
    );
  }, [user, hasActiveStops]);

  useEffect(() => {
    checkGeofence();
    const interval = setInterval(checkGeofence, 60_000); // check every minute
    return () => clearInterval(interval);
  }, [checkGeofence]);

  const handleLog = async () => {
    if (!user || !promptType) return;
    setSaving(true);
    const { error } = await supabase.from("daily_logs").insert({
      driver_id: user.id,
      event_type: promptType === "start" ? "Start" : "Finish",
      current_mileage: mileage ? parseInt(mileage) : null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: promptType === "start" ? "Day Started" : "Day Finished", description: "Event logged successfully." });
    }
    setSaving(false);
    setPromptType(null);
    setMileage("");
  };

  const handleSkip = () => {
    if (user) {
      localStorage.setItem(`geofence_skip_${user.id}`, Date.now().toString());
    }
    setPromptType(null);
    setMileage("");
  };

  return (
    <Dialog open={!!promptType} onOpenChange={() => setPromptType(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {promptType === "start" ? <Play className="h-5 w-5 text-success" /> : <Flag className="h-5 w-5 text-warning" />}
            {promptType === "start" ? "Start Your Day" : "Finish Your Day"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            You're near the warehouse
          </div>
          <div className="space-y-2">
            <Label>Current Mileage (optional)</Label>
            <Input type="number" placeholder="Enter current odometer reading" value={mileage} onChange={e => setMileage(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleSkip}>Skip</Button>
          <Button onClick={handleLog} disabled={saving}>
            {saving ? "Logging..." : promptType === "start" ? "Start Day" : "Finish Day"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
