import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TraderLayout from "@/components/layout/TraderLayout";
import { Card } from "@/components/ui/card";
import { CreditCard, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const Payments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (role !== 'trader') {
        navigate('/dashboard');
        return;
      }
      fetchPayments(session.user.id);

      // Set up realtime subscription
      const channel = supabase
        .channel('trader-payments')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payments',
          },
          () => fetchPayments(session.user.id)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };
    checkAuth();
  }, [navigate]);

  const fetchPayments = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          bookings!inner(
            booking_number,
            trader_id,
            containers(
              container_type,
              origin,
              destination
            )
          )
        `)
        .eq("bookings.trader_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
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
    <TraderLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Payments</h1>
          <p className="text-muted-foreground mt-1">View payment history and invoices</p>
        </div>

        {loading ? (
          <Card className="p-12 text-center">
            <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-50 animate-pulse" />
            <p className="text-muted-foreground">Loading payments...</p>
          </Card>
        ) : payments.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No Payments Yet</p>
            <p className="text-sm mt-2 text-muted-foreground">Your payment history will appear here</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {payments.map((payment) => (
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Container Type</p>
                    <p className="font-medium">
                      {payment.bookings?.containers?.container_type || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Route</p>
                    <p className="font-medium">
                      {payment.bookings?.containers?.origin} → {payment.bookings?.containers?.destination}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Paid</p>
                    <p className="font-medium text-primary text-lg">
                      ${payment.amount.toLocaleString()} {payment.currency}
                    </p>
                  </div>
                </div>

                {payment.payment_method && (
                  <div className="text-sm text-muted-foreground border-t pt-3">
                    Payment Method: {payment.payment_method}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </TraderLayout>
  );
};

export default Payments;