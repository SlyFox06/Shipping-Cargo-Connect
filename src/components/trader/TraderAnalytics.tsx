import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { TrendingUp, Package, DollarSign, BarChart3 } from "lucide-react";
import { SavedChartsList } from "@/components/analytics/SavedChartsList";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

interface TraderAnalyticsProps {
  userId: string;
}

export const TraderAnalytics = ({ userId }: TraderAnalyticsProps) => {
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalSpent: 0,
    activeBookings: 0,
    completedBookings: 0
  });
  const [monthlySpending, setMonthlySpending] = useState<any[]>([]);
  const [spendingByRoute, setSpendingByRoute] = useState<any[]>([]);
  const [cargoTypes, setCargoTypes] = useState<any[]>([]);
  const [bookingStatus, setBookingStatus] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();

    // Real-time subscription
    const channel = supabase
      .channel(`trader-analytics-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `trader_id=eq.${userId}` }, () => fetchAnalytics())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchAnalytics = async () => {
    try {
      // Get trader's bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select("*, containers(*)")
        .eq("trader_id", userId);

      if (!bookings) return;

      // Calculate stats
      const totalSpent = bookings.reduce((sum, b) => sum + Number(b.price_usd), 0);
      const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'in_transit').length;
      const completedBookings = bookings.filter(b => b.status === 'delivered').length;

      setStats({
        totalBookings: bookings.length,
        totalSpent: Math.round(totalSpent),
        activeBookings,
        completedBookings
      });

      // Monthly spending (last 6 months)
      const now = new Date();
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        
        const count = bookings.filter(b => {
          const date = new Date(b.created_at);
          return date >= month && date < nextMonth;
        }).length;

        const spending = bookings
          .filter(b => {
            const date = new Date(b.created_at);
            return date >= month && date < nextMonth;
          })
          .reduce((sum, b) => sum + Number(b.price_usd), 0);

        monthlyData.push({
          month: month.toLocaleDateString('en-US', { month: 'short' }),
          bookings: count,
          spending
        });
      }
      setMonthlySpending(monthlyData);

      // Spending by route
      const routeSpending = bookings.reduce((acc: any, booking) => {
        if (!booking.containers) return acc;
        const route = `${booking.containers.origin} → ${booking.containers.destination}`;
        
        if (!acc[route]) {
          acc[route] = { route, spending: 0 };
        }
        acc[route].spending += Number(booking.price_usd);
        return acc;
      }, {});

      setSpendingByRoute(
        Object.values(routeSpending)
          .sort((a: any, b: any) => b.spending - a.spending)
          .slice(0, 5)
      );

      // Cargo type distribution
      const cargoData = bookings.reduce((acc: any, booking) => {
        const cargo = booking.cargo_description || "Unknown";
        const type = cargo.split(' ')[0];
        if (!acc[type]) {
          acc[type] = { name: type, value: 0 };
        }
        acc[type].value += 1;
        return acc;
      }, {});
      setCargoTypes(Object.values(cargoData).slice(0, 6));

      // Booking status distribution
      const statusData = [
        { status: 'Pending', count: bookings.filter(b => b.status === 'pending').length },
        { status: 'Confirmed', count: bookings.filter(b => b.status === 'confirmed').length },
        { status: 'In Transit', count: bookings.filter(b => b.status === 'in_transit').length },
        { status: 'Delivered', count: bookings.filter(b => b.status === 'delivered').length },
        { status: 'Cancelled', count: bookings.filter(b => b.status === 'cancelled').length }
      ].filter(s => s.count > 0);

      setBookingStatus(statusData);

    } catch (error: any) {
      console.error('Analytics error:', error);
      toast.error('Failed to load analytics');
    }
  };

  return (
    <div className="space-y-6">
      {/* Saved Charts Section */}
      <SavedChartsList userId={userId} userRole="trader" />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{stats.totalBookings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold">${stats.totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Bookings</p>
              <p className="text-2xl font-bold">{stats.activeBookings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <BarChart3 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{stats.completedBookings}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>📈 Monthly Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlySpending}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-muted-foreground" />
                <YAxis yAxisId="left" className="text-muted-foreground" />
                <YAxis yAxisId="right" orientation="right" className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="hsl(var(--primary))" strokeWidth={2} name="Bookings" />
                <Line yAxisId="right" type="monotone" dataKey="spending" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Spending ($)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💰 Spending by Route</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={spendingByRoute}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="route" angle={-45} textAnchor="end" height={100} className="text-xs" />
                <YAxis className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="spending" fill="hsl(var(--chart-1))" name="Spending ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📦 Cargo Types</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={cargoTypes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {cargoTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📊 Booking Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bookingStatus}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="status" className="text-muted-foreground" />
                <YAxis className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
