import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Info, Loader2 } from "lucide-react";
import { priceForecastService, type ForecastData } from "@/services/priceForecastService";
import { Badge } from "@/components/ui/badge";

interface AIPriceForecastProps {
  origin: string;
  destination: string;
}

export const AIPriceForecast = ({ origin: initialOrigin, destination: initialDestination }: AIPriceForecastProps) => {
  const [data, setData] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRoute, setCurrentRoute] = useState({ origin: initialOrigin, destination: initialDestination });
  const [routes, setRoutes] = useState<{origin: string, destination: string}[]>([]);

  useEffect(() => {
    const initTicker = async () => {
      if (!initialOrigin || !initialDestination) {
        const activeRoutes = await priceForecastService.getActiveRoutes();
        setRoutes(activeRoutes);
        if (activeRoutes.length > 0) {
          setCurrentRoute(activeRoutes[0]);
        }
      } else {
        setCurrentRoute({ origin: initialOrigin, destination: initialDestination });
      }
    };
    initTicker();
  }, [initialOrigin, initialDestination]);

  useEffect(() => {
    if (routes.length > 1 && (!initialOrigin || !initialDestination)) {
      const interval = setInterval(() => {
        setCurrentRoute(prev => {
          const idx = routes.findIndex(r => r.origin === prev.origin && r.destination === prev.destination);
          const nextIdx = (idx + 1) % routes.length;
          return routes[nextIdx];
        });
      }, 10000); // Cycle every 10s
      return () => clearInterval(interval);
    }
  }, [routes, initialOrigin, initialDestination]);

  useEffect(() => {
    const fetchForecast = async () => {
      if (!currentRoute.origin || !currentRoute.destination) return;
      setLoading(true);
      const forecast = await priceForecastService.getForecastForRoute(currentRoute.origin, currentRoute.destination);
      setData(forecast);
      setLoading(false);
    };

    fetchForecast();
  }, [currentRoute.origin, currentRoute.destination]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Calculating AI predictions...</span>
        </CardContent>
      </Card>
    );
  }

  const latest = data[data.length - 1]?.predictedPrice;
  const initial = data[0]?.predictedPrice;
  const change = latest && initial ? ((latest - initial) / initial) * 100 : 0;
  const isUp = change > 0;

  return (
    <Card className="w-full shadow-lg border-primary/20 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            AI Freight Price Forecast
            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter">AI Prediction</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {currentRoute.origin} → {currentRoute.destination}
            {routes.length > 1 && (!initialOrigin || !initialDestination) && (
              <Badge variant="secondary" className="text-[8px] h-4 animate-pulse">Live Ticker</Badge>
            )}
          </p>
        </div>
        <div className={`flex items-center gap-1 font-bold ${isUp ? "text-destructive" : "text-success"}`}>
          {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {Math.abs(change).toFixed(1)}%
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-60 mt-4 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
              <XAxis 
                dataKey="date" 
                hide 
              />
              <YAxis 
                hide 
                domain={['dataMin - 100', 'dataMax + 100']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                }}
                labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
              />
              <Area 
                type="monotone" 
                dataKey="predictedPrice" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorPrice)" 
                name="Predicted Price ($)"
              />
              <Area 
                type="monotone" 
                dataKey="confidenceUpper" 
                stroke="none" 
                fill="hsl(var(--primary))" 
                fillOpacity={0.1}
                name="Confidence Upper"
              />
              <ReferenceLine x={data.find(d => !d.isHistorical)?.date} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ position: 'top', value: 'Prediction Starts', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <p className="text-muted-foreground">
            Prices for <span className="font-bold text-foreground">{currentRoute.origin} → {currentRoute.destination}</span> are predicted to {isUp ? "rise" : "fall"} over the next month. 
            <strong> {isUp ? "Consider booking early" : "You may find better rates in ~14 days"}</strong> based on current AI indicators.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
