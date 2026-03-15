import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { RouteCheckpoint } from "@/hooks/useWeatherPrediction";

interface RouteWeatherMapProps {
  checkpoints: RouteCheckpoint[];
}

export const RouteWeatherMap = ({ checkpoints }: RouteWeatherMapProps) => {
  const getRiskColor = (riskScore: number) => {
    if (riskScore < 0.3) return "text-green-600";
    if (riskScore < 0.7) return "text-yellow-600";
    return "text-red-600";
  };

  const getRiskIcon = (riskScore: number) => {
    if (riskScore < 0.3) return TrendingDown;
    if (riskScore < 0.7) return Minus;
    return TrendingUp;
  };

  const getRiskBg = (riskScore: number) => {
    if (riskScore < 0.3) return "bg-green-50";
    if (riskScore < 0.7) return "bg-yellow-50";
    return "bg-red-50";
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        Route Weather Analysis
      </h3>

      <div className="space-y-3">
        {checkpoints.map((checkpoint, index) => {
          const RiskIcon = getRiskIcon(checkpoint.riskScore);
          
          return (
            <div key={index} className="relative">
              {index < checkpoints.length - 1 && (
                <div className="absolute left-4 top-12 w-0.5 h-8 bg-border" />
              )}
              
              <div className={`p-3 rounded-lg ${getRiskBg(checkpoint.riskScore)}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className={`h-4 w-4 ${getRiskColor(checkpoint.riskScore)}`} />
                    <span className="font-medium">{checkpoint.name}</span>
                  </div>
                  <Badge variant="outline" className={getRiskColor(checkpoint.riskScore)}>
                    <RiskIcon className="h-3 w-3 mr-1" />
                    Risk: {(checkpoint.riskScore * 100).toFixed(0)}%
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">Wind:</span> {checkpoint.windSpeed.toFixed(0)} km/h
                  </div>
                  <div>
                    <span className="font-medium">Waves:</span> {checkpoint.waveHeight.toFixed(1)}m
                  </div>
                  <div>
                    <span className="font-medium">Visibility:</span> {checkpoint.visibility.toFixed(1)}km
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Average Route Risk:</span>
          <span className={`font-semibold ${getRiskColor(
            checkpoints.reduce((sum, cp) => sum + cp.riskScore, 0) / checkpoints.length
          )}`}>
            {((checkpoints.reduce((sum, cp) => sum + cp.riskScore, 0) / checkpoints.length) * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </Card>
  );
};
