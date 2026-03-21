import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hammer, TrendingUp, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AuctionModalProps {
  open: boolean;
  onClose: () => void;
  auctionId: string | null;
  userId: string;
}

export const AuctionModal = ({ open, onClose, auctionId, userId }: AuctionModalProps) => {
  const [bidValue, setBidValue] = useState<string>("");
  const [isAutoBid, setIsAutoBid] = useState(false);
  const [maxAutoBid, setMaxAutoBid] = useState<string>("");
  const queryClient = useQueryClient();

  // Fetch current auction status
  const { data: auction, isLoading } = useQuery({
    queryKey: ['auction', auctionId],
    queryFn: async () => {
      if (!auctionId) return null;
      const { data, error } = await supabase
        .from('auctions')
        .select('*, containers(*)')
        .eq('id', auctionId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!auctionId && open
  });

  const placeBid = useMutation({
    mutationFn: async (amount: number) => {
      // 1. Check if bid is still highest
      const { data: currentAuction } = await supabase
        .from('auctions')
        .select('current_bid, bid_increment')
        .eq('id', auctionId)
        .single();

      if (amount <= (currentAuction?.current_bid || 0)) {
        throw new Error("Someone already placed a higher bid! Try again.");
      }

      // 2. Insert bid
      const { error: bidError } = await supabase
        .from('bids')
        .insert({
          auction_id: auctionId,
          bidder_id: userId,
          amount: amount,
          status: 'winning',
          auto_bid: isAutoBid,
          max_auto_bid: isAutoBid ? parseFloat(maxAutoBid) : null
        });
      
      if (bidError) throw bidError;

      // 3. Update auction
      const { error: auctionError } = await supabase
        .from('auctions')
        .update({
          current_bid: amount,
          total_bids: (auction?.total_bids || 0) + 1,
          winner_id: userId
        })
        .eq('id', auctionId);

      if (auctionError) throw auctionError;

      return amount;
    },
    onSuccess: (amount) => {
      toast.success(`Bid placed: $${amount}!`);
      queryClient.invalidateQueries({ queryKey: ['auction', auctionId] });
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to place bid");
    }
  });

  const minBid = (auction?.current_bid || auction?.starting_price || 0) + (auction?.bid_increment || 50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(bidValue);
    if (isAutoBid) {
      const maxAmount = parseFloat(maxAutoBid);
      if (isNaN(maxAmount) || maxAmount <= amount) {
        toast.error("Maximum auto-bid must be higher than your current bid");
        return;
      }
    }
    placeBid.mutate(amount);
  };

  const quickBid = (extra: number) => {
    const amount = minBid + extra;
    placeBid.mutate(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-card to-card/95 border-primary/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Hammer className="h-6 w-6 text-primary animate-bounce" />
            Place Your Bid
          </DialogTitle>
          <DialogDescription>
            Bidding for {auction?.containers?.origin} to {auction?.containers?.destination}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center animate-pulse">Loading active bids...</div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Current High Bid</p>
                <p className="text-3xl font-black text-primary">${auction?.current_bid || auction?.starting_price}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground font-medium">Next Min Bid</p>
                <p className="text-xl font-bold text-secondary">${minBid}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[+50, +100, +500].map((inc) => (
                <Button 
                  key={inc} 
                  variant="outline" 
                  className="bg-secondary/5 border-secondary/20 hover:bg-secondary/10"
                  onClick={() => quickBid(inc - auction?.bid_increment)}
                >
                  + ${inc}
                </Button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder="Starting bid amount"
                  className="pl-8 text-lg font-bold bg-background/50 border-primary/20 focus:border-primary/50"
                  value={bidValue}
                  onChange={(e) => setBidValue(e.target.value)}
                  min={minBid}
                />
              </div>

              {/* Auto-Bid Toggle */}
              <div className="p-4 bg-muted/20 border border-border/50 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <Label htmlFor="auto-bid" className="font-semibold cursor-pointer">Proxy Bidding (Auto-Bid)</Label>
                  </div>
                  <Switch 
                    id="auto-bid" 
                    checked={isAutoBid} 
                    onCheckedChange={setIsAutoBid} 
                  />
                </div>
                
                {isAutoBid && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-xs text-muted-foreground mb-2">
                      Set a maximum price. We'll automatically outbid others by the minimum increment up to this limit.
                    </p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                      <Input
                        type="number"
                        placeholder="Your absolute maximum"
                        className="pl-8 bg-background/50"
                        value={maxAutoBid}
                        onChange={(e) => setMaxAutoBid(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-primary to-secondary h-12 text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                disabled={placeBid.isPending}
              >
                {placeBid.isPending ? "Processing Bid..." : "Confirm Bid"}
              </Button>
            </form>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-border/20 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p>Bids are legally binding. If you win, you must proceed with the payment within 24 hours.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
