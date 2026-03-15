import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { TrendingUp, Package, DollarSign, BarChart3 } from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export const AnalyticsCharts = () => {
  const [stats, setStats] = useState({
    avgUtilization: 0,
    sharedBookings: 0,
    revenuePerContainer: 0,
    totalBookings: 0
  });
  const [monthlyBookings, setMonthlyBookings] = useState<any[]>([]);
  const [revenueByRoute, setRevenueByRoute] = useState<any[]>([]);
  const [cargoTypes, setCargoTypes] = useState<any[]>([]);
  const [utilizationData, setUtilizationData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalyticsData();

    // Real-time subscription
    const channel = supabase
      .channel('analytics-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchAnalyticsData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, () => fetchAnalyticsData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      // Get all bookings with container details
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("*, containers(origin, destination, utilization_rate, total_volume_m3)")
        .neq("status", "cancelled");

      if (!bookingsData) return;

      // Calculate stats
      const totalBookings = bookingsData.length;
      const sharedBookings = await supabase
        .from("bookings")
        .select("container_id")
        .neq("status", "cancelled")
        .then(({ data }) => {
          if (!data) return 0;
          const grouped = data.reduce((acc: any, b) => {
            acc[b.container_id] = (acc[b.container_id] || 0) + 1;
            return acc;
          }, {});
          return Object.values(grouped).filter((count: any) => count > 1).length;
        });

      // Average utilization
      const { data: allContainers } = await supabase
        .from("containers")
        .select("utilization_rate");
      const avgUtil = allContainers && allContainers.length > 0
        ? allContainers.reduce((sum, c) => sum + (Number(c.utilization_rate) || 0), 0) / allContainers.length
        : 0;

      // Revenue per container
      const totalRevenue = bookingsData.reduce((sum, b) => sum + Number(b.price_usd), 0);
      const uniqueContainers = new Set(bookingsData.map(b => b.container_id)).size;
      const revenuePerContainer = uniqueContainers > 0 ? totalRevenue / uniqueContainers : 0;

      setStats({
        avgUtilization: Math.round(avgUtil),
        sharedBookings,
        revenuePerContainer: Math.round(revenuePerContainer),
        totalBookings
      });

      // Monthly booking volume (last 6 months)
      const now = new Date();
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        
        const count = bookingsData.filter(b => {
          const date = new Date(b.created_at);
          return date >= month && date < nextMonth;
        }).length;

        monthlyData.push({
          month: month.toLocaleDateString('en-US', { month: 'short' }),
          bookings: count
        });
      }
      setMonthlyBookings(monthlyData);

      // Revenue by route
      const routeRevenue = bookingsData.reduce((acc: any, booking) => {
        if (booking.containers) {
          const route = `${booking.containers.origin} → ${booking.containers.destination}`;
          if (!acc[route]) {
            acc[route] = { route, revenue: 0 };
          }
          acc[route].revenue += Number(booking.price_usd);
        }
        return acc;
      }, {});
      setRevenueByRoute(
        Object.values(routeRevenue)
          .sort((a: any, b: any) => b.revenue - a.revenue)
          .slice(0, 5)
      );

      // Cargo type distribution
      const cargoData = bookingsData.reduce((acc: any, booking) => {
        const cargo = booking.cargo_description || "Unknown";
        const type = cargo.split(' ')[0]; // Get first word as category
        if (!acc[type]) {
          acc[type] = { name: type, value: 0 };
        }
        acc[type].value += 1;
        return acc;
      }, {});
      setCargoTypes(Object.values(cargoData).slice(0, 6));

      // Container utilization distribution
      const utilizationRanges = [
        { range: '0-20%', count: 0 },
        { range: '21-40%', count: 0 },
        { range: '41-60%', count: 0 },
        { range: '61-80%', count: 0 },
        { range: '81-100%', count: 0 }
      ];

      allContainers?.forEach(c => {
        const util = Number(c.utilization_rate) || 0;
        if (util <= 20) utilizationRanges[0].count++;
        else if (util <= 40) utilizationRanges[1].count++;
        else if (util <= 60) utilizationRanges[2].count++;
        else if (util <= 80) utilizationRanges[3].count++;
        else utilizationRanges[4].count++;
      });

      setUtilizationData(utilizationRanges);

    } catch (error: any) {
      console.error('Analytics error:', error);
      toast.error('Failed to load analytics data');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Utilization</p>
              <p className="text-2xl font-bold">{stats.avgUtilization}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Package className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Shared Bookings</p>
              <p className="text-2xl font-bold">{stats.sharedBookings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue/Container</p>
              <p className="text-2xl font-bold">${stats.revenuePerContainer.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{stats.totalBookings}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>📈 Monthly Booking Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyBookings}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-muted-foreground" />
                <YAxis className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Line type="monotone" dataKey="bookings" stroke="hsl(var(--primary))" strokeWidth={2} name="Bookings" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💰 Most Profitable Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueByRoute}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="route" angle={-45} textAnchor="end" height={100} className="text-xs" />
                <YAxis className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Revenue ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📦 Cargo Type Distribution</CardTitle>
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
            <CardTitle>📊 Container Utilization Range</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="range" className="text-muted-foreground" />
                <YAxis className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" name="Containers" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
