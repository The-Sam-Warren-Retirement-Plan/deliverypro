import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onImported: () => void;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parsePaymentStatus(val: string): "paid" | "unpaid" {
  return val.toLowerCase() === "paid" ? "paid" : "unpaid";
}

function parseDeliveryStatus(val: string): "requested" | "ready" | "in_warehouse" | "out_for_delivery" | "delivered" {
  const map: Record<string, any> = {
    requested: "requested",
    ready: "ready",
    "in warehouse": "in_warehouse",
    in_warehouse: "in_warehouse",
    "out for delivery": "out_for_delivery",
    out_for_delivery: "out_for_delivery",
    delivered: "delivered",
  };
  return map[val.toLowerCase()] ?? "requested";
}

export default function CsvUpload({ onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleImport = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());

      // Column index mapping
      const col = (name: string) => headers.indexOf(name);
      const pkgIdx = col("pkgplace id");
      const statusIdx = col("delivery status");
      const auctionIdx = col("auction house");
      const paymentIdx = col("payment status");
      const customerIdx = col("customer");
      const addressIdx = col("address");
      const address2Idx = col("address line 2");
      const zipIdx = col("zip code");
      const zoneIdx = col("zone");
      const phoneIdx = col("phone");
      const emailIdx = col("email");
      const instructionsIdx = col("delivery instructions");

      if (pkgIdx === -1) throw new Error('Missing required column: "PkgPlace ID"');

      const orders = lines.slice(1).map((line) => {
        const vals = parseCsvLine(line);
        const g = (idx: number) => (idx >= 0 ? vals[idx] || null : null);
        return {
          pkgplace_id: vals[pkgIdx],
          delivery_status: parseDeliveryStatus(g(statusIdx) ?? "requested"),
          auction_house: g(auctionIdx),
          payment_status: parsePaymentStatus(g(paymentIdx) ?? "unpaid"),
          customer_name: g(customerIdx),
          address: g(addressIdx),
          address_line2: g(address2Idx),
          zip_code: g(zipIdx),
          zone: g(zoneIdx),
          phone: g(phoneIdx),
          email: g(emailIdx),
          delivery_instructions: g(instructionsIdx),
        };
      }).filter((o) => o.pkgplace_id);

      // Upsert in batches of 50
      for (let i = 0; i < orders.length; i += 50) {
        const batch = orders.slice(i, i + 50);
        const { error } = await supabase.from("orders").upsert(batch, { onConflict: "pkgplace_id" });
        if (error) throw error;
      }

      toast({ title: "Import complete", description: `${orders.length} orders imported.` });
      setFile(null);
      onImported();
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-dashed border-2">
      <CardContent className="p-6">
        {!file ? (
          <div
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop your CSV file here, or</p>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                Browse files
                <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
              <Button onClick={handleImport} disabled={uploading}>
                {uploading ? "Importing..." : "Insert Data"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
