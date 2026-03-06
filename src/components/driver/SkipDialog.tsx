import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Enums } from "@/integrations/supabase/types";

const reasons: { value: Enums<"archive_reason">; label: string }[] = [
  { value: "business_closed", label: "Business Closed" },
  { value: "customer_not_home", label: "Customer Not Home" },
  { value: "access_code_required", label: "Access Code Required" },
  { value: "safety_weather", label: "Safety / Weather Issue" },
  { value: "package_damaged", label: "Package Damaged" },
];

interface Props {
  orderId: string | null;
  onClose: () => void;
  onSkipped: () => void;
}

export default function SkipDialog({ orderId, onClose, onSkipped }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState<Enums<"archive_reason"> | "">("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSkip = async () => {
    if (!reason || !orderId || !user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("archived_stops").insert({
        order_id: orderId,
        driver_id: user.id,
        reason: reason as Enums<"archive_reason">,
        notes: notes || null,
      });
      if (error) throw error;
      toast({ title: "Stop skipped", description: "The stop has been archived." });
      onSkipped();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setReason("");
      setNotes("");
    }
  };

  return (
    <Dialog open={!!orderId} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skip Stop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Select value={reason} onValueChange={(v) => setReason(v as Enums<"archive_reason">)}>
            <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
            <SelectContent>
              {reasons.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea placeholder="Additional notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleSkip} disabled={!reason || loading}>
            {loading ? "Skipping..." : "Skip Stop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
