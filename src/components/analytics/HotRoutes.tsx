import { useDemandForecast } from "@/hooks/useDemandForecast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const HotRoutes = () => {
  const { data, loading, error } = useDemandForecast();

  if (loading) {
    return (
      <Card className="p-6 bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
          <h2 className="text-xl font-bold">Market Intelligence</h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (error || !data?.hotRoutes) return null;

  return (
    <Card className="p-6 bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)] overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <TrendingUp className="h-24 w-24" />
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold">Hot Routes</h2>
        </div>
        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
          AI Live Forecast
        </Badge>
      </div>

      <div className="space-y-4">
        {data.hotRoutes.map((route: any, i: number) => (
          <div 
            key={i} 
            className="group relative p-4 bg-muted/20 rounded-xl border border-border/50 hover:border-orange-500/30 transition-all hover:shadow-[0_0_15px_rgba(249,115,22,0.1)]"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-base tracking-tight">
                    {route.origin} → {route.destination}
                  </p>
                  <Badge className={`text-[10px] h-4 ${
                    route.demandLevel === 'very_high' ? 'bg-red-500/20 text-red-500' :
                    route.demandLevel === 'high' ? 'bg-orange-500/20 text-orange-500' :
                    'bg-blue-500/20 text-blue-500'
                  }`}>
                    {route.demandLevel.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  {route.avgBookingsPerWeek} bookings/week · {route.bookingTrend} trend
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-orange-500">{route.opportunityScore}/100</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Opportunity</p>
              </div>
            </div>
            
            <div className="mt-3 flex items-start gap-2 text-xs bg-orange-500/5 p-2 rounded-lg border border-orange-500/10">
              <Info className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-muted-foreground italic leading-relaxed">
                {route.insight}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border/50">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground">AI Outlook:</span> {data.summary}
        </p>
      </div>
    </Card>
  );
};
