import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProviderLayout from "@/components/layout/ProviderLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Download, DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Payment = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  booking?: {
    booking_number: string;
    trader_profile?: {
      full_name: string | null;
      email: string;
    };
  };
};

const Revenue = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingPayments: 0,
    completedPayments: 0,
    monthlyRevenue: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [hasPaymentDetails, setHasPaymentDetails] = useState(false);

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
      await fetchRevenue(session.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    // Real-time subscription for payments
    const channel = supabase
      .channel('payment-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetchRevenue(session.user.id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRevenue = async (userId: string) => {
    try {
      setLoading(true);

      // Get provider ID and payment details
      const { data: providerData } = await supabase
        .from('providers')
        .select('id, bank_account_number, upi_id, paypal_email')
        .eq('user_id', userId)
        .single();

      if (!providerData) return;

      // Check if payment details are set
      const hasDetails = !!(
        providerData.bank_account_number || 
        providerData.upi_id || 
        providerData.paypal_email
      );
      setHasPaymentDetails(hasDetails);

      // Get all bookings for this provider
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('provider_id', providerData.id);

      if (!bookings || bookings.length === 0) {
        setLoading(false);
        return;
      }

      const bookingIds = bookings.map(b => b.id);

      // Get payments for these bookings
      const { data: paymentsData, error } = await supabase
        .from('payments')
        .select('*')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch booking and trader details separately
      const paymentsWithDetails = await Promise.all(
        (paymentsData || []).map(async (payment) => {
          const { data: bookingData } = await supabase
            .from('bookings')
            .select('booking_number, trader_id')
            .eq('id', payment.booking_id)
            .single();

          if (bookingData) {
            const { data: traderData } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', bookingData.trader_id)
              .single();

            return {
              ...payment,
              booking: {
                booking_number: bookingData.booking_number,
                trader_profile: traderData || undefined,
              },
            };
          }

          return payment;
        })
      );

      setPayments(paymentsWithDetails);

      // Calculate stats
      const total = paymentsWithDetails
        .filter(p => p.status === 'succeeded')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      
      const pending = paymentsWithDetails
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const completed = paymentsWithDetails.filter(p => p.status === 'succeeded').length;

      // Calculate monthly revenue for current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyTotal = paymentsWithDetails
        .filter(p => p.status === 'succeeded' && new Date(p.created_at) >= monthStart)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      setStats({
        totalRevenue: total,
        pendingPayments: pending,
        completedPayments: completed,
        monthlyRevenue: monthlyTotal,
      });

      // Generate monthly chart data (last 6 months)
      const chartData = [];
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        
        const monthRevenue = paymentsWithDetails
          .filter(p => {
            const date = new Date(p.created_at);
            return p.status === 'succeeded' && date >= month && date < nextMonth;
          })
          .reduce((sum, p) => sum + Number(p.amount), 0);

        chartData.push({
          month: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          revenue: monthRevenue,
        });
      }
      setMonthlyData(chartData);

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

  const handleExportCSV = () => {
    const csv = [
      ["Date", "Booking #", "Trader", "Amount (USD)", "Status"],
      ...payments.map((p) => [
        new Date(p.created_at).toLocaleDateString(),
        p.booking?.booking_number || "N/A",
        p.booking?.trader_profile?.full_name || p.booking?.trader_profile?.email || "N/A",
        p.amount.toString(),
        p.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-report-${new Date().toISOString()}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <ProviderLayout>
        <div className="flex items-center justify-center h-full">
          <p>Loading revenue data...</p>
        </div>
      </ProviderLayout>
    );
  }

  return (
    <ProviderLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Revenue & Earnings</h1>
            <p className="text-muted-foreground mt-1">Track your earnings and payment history</p>
          </div>
          <Button onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Payment Status Alert */}
        {hasPaymentDetails ? (
          <Alert className="bg-green-500/10 border-green-500/20">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-500">
              ✓ Your payout account is set up and ready to receive payments.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-yellow-500/10 border-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-500">
              Please add your payout account details in{" "}
              <Link to="/dashboard/provider/settings" className="underline font-medium">
                Settings
              </Link>{" "}
              to receive payments.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">${stats.monthlyRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">${stats.pendingPayments.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completedPayments}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue by Month</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Recent Payments */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Payments</h3>
          <div className="space-y-4">
            {payments.slice(0, 10).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{payment.booking?.booking_number || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">
                    {payment.booking?.trader_profile?.full_name || payment.booking?.trader_profile?.email || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">${Number(payment.amount).toLocaleString()}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    payment.status === 'succeeded' 
                      ? 'bg-green-500/10 text-green-500' 
                      : 'bg-yellow-500/10 text-yellow-500'
                  }`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
            {payments.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No payments yet. Payments will appear here once bookings are completed.
              </p>
            )}
          </div>
        </Card>
      </div>
    </ProviderLayout>
  );
};

export default Revenue;
