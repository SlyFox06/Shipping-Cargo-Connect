import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CloudRain, Wind, AlertTriangle } from "lucide-react";

interface WeatherRiskBadgeProps {
  riskLevel: 'low' | 'medium' | 'high';
  predictedDelayHours?: number;
  compact?: boolean;
}

export const WeatherRiskBadge = ({ 
  riskLevel, 
  predictedDelayHours = 0,
  compact = false 
}: WeatherRiskBadgeProps) => {
  const riskConfig = {
    low: {
      icon: CloudRain,
      label: "Low Weather Risk",
      variant: "default" as const,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    medium: {
      icon: Wind,
      label: "Medium Weather Risk",
      variant: "secondary" as const,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50"
    },
    high: {
      icon: AlertTriangle,
      label: "High Weather Risk",
      variant: "destructive" as const,
      color: "text-red-600",
      bgColor: "bg-red-50"
    }
  };

  const config = riskConfig[riskLevel];
  const Icon = config.icon;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant={config.variant} className="cursor-help">
              <Icon className="h-3 w-3 mr-1" />
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <div className="font-semibold">{config.label}</div>
              {predictedDelayHours > 0 && (
                <div className="text-sm">
                  Predicted delay: {predictedDelayHours}h
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg ${config.bgColor}`}>
      <Icon className={`h-5 w-5 ${config.color}`} />
      <div>
        <div className={`font-semibold ${config.color}`}>{config.label}</div>
        {predictedDelayHours > 0 && (
          <div className="text-sm text-muted-foreground">
            Expected delay: {predictedDelayHours} hours
          </div>
        )}
      </div>
    </div>
  );
};
