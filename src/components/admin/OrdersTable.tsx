import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  orders: Tables<"orders">[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

const statusColors: Record<string, string> = {
  requested: "bg-muted text-muted-foreground",
  ready: "bg-info/15 text-info",
  in_warehouse: "bg-warning/15 text-warning",
  out_for_delivery: "bg-pickup/15 text-pickup",
  delivered: "bg-success/15 text-success",
};

const statusLabels: Record<string, string> = {
  requested: "Requested",
  ready: "Ready",
  in_warehouse: "In Warehouse",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

export default function OrdersTable({ orders, selectedIds, onSelectionChange }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  const filtered = orders.filter((o) => {
    const matchSearch = !search || [o.pkgplace_id, o.customer_name, o.address, o.auction_house]
      .filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.delivery_status === statusFilter;
    const matchPayment = paymentFilter === "all" || o.payment_status === paymentFilter;
    return matchSearch && matchStatus && matchPayment;
  });

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
            <SelectItem value="in_warehouse">In Warehouse</SelectItem>
            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
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
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Auction House</TableHead>
              <TableHead className="hidden lg:table-cell">Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="hidden lg:table-cell">Zone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => (
                <TableRow key={order.pkgplace_id} data-state={selectedIds.includes(order.pkgplace_id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox checked={selectedIds.includes(order.pkgplace_id)} onCheckedChange={() => toggleOne(order.pkgplace_id)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{order.pkgplace_id}</TableCell>
                  <TableCell>{order.customer_name || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{order.auction_house || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{order.address || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[order.delivery_status]}>
                      {statusLabels[order.delivery_status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.payment_status === "unpaid" ? "destructive" : "secondary"}>
                      {order.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{order.zone || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedIds.length > 0 ? `${selectedIds.length} selected · ` : ""}{filtered.length} orders
      </p>
    </div>
  );
}
