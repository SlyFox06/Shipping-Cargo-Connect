import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hammer, Clock, TrendingUp, User } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AuctionCardProps {
  auction: {
    id: string;
    container_id: string;
    title: string;
    description: string;
    starting_price: number;
    current_bid: number;
    end_time: string;
    total_bids: number;
    bid_increment: number;
    status: string;
    containers: {
      origin: string;
      destination: string;
      container_type: string;
    };
    winner_id?: string | null;
  };
  onBidClick: (auctionId: string) => void;
  userId: string;
}

export const AuctionCard = ({ auction, onBidClick, userId }: AuctionCardProps) => {
  const navigate = useNavigate();
  const [currentAuction, setCurrentAuction] = useState(auction);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const updateTimer = async () => {
      const end = new Date(currentAuction.end_time);
      if (isPast(end)) {
        setTimeLeft("Ended");
        setIsFinished(true);
        
        // If the auction is still active but timer passed, trigger finalization
        if (currentAuction.status === 'active') {
          try {
            console.log("Auction time expired. Finalizing...");
            await supabase.functions.invoke('finalize-auction', {
              body: { auctionId: currentAuction.id }
            });
          } catch (err) {
            console.error("Failed to finalize expired auction:", err);
          }
        }
        return;
      }
      setTimeLeft(formatDistanceToNow(end, { addSuffix: true }));
    };

    updateTimer();
    const timer = setInterval(updateTimer, 60000);

    // Set up real-time subscription
    const channel = supabase
      .channel(`auction-updates-${currentAuction.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${currentAuction.id}`
        },
        (payload) => {
          console.log("Auction updated in real-time:", payload.new);
          setCurrentAuction(prev => ({
            ...prev,
            current_bid: payload.new.current_bid,
            total_bids: payload.new.total_bids,
            status: payload.new.status
          }));
          
          if (payload.new.status === 'completed') {
            setIsFinished(true);
            setTimeLeft("Completed");
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [currentAuction.id]);

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md border-primary/20 hover:border-primary/50 transition-all group">
      <div className="p-1 bg-gradient-to-r from-primary/50 via-secondary/50 to-primary/50 animate-shimmer" />
      
      <div className="p-5 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 animate-pulse">
                <Hammer className="h-3 w-3 mr-1" />
                Live Auction
              </Badge>
              <Badge variant="secondary" className="bg-secondary/10 text-secondary border-secondary/20">
                <Clock className="h-3 w-3 mr-1" />
                {timeLeft}
              </Badge>
            </div>
            <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
              {currentAuction.containers.origin} → {currentAuction.containers.destination}
            </h3>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
              {currentAuction.containers.container_type.replace(/_/g, ' ')}
            </p>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Current Bid</p>
            <p className="text-2xl font-black text-primary">${currentAuction.current_bid || currentAuction.starting_price}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 py-3 border-y border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-secondary/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Bids</p>
              <p className="font-semibold">{currentAuction.total_bids}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Min Increment</p>
              <p className="font-semibold">${currentAuction.bid_increment}</p>
            </div>
          </div>
        </div>

        {isFinished ? (
          <div className="pt-2">
            {currentAuction.winner_id === userId ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <p className="text-green-500 font-bold text-sm">🎉 You won this auction!</p>
                <Button 
                  size="sm" 
                  className="mt-2 w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => navigate('/dashboard/trader/bookings')}
                >
                  Pay Now to Confirm
                </Button>
              </div>
            ) : (
              <div className="bg-muted/30 border border-border/50 rounded-lg p-3 text-center">
                <p className="text-muted-foreground text-sm font-medium">Auction Completed</p>
                <p className="text-xs text-muted-foreground mt-1">Winner: {currentAuction.winner_id ? 'Anonymous' : 'No bids'}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-3 pt-2">
            <Button 
              className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 font-bold"
              onClick={() => onBidClick(currentAuction.id)}
              disabled={isFinished}
            >
              Place a Bid
            </Button>
            <Button variant="outline" className="px-3">
              Details
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
