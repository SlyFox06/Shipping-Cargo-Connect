import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TraderLayout from "@/components/layout/TraderLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Package, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { EnhancedBookingModal as BookingModal } from "@/components/trader/EnhancedBookingModal";
import { Badge } from "@/components/ui/badge";
import { AIPriceForecast } from "@/components/analytics/AIPriceForecast";
import { AuctionCard } from "@/components/trader/AuctionCard";
import { AuctionModal } from "@/components/trader/AuctionModal";
import { Hammer } from "lucide-react";

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
  const [auctions, setAuctions] = useState<any[]>([]);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [showAuctionModal, setShowAuctionModal] = useState(false);

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

      // Fetch available containers - filter by status and only those not yet expired
      const now = new Date().toISOString();
      const { data: containersData } = await supabase
        .from('containers')
        .select('*, providers(*)')
        .eq('status', 'available')
        .gte('available_until', now)
        .order('available_until', { ascending: true })
        .limit(12);

      // Priority sort logic: putting those expiring in < 7 days at the top
      const sortedContainers = (containersData || []).sort((a: any, b: any) => {
        const aExpiry = new Date(a.available_until).getTime();
        const bExpiry = new Date(b.available_until).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const nowTime = new Date().getTime();
        
        const aUrgent = (aExpiry - nowTime) < sevenDays;
        const bUrgent = (bExpiry - nowTime) < sevenDays;
        
        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;
        return aExpiry - bExpiry;
      });

      setContainers(sortedContainers);

      // Fetch active auctions
      // @ts-ignore - Tables generated after initial build may not show in types
      const { data: auctionsData } = await supabase
        .from('auctions')
        .select('*, containers(*)')
        .eq('status', 'active')
        .limit(4);

      setAuctions(auctionsData || []);
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

    const now = new Date().toISOString();
    query = query.gte('available_until', now);

    const { data } = await query;
    const sorted = (data || []).sort((a: any, b: any) => {
      const aExpiry = new Date(a.available_until).getTime();
      const bExpiry = new Date(b.available_until).getTime();
      return aExpiry - bExpiry;
    });
    setContainers(sorted);
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

        {/* Live Auctions Section */}
        {auctions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Hammer className="h-4 w-4 text-primary animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold">Live Container Auctions</h2>
              <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5 ml-2 animate-pulse">
                Hot Deals
              </Badge>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {auctions.map((auction) => (
                <AuctionCard 
                  key={auction.id} 
                  auction={auction} 
                  userId={userId}
                  onBidClick={(id) => {
                    setSelectedAuctionId(id);
                    setShowAuctionModal(true);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* AI Insights Section */}
        <div className="grid lg:grid-cols-2 gap-6">
          <AIPriceForecast origin="Mumbai" destination="Dubai" />
          <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 flex flex-col justify-center">
            <h3 className="text-xl font-bold mb-2">Market Sentiment</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Supply for the **Indo-Arabian** routes is currently high. Global port congestion index is stable at **4.2**.
            </p>
            <div className="flex gap-2">
              <Badge className="bg-success/20 text-success border-success/30">Stable Routes</Badge>
              <Badge className="bg-primary/20 text-primary border-primary/30">Competitive Pricing</Badge>
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
                      {new Date(container.available_until).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000 && (
                        <Badge variant="destructive" className="text-[10px] mt-1 animate-pulse">EXPIRING SOON</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    <p>Capacity: {container.capacity_kg} kg</p>
                    <p>Transport: {container.transport_mode.toUpperCase()}</p>
                    <p className="flex items-center gap-1 mt-1 text-xs">
                      <Clock className="h-3 w-3" />
                      Available until: {new Date(container.available_until).toLocaleDateString()}
                    </p>
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
      <AuctionModal
        open={showAuctionModal}
        onClose={() => setShowAuctionModal(false)}
        auctionId={selectedAuctionId}
        userId={userId}
      />
    </TraderLayout>
  );
};

export default TraderDashboard;
