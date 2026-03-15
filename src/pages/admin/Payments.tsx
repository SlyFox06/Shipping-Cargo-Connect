import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card } from "@/components/ui/card";
import { CreditCard, CheckCircle2, XCircle, Clock, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Payments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<any[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState({ total: 0, succeeded: 0, failed: 0, pending: 0 });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (role !== 'admin') {
        navigate('/dashboard');
        return;
      }
      fetchPayments();

      // Set up realtime subscription
      const channel = supabase
        .channel('admin-payments')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payments',
          },
          fetchPayments
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    filterPayments();
  }, [payments, searchTerm, statusFilter]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          bookings(
            booking_number,
            containers(
              container_type,
              origin,
              destination
            ),
            profiles!bookings_trader_id_fkey(
              full_name,
              email
            ),
            providers(
              id,
              profiles:user_id(
                full_name
              )
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const paymentsData = data || [];
      setPayments(paymentsData);
      
      // Calculate stats
      const total = paymentsData.reduce((sum, p) => sum + (p.status === "succeeded" ? Number(p.amount) : 0), 0);
      const succeeded = paymentsData.filter(p => p.status === "succeeded").length;
      const failed = paymentsData.filter(p => p.status === "failed").length;
      const pending = paymentsData.filter(p => p.status === "pending" || p.status === "processing").length;
      
      setStats({ total, succeeded, failed, pending });
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  const filterPayments = () => {
    let filtered = payments;

    if (statusFilter !== "all") {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.bookings?.booking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.bookings?.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.bookings?.providers?.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredPayments(filtered);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "pending":
      case "processing":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <CreditCard className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: any = {
      succeeded: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
      processing: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
      refunded: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200"
    };
    return <Badge className={colors[status] || ""}>{status}</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Payments & Transactions</h1>
          <p className="text-muted-foreground mt-1">Monitor platform payments and transactions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${stats.total.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Succeeded</p>
                <p className="text-2xl font-bold">{stats.succeeded}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">{stats.failed}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search by booking, trader, or provider..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="succeeded">Succeeded</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {loading ? (
          <Card className="p-12 text-center">
            <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-50 animate-pulse" />
            <p className="text-muted-foreground">Loading payments...</p>
          </Card>
        ) : filteredPayments.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No Payments Found</p>
            <p className="text-sm mt-2 text-muted-foreground">
              {searchTerm || statusFilter !== "all" ? "Try adjusting your filters" : "Payment transactions will appear here"}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredPayments.map((payment) => (
              <Card key={payment.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(payment.status)}
                    <div>
                      <h3 className="font-semibold text-lg">
                        {payment.bookings?.booking_number || "N/A"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(payment.created_at), "MMM dd, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(payment.status)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Trader</p>
                    <p className="font-medium">
                      {payment.bookings?.profiles?.full_name || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.bookings?.profiles?.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Provider</p>
                    <p className="font-medium">
                      {payment.bookings?.providers?.profiles?.full_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Container & Route</p>
                    <p className="font-medium">
                      {payment.bookings?.containers?.container_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.bookings?.containers?.origin} → {payment.bookings?.containers?.destination}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-medium text-primary text-lg">
                      ${payment.amount.toLocaleString()} {payment.currency}
                    </p>
                    {payment.payment_method && (
                      <p className="text-xs text-muted-foreground mt-1">
                        via {payment.payment_method}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Payments;