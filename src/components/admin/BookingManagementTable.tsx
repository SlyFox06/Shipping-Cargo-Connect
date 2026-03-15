import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { Search, Download } from "lucide-react";

type Booking = {
  id: string;
  booking_number: string;
  status: string;
  price_usd: number;
  cargo_description: string;
  cargo_weight_kg: number;
  pickup_date: string | null;
  delivery_date: string | null;
  delivery_deadline: string | null;
  created_at: string;
  trader_profile?: {
    full_name: string | null;
    email: string;
  };
  container?: {
    origin: string;
    destination: string;
    container_type: string;
    departure_date: string | null;
  };
};

export const BookingManagementTable = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("bookings")
        .select("*, delivery_deadline")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch related data separately
      const bookingsWithDetails = await Promise.all(
        (data || []).map(async (booking) => {
          const { data: traderData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", booking.trader_id)
            .single();

          const { data: containerData } = await supabase
            .from("containers")
            .select("origin, destination, container_type, departure_date")
            .eq("id", booking.container_id)
            .single();

          return {
            ...booking,
            trader_profile: traderData || undefined,
            container: containerData || undefined,
          };
        })
      );

      setBookings(bookingsWithDetails);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();

    // Real-time subscription
    const channel = supabase
      .channel('booking-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusChange = async (bookingId: string, status: "pending" | "confirmed" | "completed" | "cancelled") => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", bookingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Booking status updated to ${status}`,
      });

      fetchBookings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ["Booking Number", "Trader", "Origin", "Destination", "Status", "Price (USD)", "Date"],
      ...filteredBookings.map((b) => [
        b.booking_number,
        b.trader_profile?.full_name || b.trader_profile?.email || "N/A",
        b.container?.origin || "N/A",
        b.container?.destination || "N/A",
        b.status,
        b.price_usd.toString(),
        new Date(b.created_at).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${new Date().toISOString()}.csv`;
    a.click();
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch =
      booking.booking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.trader_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.trader_profile?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || booking.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bookings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking #</TableHead>
              <TableHead>Trader</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Weight (kg)</TableHead>
              <TableHead>Price (USD)</TableHead>
              <TableHead>Delivery Deadline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center">
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              paginatedBookings.map((booking) => {
                const isOverdue = booking.delivery_deadline && 
                  new Date() > new Date(booking.delivery_deadline) && 
                  booking.status !== 'in_transit' && 
                  booking.status !== 'delivered';
                
                return (
                <TableRow key={booking.id}>
                  <TableCell className="font-mono text-sm">
                    {booking.booking_number}
                  </TableCell>
                  <TableCell>
                    {booking.trader_profile?.full_name || booking.trader_profile?.email || "N/A"}
                  </TableCell>
                  <TableCell>
                    {booking.container?.origin || "N/A"} → {booking.container?.destination || "N/A"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {booking.cargo_description}
                  </TableCell>
                  <TableCell>{booking.cargo_weight_kg.toLocaleString()}</TableCell>
                  <TableCell>${booking.price_usd.toLocaleString()}</TableCell>
                  <TableCell>
                    {booking.delivery_deadline ? (
                      <div className={isOverdue ? "text-red-600 font-semibold" : ""}>
                        {new Date(booking.delivery_deadline).toLocaleDateString()}
                        {isOverdue && " ⚠️"}
                      </div>
                    ) : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        booking.status === "confirmed"
                          ? "default"
                          : booking.status === "delivered"
                          ? "default"
                          : booking.status === "cancelled"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(booking.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={booking.status}
                      onValueChange={(value) => handleStatusChange(booking.id, value as "pending" | "confirmed" | "completed" | "cancelled")}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="in_transit">In Transit</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => setCurrentPage(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};
