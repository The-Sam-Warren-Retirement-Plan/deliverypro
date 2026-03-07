import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Camera, X, Upload } from "lucide-react";

interface Props {
  orderId: string | null;
  onClose: () => void;
  onUploaded: () => void;
}

export default function MultiPhotoUpload({ orderId, onClose, onUploaded }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList) => {
    const remaining = 3 - files.length;
    const toAdd = Array.from(newFiles).slice(0, remaining);
    setFiles(prev => [...prev, ...toAdd]);
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (!orderId || !user || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const path = `${orderId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const { error: uploadErr } = await supabase.storage.from("delivery_proof").upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from("delivery_proof").getPublicUrl(path);
        await supabase.from("delivery_proof_photos").insert({
          order_id: orderId,
          photo_url: publicUrl,
          uploaded_by: user.id,
        });
      }
      // Also update the order's main photo_url with the first photo
      if (files.length > 0) {
        const { data: photos } = await supabase.from("delivery_proof_photos").select("photo_url").eq("order_id", orderId).limit(1);
        if (photos?.[0]) {
          await supabase.from("orders").update({ photo_url: photos[0].photo_url }).eq("pkgplace_id", orderId);
        }
      }
      // Mark as delivered
      await supabase.from("orders").update({ delivery_status: "delivered" }).eq("pkgplace_id", orderId);
      toast({ title: "Delivered", description: `${files.length} photo(s) uploaded. Order marked delivered.` });
      setFiles([]);
      onUploaded();
      onClose();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  return (
    <Dialog open={!!orderId} onOpenChange={() => { setFiles([]); onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delivery Proof Photos</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Upload up to 3 photos as proof of delivery for order <span className="font-mono">{orderId}</span>.</p>
        <div className="grid grid-cols-3 gap-3 py-3">
          {files.map((f, i) => (
            <div key={i} className="relative aspect-square rounded-lg border overflow-hidden bg-muted">
              <img src={URL.createObjectURL(f)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              <button onClick={() => removeFile(i)} className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {files.length < 3 && (
            <button
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Camera className="h-6 w-6" />
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => e.target.files && addFiles(e.target.files)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setFiles([]); onClose(); }}>Cancel</Button>
          <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
            <Upload className="mr-2 h-4 w-4" /> {uploading ? "Uploading..." : `Deliver (${files.length} photo${files.length !== 1 ? "s" : ""})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
