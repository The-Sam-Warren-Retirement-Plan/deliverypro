import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, X, MapPin, AlertTriangle } from "lucide-react";
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
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

function parsePaymentStatus(val: string): "paid" | "unpaid" {
  return val.toLowerCase().trim() === "paid" ? "paid" : "unpaid";
}

// Strict case-insensitive mapping — only exact matches produce a status
function parseDeliveryStatus(val: string): "requested" | "ready" | "picked_up" | "warehouse" | "in_transit" | "delivered" | null {
  const map: Record<string, "requested" | "ready" | "picked_up" | "warehouse" | "in_transit" | "delivered"> = {
    "requested": "requested",
    "ready": "ready",
    "picked up": "picked_up",
    "picked_up": "picked_up",
    "warehouse": "warehouse",
    "warehoused": "warehouse",
    "in warehouse": "warehouse",
    "in_warehouse": "warehouse",
    "in transit": "in_transit",
    "in_transit": "in_transit",
    "out for delivery": "in_transit",
    "out_for_delivery": "in_transit",
    "delivered": "delivered",
  };
  const normalized = val.toLowerCase().trim();
  return map[normalized] ?? null;
}

interface ImportSummary {
  total: number;
  skippedNotesOnly: number;
  updatedExisting: number;
  created: number;
  statusCounts: Record<string, number>;
}

export default function CsvUpload({ onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState(0);
  const [clearExisting, setClearExisting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const { toast } = useToast();

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }
    setFile(f);
    setSummary(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const geocodeOrders = async (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    setGeocoding(true);
    setGeocodeProgress(0);
    try {
      const batchSize = 10;
      for (let i = 0; i < orderIds.length; i += batchSize) {
        const batch = orderIds.slice(i, i + batchSize);
        await supabase.functions.invoke("geocode-addresses", {
          body: { order_ids: batch },
        });
        setGeocodeProgress(Math.round(((i + batch.length) / orderIds.length) * 100));
      }
    } catch (err: any) {
      console.error("Geocoding error:", err);
    } finally {
      setGeocoding(false);
      setGeocodeProgress(100);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setUploading(true);
    setSummary(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
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

      const importSummary: ImportSummary = {
        total: 0,
        skippedNotesOnly: 0,
        updatedExisting: 0,
        created: 0,
        statusCounts: {},
      };

      // Parse all rows
      const parsedRows: Array<{
        pkgplace_id: string;
        delivery_status: "requested" | "ready" | "picked_up" | "warehouse" | "in_transit" | "delivered";
        auction_house: string | null;
        payment_status: "paid" | "unpaid";
        customer_name: string | null;
        address: string | null;
        address_line2: string | null;
        zip_code: string | null;
        zone: string | null;
        phone: string | null;
        email: string | null;
        delivery_instructions: string | null;
      }> = [];

      const notesOnlyUpdates: Array<{ pkgplace_id: string; delivery_instructions: string }> = [];

      for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
        const vals = parseCsvLine(lines[lineIdx]);
        const g = (idx: number) => (idx >= 0 ? vals[idx]?.trim() || null : null);

        const pkgId = vals[pkgIdx]?.trim();
        if (!pkgId) continue;

        importSummary.total++;

        const statusRaw = g(statusIdx) ?? "";
        const parsedStatus = parseDeliveryStatus(statusRaw);
        const customer = g(customerIdx);
        const address = g(addressIdx);
        const auctionHouse = g(auctionIdx);
        const instructions = g(instructionsIdx);

        // Check if this row is "notes only" — has an Order ID but no meaningful data fields
        const hasSubstantiveData = parsedStatus !== null || customer || address || auctionHouse;

        if (!hasSubstantiveData && instructions) {
          // This is a notes-only row — don't create a new order, just update existing
          notesOnlyUpdates.push({ pkgplace_id: pkgId, delivery_instructions: instructions });
          importSummary.skippedNotesOnly++;
          continue;
        }

        // Skip rows that have no status and no data at all
        if (!hasSubstantiveData && !instructions) continue;

        const finalStatus = parsedStatus || "requested";

        importSummary.statusCounts[finalStatus] = (importSummary.statusCounts[finalStatus] || 0) + 1;

        parsedRows.push({
          pkgplace_id: pkgId,
          delivery_status: finalStatus,
          auction_house: auctionHouse,
          payment_status: parsePaymentStatus(g(paymentIdx) ?? "unpaid"),
          customer_name: customer,
          address: address,
          address_line2: g(address2Idx),
          zip_code: g(zipIdx),
          zone: g(zoneIdx),
          phone: g(phoneIdx),
          email: g(emailIdx),
          delivery_instructions: instructions,
        });
      }

      // Clear existing orders if requested
      if (clearExisting) {
        const { error: clearError } = await supabase.from("orders").delete().neq("pkgplace_id", "___never_match___");
        if (clearError) throw clearError;
      }

      // Upsert orders in batches of 50
      for (let i = 0; i < parsedRows.length; i += 50) {
        const batch = parsedRows.slice(i, i + 50);
        const { error } = await supabase.from("orders").upsert(batch, { onConflict: "pkgplace_id" });
        if (error) throw error;
      }

      importSummary.created = parsedRows.length;

      // Apply notes-only updates to existing records
      for (const noteUpdate of notesOnlyUpdates) {
        await supabase
          .from("orders")
          .update({ delivery_instructions: noteUpdate.delivery_instructions })
          .eq("pkgplace_id", noteUpdate.pkgplace_id);
        importSummary.updatedExisting++;
      }

      toast({ title: "Import complete", description: `${parsedRows.length} orders imported, ${notesOnlyUpdates.length} notes updated.` });

      // Geocode orders that have addresses
      const idsToGeocode = parsedRows.filter((o) => o.address).map((o) => o.pkgplace_id);
      if (idsToGeocode.length > 0) {
        await geocodeOrders(idsToGeocode);
      }

      setSummary(importSummary);
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
        {geocoding && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 animate-pulse text-primary" />
              Converting addresses to map points...
            </div>
            <Progress value={geocodeProgress} className="h-2" />
          </div>
        )}

        {/* Import Summary Table */}
        {summary && (
          <div className="mb-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Import Validation Summary
            </h3>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {["requested", "ready", "picked_up", "warehouse", "in_transit", "delivered"].map((status) => {
                    const count = summary.statusCounts[status] || 0;
                    const labels: Record<string, string> = {
                      requested: "Requested",
                      ready: "Ready",
                      picked_up: "Picked Up",
                      warehouse: "Warehouse",
                      in_transit: "In Transit",
                      delivered: "Delivered",
                    };
                    return count > 0 || true ? (
                      <TableRow key={status}>
                        <TableCell className="text-sm">{labels[status]}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{count}</TableCell>
                      </TableRow>
                    ) : null;
                  })}
                  <TableRow className="font-semibold">
                    <TableCell>Total Imported</TableCell>
                    <TableCell className="text-right font-mono">{summary.created}</TableCell>
                  </TableRow>
                  {summary.skippedNotesOnly > 0 && (
                    <TableRow>
                      <TableCell className="text-sm text-muted-foreground">Notes-only rows (updated existing)</TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">{summary.skippedNotesOnly}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSummary(null)}>Dismiss</Button>
          </div>
        )}

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
          <div className="space-y-3">
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="clear-existing"
                checked={clearExisting}
                onCheckedChange={(checked) => setClearExisting(!!checked)}
              />
              <label htmlFor="clear-existing" className="text-sm text-muted-foreground cursor-pointer">
                Clear all existing orders before import
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
