import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Cloud, Wind, Waves, Eye, CloudRain, Thermometer, AlertCircle } from "lucide-react";
import { WeatherPrediction } from "@/hooks/useWeatherPrediction";
import { WeatherRiskBadge } from "./WeatherRiskBadge";

interface WeatherWidgetProps {
  prediction: WeatherPrediction;
  showDetails?: boolean;
}

export const WeatherWidget = ({ prediction, showDetails = true }: WeatherWidgetProps) => {
  const firstCheckpoint = prediction.routeCheckpoints[0];

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Weather Forecast</h3>
        </div>
        <WeatherRiskBadge 
          riskLevel={prediction.riskLevel} 
          predictedDelayHours={prediction.predictedDelayHours}
          compact
        />
      </div>

      {prediction.weatherAlerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="h-4 w-4" />
            Weather Alerts
          </div>
          <div className="space-y-1">
            {prediction.weatherAlerts.map((alert, i) => (
              <div key={i} className="text-sm text-muted-foreground bg-destructive/10 p-2 rounded">
                {alert}
              </div>
            ))}
          </div>
        </div>
      )}

      {showDetails && firstCheckpoint && (
        <>
          <Separator />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Wind className="h-3 w-3" />
                Wind Speed
              </div>
              <div className="text-sm font-medium">
                {firstCheckpoint.windSpeed.toFixed(0)} km/h
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Waves className="h-3 w-3" />
                Wave Height
              </div>
              <div className="text-sm font-medium">
                {firstCheckpoint.waveHeight.toFixed(1)}m
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                Visibility
              </div>
              <div className="text-sm font-medium">
                {firstCheckpoint.visibility.toFixed(1)} km
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CloudRain className="h-3 w-3" />
                Rainfall
              </div>
              <div className="text-sm font-medium">
                {firstCheckpoint.rainfall.toFixed(1)} mm
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Thermometer className="h-3 w-3" />
                Temperature
              </div>
              <div className="text-sm font-medium">
                {firstCheckpoint.temperature.toFixed(0)}°C
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Cloud className="h-3 w-3" />
                Storm Risk
              </div>
              <div className="text-sm font-medium">
                {(firstCheckpoint.stormProb * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </>
      )}

      {prediction.safeSailingWindow.delayRecommendation && (
        <>
          <Separator />
          <div className="text-sm text-muted-foreground bg-yellow-50 p-3 rounded">
            <strong>Recommendation:</strong> {prediction.safeSailingWindow.delayRecommendation}
          </div>
        </>
      )}

      {prediction.safeSailingWindow.bestWindow && (
        <div className="text-sm text-muted-foreground">
          <strong>Note:</strong> {prediction.safeSailingWindow.bestWindow}
        </div>
      )}
    </Card>
  );
};
