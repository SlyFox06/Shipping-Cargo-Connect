import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TraderLayout from "@/components/layout/TraderLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Hammer, Search, Filter, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuctionCard } from "@/components/trader/AuctionCard";
import { AuctionModal } from "@/components/trader/AuctionModal";
import { Badge } from "@/components/ui/badge";

const TraderAuctions = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState("");
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [showAuctionModal, setShowAuctionModal] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setUserId(session.user.id);

      fetchAuctions();
    };

    checkAuth();
  }, [navigate]);

  const fetchAuctions = async () => {
    setLoading(true);
    // @ts-ignore
    const { data, error } = await supabase
      .from('auctions')
      .select('*, containers(*)')
      .eq('status', 'active')
      .order('end_time', { ascending: true });

    if (error) {
      console.error("Error fetching auctions:", error);
    } else {
      setAuctions(data || []);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    if (!searchQuery) {
      fetchAuctions();
      return;
    }
    const filtered = auctions.filter(a => 
      a.containers.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.containers.destination.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setAuctions(filtered);
  };

  return (
    <TraderLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Hammer className="h-8 w-8 text-primary" />
              Live Container Auctions
            </h1>
            <p className="text-muted-foreground mt-1">Bid on premium container space and get the best deals</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              <TrendingUp className="h-3 w-3 mr-1" />
              {auctions.length} Active Auctions
            </Badge>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <Card className="p-4 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by origin or destination..."
                className="pl-10 bg-background/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} className="bg-primary hover:opacity-90">
              Search
            </Button>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </Card>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-xl bg-muted/20 animate-pulse border border-border/50" />
            ))}
          </div>
        ) : auctions.length === 0 ? (
          <Card className="p-12 text-center bg-muted/10 border-dashed">
            <Hammer className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-xl font-semibold mb-2">No Active Auctions</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              There are currently no live auctions matching your criteria. Check back later or browse regular containers.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => navigate('/dashboard/trader/search')}>
              Browse All Containers
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        )}
      </div>

      <AuctionModal
        open={showAuctionModal}
        onClose={() => {
          setShowAuctionModal(false);
          fetchAuctions(); // Refresh after bid
        }}
        auctionId={selectedAuctionId}
        userId={userId}
      />
    </TraderLayout>
  );
};

export default TraderAuctions;
