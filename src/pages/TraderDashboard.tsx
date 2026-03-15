import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TraderLayout from "@/components/layout/TraderLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Package, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { BookingModal } from "@/components/trader/BookingModal";

const TraderDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [containers, setContainers] = useState<any[]>([]);
  const [searchOrigin, setSearchOrigin] = useState("");
  const [searchDestination, setSearchDestination] = useState("");
  const [stats, setStats] = useState({
    activeBookings: 0,
    pendingBookings: 0,
    completedBookings: 0,
  });
  const [userId, setUserId] = useState("");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<any>(null);

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

      setUserId(session.user.id);

      // Fetch trader stats
      const { count: activeCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('trader_id', session.user.id)
        .eq('status', 'confirmed');

      const { count: pendingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('trader_id', session.user.id)
        .eq('status', 'pending');

      const { count: completedCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('trader_id', session.user.id)
        .eq('status', 'completed');

      setStats({
        activeBookings: activeCount || 0,
        pendingBookings: pendingCount || 0,
        completedBookings: completedCount || 0,
      });

      // Fetch available containers
      const { data: containersData } = await supabase
        .from('containers')
        .select('*, providers(*)')
        .eq('status', 'available')
        .limit(10);

      setContainers(containersData || []);
      setLoading(false);

      // Set up real-time subscription for bookings
      const bookingChannel = supabase
        .channel('trader-bookings-dash')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            filter: `trader_id=eq.${session.user.id}`
          },
          () => {
            checkAuth(); // Refresh stats when bookings change
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(bookingChannel);
      };
    };

    checkAuth();
  }, [navigate]);

  const handleBookContainer = (container: any) => {
    setSelectedContainer(container);
    setShowBookingModal(true);
  };

  const handleSearch = async () => {
    let query = supabase
      .from('containers')
      .select('*, providers(*)')
      .eq('status', 'available');

    if (searchOrigin) {
      query = query.ilike('origin', `%${searchOrigin}%`);
    }

    if (searchDestination) {
      query = query.ilike('destination', `%${searchDestination}%`);
    }

    const { data } = await query;
    setContainers(data || []);
  };

  if (loading) {
    return null;
  }

  return (
    <TraderLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Trader Dashboard</h1>
          <p className="text-muted-foreground mt-1">Search and book container space</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Package className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Bookings</p>
                <p className="text-3xl font-bold">{stats.activeBookings}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold">{stats.pendingBookings}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold">{stats.completedBookings}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search Section */}
        <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Quick Search</h2>
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard/trader/search')}
              className="gap-2"
            >
              Advanced Search
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-4">
            <Input
              placeholder="Origin (e.g., Mumbai)"
              value={searchOrigin}
              onChange={(e) => setSearchOrigin(e.target.value)}
              className="bg-background/50"
            />
            <Input
              placeholder="Destination (e.g., Dubai)"
              value={searchDestination}
              onChange={(e) => setSearchDestination(e.target.value)}
              className="bg-background/50"
            />
            <Button
              onClick={handleSearch}
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 gap-2 px-8"
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </Card>

        {/* Available Containers Preview */}
        <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Available Containers</h2>
            <Button variant="link" onClick={() => navigate('/dashboard/trader/search')}>
              View All
            </Button>
          </div>
          
          {containers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No containers found</p>
              <p className="text-xs">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {containers.slice(0, 4).map((container) => (
                <Card key={container.id} className="p-4 bg-background/30 border-border/30 hover:border-primary/50 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">
                        {container.origin} → {container.destination}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {container.container_type.replace(/_/g, ' ').toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary">${container.price_usd}</p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    <p>Capacity: {container.capacity_kg} kg</p>
                    <p>Transport: {container.transport_mode.toUpperCase()}</p>
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                    onClick={() => handleBookContainer(container)}
                  >
                    Book Now
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Booking Modal */}
      <BookingModal
        open={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          setSelectedContainer(null);
        }}
        onSuccess={() => {
          // Refresh data after successful booking
          const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const { count: activeCount } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('trader_id', session.user.id)
                .eq('status', 'confirmed');

              const { count: pendingCount } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('trader_id', session.user.id)
                .eq('status', 'pending');

              const { count: completedCount } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('trader_id', session.user.id)
                .eq('status', 'completed');

              setStats({
                activeBookings: activeCount || 0,
                pendingBookings: pendingCount || 0,
                completedBookings: completedCount || 0,
              });
            }
          };
          checkAuth();
        }}
        container={selectedContainer}
        traderId={userId}
      />
    </TraderLayout>
  );
};

export default TraderDashboard;
