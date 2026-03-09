import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, StickyNote, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  orders: Tables<"orders">[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onOrdersChanged?: () => void;
}

const statusColors: Record<string, string> = {
  requested: "bg-muted text-muted-foreground",
  ready: "bg-info/15 text-info",
  picked_up: "bg-pickup/15 text-pickup",
  warehouse: "bg-warning/15 text-warning",
  in_transit: "bg-primary/15 text-primary",
  delivered: "bg-success/15 text-success",
};

const statusLabels: Record<string, string> = {
  requested: "Requested",
  ready: "Ready",
  picked_up: "Picked Up",
  warehouse: "Warehouse",
  in_transit: "In Transit",
  delivered: "Delivered",
};

type SortField = "customer_name" | "auction_house" | "zone";
type SortDir = "asc" | "desc";

export default function OrdersTable({ orders, selectedIds, onSelectionChange, onOrdersChanged }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [notesOrder, setNotesOrder] = useState<Tables<"orders"> | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const zones = useMemo(() => {
    const z = new Set(orders.map((o) => o.zone).filter(Boolean) as string[]);
    return Array.from(z).sort();
  }, [orders]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 inline" />;
    return sortDir === "asc" ? <ArrowUp className="ml-1 h-3 w-3 inline" /> : <ArrowDown className="ml-1 h-3 w-3 inline" />;
  };

  const filtered = useMemo(() => {
    let result = orders.filter((o) => {
      const matchSearch = !search || [o.pkgplace_id, o.customer_name, o.address, o.auction_house]
        .filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || o.delivery_status === statusFilter;
      const matchPayment = paymentFilter === "all" || o.payment_status === paymentFilter;
      const matchZone = zoneFilter === "all" || o.zone === zoneFilter;
      return matchSearch && matchStatus && matchPayment && matchZone;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        const av = (a[sortField] || "").toLowerCase();
        const bv = (b[sortField] || "").toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }

    return result;
  }, [orders, search, statusFilter, paymentFilter, zoneFilter, sortField, sortDir]);

  const allSelected = filtered.length > 0 && filtered.every((o) => selectedIds.includes(o.pkgplace_id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !filtered.some((o) => o.pkgplace_id === id)));
    } else {
      const newIds = new Set([...selectedIds, ...filtered.map((o) => o.pkgplace_id)]);
      onSelectionChange([...newIds]);
    }
  };

  const toggleOne = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("orders").delete().in("pkgplace_id", selectedIds);
      if (error) throw error;
      toast({ title: "Deleted", description: `${selectedIds.length} orders removed.` });
      onSelectionChange([]);
      onOrdersChanged?.();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const openNotes = (order: Tables<"orders">) => {
    setNotesOrder(order);
    setNotesText(order.delivery_instructions || "");
  };

  const saveNotes = async () => {
    if (!notesOrder) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase.from("orders").update({ delivery_instructions: notesText || null }).eq("pkgplace_id", notesOrder.pkgplace_id);
      if (error) throw error;
      toast({ title: "Notes saved" });
      setNotesOrder(null);
      onOrdersChanged?.();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search orders..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="warehouse">Warehouse</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Zone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {zones.map((z) => (
              <SelectItem key={z} value={z}>{z}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedIds.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleting}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {deleting ? "Deleting..." : `Delete ${selectedIds.length}`}
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("customer_name")}>
                Customer <SortIcon field="customer_name" />
              </TableHead>
              <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort("auction_house")}>
                Auction House <SortIcon field="auction_house" />
              </TableHead>
              <TableHead className="hidden lg:table-cell">Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort("zone")}>
                Zone <SortIcon field="zone" />
              </TableHead>
              <TableHead className="w-10">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => (
                <TableRow
                  key={order.pkgplace_id}
                  data-state={selectedIds.includes(order.pkgplace_id) ? "selected" : undefined}
                  className={order.payment_status === "paid" ? "bg-success/5" : ""}
                >
                  <TableCell>
                    <Checkbox checked={selectedIds.includes(order.pkgplace_id)} onCheckedChange={() => toggleOne(order.pkgplace_id)} />
                  </TableCell>
                  <TableCell className="text-sm">{order.pkgplace_id}</TableCell>
                  <TableCell>{order.customer_name || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{order.auction_house || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{order.address || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[order.delivery_status]}>
                      {statusLabels[order.delivery_status] || order.delivery_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.payment_status === "unpaid" ? "destructive" : "secondary"}>
                      {order.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{order.zone || "—"}</TableCell>
                  <TableCell>
                    <button onClick={() => openNotes(order)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <StickyNote className={`h-4 w-4 ${order.delivery_instructions ? "text-warning" : ""}`} />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedIds.length > 0 ? `${selectedIds.length} selected · ` : ""}{filtered.length} orders
      </p>

      {/* Delivery Notes Modal */}
      <Dialog open={!!notesOrder} onOpenChange={() => setNotesOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delivery Notes — {notesOrder?.pkgplace_id}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Enter delivery instructions..."
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesOrder(null)}>Cancel</Button>
            <Button onClick={saveNotes} disabled={savingNotes}>
              {savingNotes ? "Saving..." : "Save Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
