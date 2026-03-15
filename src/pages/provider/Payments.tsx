import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProviderLayout from "@/components/layout/ProviderLayout";
import { Card } from "@/components/ui/card";
import { DollarSign, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const Payments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, count: 0 });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (role !== 'provider') {
        navigate('/dashboard');
        return;
      }

      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

      if (provider) {
        fetchPayments(provider.id);

        // Set up realtime subscription
        const channel = supabase
          .channel('provider-payments')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'payments',
            },
            () => fetchPayments(provider.id)
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };
    checkAuth();
  }, [navigate]);

  const fetchPayments = async (providerId: string) => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          bookings!inner(
            booking_number,
            provider_id,
            trader_id,
            containers(
              container_type,
              origin,
              destination
            ),
            profiles!bookings_trader_id_fkey(
              full_name,
              email
            )
          )
        `)
        .eq("bookings.provider_id", providerId)
        .eq("status", "succeeded")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const paymentsData = data || [];
      setPayments(paymentsData);
      
      // Calculate stats
      const total = paymentsData.reduce((sum, p) => sum + Number(p.amount), 0);
      setStats({ total, count: paymentsData.length });
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProviderLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Payments Received</h1>
          <p className="text-muted-foreground mt-1">Track payments from completed bookings</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold">${stats.total.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completed Payments</p>
                <p className="text-2xl font-bold">{stats.count}</p>
              </div>
            </div>
          </Card>
        </div>

        {loading ? (
          <Card className="p-12 text-center">
            <DollarSign className="h-16 w-16 mx-auto mb-4 opacity-50 animate-pulse" />
            <p className="text-muted-foreground">Loading payments...</p>
          </Card>
        ) : payments.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <DollarSign className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No Payments Yet</p>
            <p className="text-sm mt-2 text-muted-foreground">Payments from traders will appear here</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {payments.map((payment) => (
              <Card key={payment.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-1" />
                    <div>
                      <h3 className="font-semibold text-lg">
                        {payment.bookings?.booking_number || "N/A"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Received {format(new Date(payment.created_at), "MMM dd, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                    Paid
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Trader</p>
                    <p className="font-medium">
                      {payment.bookings?.profiles?.full_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Container & Route</p>
                    <p className="font-medium">
                      {payment.bookings?.containers?.container_type}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {payment.bookings?.containers?.origin} → {payment.bookings?.containers?.destination}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Received</p>
                    <p className="font-medium text-primary text-lg">
                      ${payment.amount.toLocaleString()} {payment.currency}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProviderLayout>
  );
};

export default Payments;