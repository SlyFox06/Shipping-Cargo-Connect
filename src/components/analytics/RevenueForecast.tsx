import { useRevenueForecast } from "@/hooks/useRevenueForecast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertCircle, BarChart3, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const RevenueForecast = () => {
  const { data, loading, error } = useRevenueForecast();

  if (loading) {
    return (
      <Card className="p-6 bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-green-500 animate-pulse" />
          <h2 className="text-xl font-bold">Revenue Insights</h2>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </Card>
    );
  }

  if (error || !data?.currentMonthForecast) return null;

  return (
    <Card className="p-6 bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <DollarSign className="h-24 w-24" />
      </div>
      
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Revenue AI Forecast</h2>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Growth Analytics</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold px-3">
          Next 90 Days
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-muted/20 rounded-2xl border border-border/50">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">30 Day Forecast</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-black text-foreground">${data.next30Days.estimatedRevenue.toLocaleString()}</p>
            <div className={`flex items-center text-[10px] font-bold mb-1 ${
              data.next30Days.vsLastMonth === 'up' ? 'text-green-500' : 'text-red-500'
            }`}>
              {data.next30Days.vsLastMonth === 'up' ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {data.next30Days.vsLastMonthPercent}%
            </div>
          </div>
          <div className="mt-2 h-1 w-full bg-muted/40 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full" 
              style={{ width: `${Math.min((data.next30Days.estimatedRevenue / (data.next30Days.estimatedRevenue * 1.2)) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="p-4 bg-muted/20 rounded-2xl border border-border/50">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">90 Day Forecast</p>
          <p className="text-2xl font-black text-foreground">${data.next90Days.estimatedRevenue.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            Trend: <span className="text-emerald-500 capitalize">{data.next90Days.trend}</span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {data.alerts?.map((alert: any, i: number) => (
          <div 
            key={i} 
            className={`flex items-start gap-3 p-3 rounded-xl border ${
              alert.type === 'opportunity' ? 'bg-emerald-500/5 border-emerald-500/20' :
              alert.type === 'risk' ? 'bg-red-500/5 border-red-500/20' :
              'bg-amber-500/5 border-amber-500/20'
            }`}
          >
            <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${
              alert.type === 'opportunity' ? 'text-emerald-500' :
              alert.type === 'risk' ? 'text-red-500' :
              'text-amber-500'
            }`} />
            <p className="text-xs text-muted-foreground font-medium italic">
              {alert.message}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border/50 text-center">
        <p className="text-[11px] text-muted-foreground font-medium leading-relaxed italic">
           "{data.summary}"
        </p>
      </div>
    </Card>
  );
};
