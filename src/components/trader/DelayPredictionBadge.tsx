import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { useDelayPrediction } from "@/hooks/useDelayPrediction";

interface DelayPredictionBadgeProps {
  containerId: string;
  route: string;
  departureDate: string;
}

export const DelayPredictionBadge = ({ 
  containerId, 
  route, 
  departureDate 
}: DelayPredictionBadgeProps) => {
  const { prediction, loading, predictDelay } = useDelayPrediction();
  const [hasPredicted, setHasPredicted] = useState(false);

  useEffect(() => {
    if (!hasPredicted && containerId && route && departureDate) {
      predictDelay(containerId, route, departureDate);
      setHasPredicted(true);
    }
  }, [containerId, route, departureDate]);

  if (loading) {
    return (
      <Badge variant="outline" className="animate-pulse">
        <Sparkles className="h-3 w-3 mr-1" />
        Predicting...
      </Badge>
    );
  }

  if (!prediction) {
    return null;
  }

  const riskConfig = {
    low: {
      icon: CheckCircle2,
      label: "Low Risk",
      variant: "default" as const,
      color: "text-green-600"
    },
    medium: {
      icon: AlertCircle,
      label: "Medium Risk",
      variant: "secondary" as const,
      color: "text-yellow-600"
    },
    high: {
      icon: AlertTriangle,
      label: "High Risk",
      variant: "destructive" as const,
      color: "text-red-600"
    }
  };

  const config = riskConfig[prediction.riskScore];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant={config.variant} className="cursor-help">
            <Icon className="h-3 w-3 mr-1" />
            <Sparkles className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold">AI Delay Prediction</div>
            <div className="text-sm">
              <div>Predicted Delay: {prediction.delayDays} days</div>
              <div>Confidence: {prediction.confidence}%</div>
            </div>
            {prediction.factors.length > 0 && (
              <div className="text-xs space-y-1 pt-2 border-t">
                <div className="font-semibold">Key Factors:</div>
                {prediction.factors.map((factor, i) => (
                  <div key={i}>• {factor}</div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
