import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProviderLayout from "@/components/layout/ProviderLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalContainers: 0,
    activeBookings: 0,
    totalRevenue: 0,
    pendingRequests: 0,
  });
  const [isVerified, setIsVerified] = useState(false);
  const [containers, setContainers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

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

      // Fetch provider stats
      const { data: provider } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (provider) {
        setIsVerified(provider.verified || false);
        fetchData(provider.id);

        // Set up real-time subscriptions
        const containerChannel = supabase
          .channel('provider-containers')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'containers',
              filter: `provider_id=eq.${provider.id}`
            },
            () => fetchData(provider.id)
          )
          .subscribe();

        const bookingChannel = supabase
          .channel('provider-bookings-dash')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'bookings',
              filter: `provider_id=eq.${provider.id}`
            },
            () => fetchData(provider.id)
          )
          .subscribe();

        const verificationChannel = supabase
          .channel('provider-verification')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'providers',
              filter: `user_id=eq.${session.user.id}`
            },
            (payload) => {
              setIsVerified(payload.new.verified || false);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(containerChannel);
          supabase.removeChannel(bookingChannel);
          supabase.removeChannel(verificationChannel);
        };
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const fetchData = async (providerId: string) => {
    try {
      // Fetch containers
      const { data: containersData } = await supabase
        .from('containers')
        .select('*')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
        .limit(5);

      setContainers(containersData || []);

      // Fetch recent bookings
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, containers(*), profiles!bookings_trader_id_fkey(*)')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
        .limit(5);

      setBookings(bookingsData || []);

      // Fetch stats
      const { count: containerCount } = await supabase
        .from('containers')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId);

      const { count: bookingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId)
        .eq('status', 'confirmed');

      const { count: pendingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId)
        .eq('status', 'pending');

      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'succeeded')
        .in('booking_id', 
          (await supabase
            .from('bookings')
            .select('id')
            .eq('provider_id', providerId)).data?.map(b => b.id) || []
        );

      const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setStats({
        totalContainers: containerCount || 0,
        activeBookings: bookingCount || 0,
        totalRevenue,
        pendingRequests: pendingCount || 0,
      });
    } catch (error) {
      console.error('Error fetching provider data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <ProviderLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Provider Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your containers and bookings</p>
        </div>

        {/* Verification Status */}
        {!isVerified && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-600 dark:text-amber-400">
              Your provider account is pending admin approval. You can view pages but cannot add containers until approved.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-6 bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
                <Package className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Containers</p>
                <p className="text-3xl font-bold text-foreground">{stats.totalContainers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Bookings</p>
                <p className="text-3xl font-bold text-foreground">{stats.activeBookings}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold text-foreground">${stats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-3xl font-bold text-foreground">{stats.pendingRequests}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Recent Containers</h2>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                disabled={!isVerified}
                onClick={() => navigate('/dashboard/provider/containers')}
              >
                <Plus className="h-4 w-4" />
                {containers.length > 0 ? 'View All' : 'Add Container'}
              </Button>
            </div>

            {containers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No containers added yet</p>
                <p className="text-xs">{!isVerified ? 'Wait for admin approval to add containers' : 'Add your first container to start receiving bookings'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {containers.map((container) => (
                  <div key={container.id} className="p-3 bg-muted/20 rounded-lg border border-border">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {container.origin_city}, {container.origin_country} → {container.destination_city}, {container.destination_country}
                        </p>
                        <p className="text-xs text-muted-foreground">{container.container_type}</p>
                      </div>
                      <p className="text-sm font-semibold text-primary">${container.price_usd}</p>
                    </div>
                  </div>
                ))}
                {containers.length >= 5 && (
                  <Button 
                    variant="link" 
                    className="w-full"
                    onClick={() => navigate('/dashboard/provider/containers')}
                  >
                    View All Containers
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6 bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Recent Bookings</h2>
              {bookings.length > 0 && (
                <Button 
                  variant="link"
                  onClick={() => navigate('/dashboard/provider/bookings')}
                >
                  View All
                </Button>
              )}
            </div>
            {bookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No bookings yet</p>
                <p className="text-xs">Bookings will appear here once traders book your containers</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div key={booking.id} className="p-3 bg-muted/20 rounded-lg border border-border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm text-foreground">{booking.booking_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.profiles?.full_name || booking.profiles?.email}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded border ${
                        booking.status === 'pending' ? 'bg-warning/20 text-warning border-warning/30' :
                        booking.status === 'confirmed' ? 'bg-success/20 text-success border-success/30' :
                        'bg-primary/20 text-primary border-primary/30'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {booking.containers?.origin_city} → {booking.containers?.destination_city}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </ProviderLayout>
  );
};

export default ProviderDashboard;
