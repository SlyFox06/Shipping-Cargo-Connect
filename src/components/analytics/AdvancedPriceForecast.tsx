import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  DollarSign, 
  Calculator, 
  Ship, 
  ShieldCheck,
  Zap,
  Loader2,
  Box
} from "lucide-react";
import { useAIPriceForecast } from "@/hooks/useAIPriceForecast";
import { motion, AnimatePresence } from "framer-motion";

interface AdvancedPriceForecastProps {
  origin: string;
  destination: string;
  cargoType: string;
  weightKg: number;
  cbm: number;
  departureDate?: string;
}

export const AdvancedPriceForecast = ({
  origin: initialOrigin,
  destination: initialDestination,
  cargoType,
  weightKg,
  cbm,
  departureDate = new Date().toISOString()
}: AdvancedPriceForecastProps) => {
  const { result, loading, error, getForecast } = useAIPriceForecast();
  const [currentRoute, setCurrentRoute] = useState({ origin: initialOrigin, destination: initialDestination });
  const [routes, setRoutes] = useState<{origin: string, destination: string}[]>([]);

  useEffect(() => {
    const initTicker = async () => {
      if (!initialOrigin || !initialDestination) {
        const { priceForecastService } = await import("@/services/priceForecastService");
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
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [routes, initialOrigin, initialDestination]);

  useEffect(() => {
    if (currentRoute.origin && currentRoute.destination && cargoType && weightKg > 0 && cbm > 0) {
      getForecast({
        origin: currentRoute.origin,
        destination: currentRoute.destination,
        cargoType,
        weightKg,
        cbm,
        departureDate
      });
    }
  }, [currentRoute.origin, currentRoute.destination, cargoType, weightKg, cbm, departureDate, getForecast]);

  if (loading) {
    return (
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-xl min-h-[300px] flex items-center justify-center">
        <CardContent className="py-12 flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <Zap className="h-5 w-5 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">ShipConnect AI Analyzing Market Trends...</p>
            <p className="text-[10px] text-muted-foreground">Fetching live weather & route data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 backdrop-blur-sm shadow-xl p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <h3 className="text-sm font-bold text-destructive">AI Analysis Unavailable</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">{error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => getForecast({ origin: currentRoute.origin!, destination: currentRoute.destination!, cargoType, weightKg, cbm, departureDate })}
        >
          Try Again
        </Button>
      </Card>
    );
  }

  if (!result) return null;

  const trendIcon = {
    rising: <TrendingUp className="h-4 w-4 text-destructive" />,
    falling: <TrendingDown className="h-4 w-4 text-success" />,
    stable: <Minus className="h-4 w-4 text-muted-foreground" />
  }[result.trend];

  const confidenceColor = {
    high: "bg-green-500",
    medium: "bg-blue-500",
    low: "bg-yellow-500"
  }[result.confidence];

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm shadow-xl">
      <CardHeader className="p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              Smart Freight Forecast
              {routes.length > 1 && (!initialOrigin || !initialDestination) && (
                <Badge variant="secondary" className="text-[9px] h-4 animate-pulse">Live Ticker</Badge>
              )}
            </CardTitle>
          </div>
          <div className="flex gap-2">
            {result?.weatherImpact && (
              <Badge variant="outline" className={`text-[10px] uppercase gap-1 ${
                result.weatherImpact === 'favorable' ? 'text-green-500 border-green-500/20 bg-green-500/10' :
                result.weatherImpact === 'unfavorable' ? 'text-red-500 border-red-500/20 bg-red-500/10' :
                'text-blue-500 border-blue-500/20 bg-blue-500/10'
              }`}>
                {result.weatherImpact} Weather
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] uppercase gap-1 bg-background/50">
              <Zap className="h-3 w-3 text-orange-500 fill-orange-500" /> AI-Powered
            </Badge>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-medium px-4 pb-2">
          <Ship className="h-3 w-3 text-primary" />
          {currentRoute.origin} → {currentRoute.destination}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {/* Main Price Display */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Recommended Rate</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-primary">${result.recommended.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">USD</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-1 justify-end text-sm font-bold">
              {trendIcon}
              <span className="capitalize">{result.trend}</span>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Confidence</span>
              <div className="flex gap-0.5">
                {[1, 2, 3].map((i) => (
                  <div 
                    key={i} 
                    className={`h-1 w-3 rounded-full ${i <= (result.confidence === 'high' ? 3 : result.confidence === 'medium' ? 2 : 1) ? confidenceColor : 'bg-muted'}`} 
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Range Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
            <span>MIN: ${result.min.toLocaleString()}</span>
            <span>MAX: ${result.max.toLocaleString()}</span>
          </div>
          <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${((result.recommended - result.min) / (result.max - result.min)) * 100}%` }}
              className="absolute h-full left-0 bg-primary opacity-20"
            />
            <div className="absolute h-full w-full flex items-center justify-center">
              <div className="h-4 w-1 bg-primary rounded-full shadow-lg" />
            </div>
          </div>
        </div>

        {/* Peak Warning */}
        {result.peakWarning && (
          <Alert className="py-2 px-3 border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-[11px] font-semibold ml-2">Peak season surcharge detected for this route window.</p>
          </Alert>
        )}

        <Separator className="opacity-50" />

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Ship className="h-3 w-3" /> Base Freight
              </div>
              <span className="font-bold">${result.breakdown.baseFreight}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Zap className="h-3 w-3" /> Fuel Surcharge
              </div>
              <span className="font-bold">${result.breakdown.fuelSurcharge}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Box className="h-3 w-3" /> Port Handling
              </div>
              <span className="font-bold">${result.breakdown.portHandling}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <ShieldCheck className="h-3 w-3" /> Insurance
              </div>
              <span className="font-bold">${result.breakdown.insurance}</span>
            </div>
          </div>
        </div>

        {/* Reasoning */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
          <p className="text-[11px] leading-relaxed text-muted-foreground italic">
            "{result.reasoning}"
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
