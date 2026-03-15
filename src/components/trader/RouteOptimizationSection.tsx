import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Star, Zap, TrendingUp, Calendar, Package, DollarSign } from "lucide-react";
import { format } from "date-fns";
import type { OptimizedContainer } from "@/hooks/useRouteOptimization";

interface RouteOptimizationSectionProps {
  optimizedContainers: OptimizedContainer[];
  onBookContainer: (container: any) => void;
  onAskQuestion?: (container: any) => void;
}

export const RouteOptimizationSection = ({ 
  optimizedContainers, 
  onBookContainer, 
  onAskQuestion 
}: RouteOptimizationSectionProps) => {
  const topContainers = optimizedContainers.slice(0, 3);

  if (topContainers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">AI-Optimized Recommendations</h2>
        <Badge variant="secondary" className="ml-auto">Top {topContainers.length} Matches</Badge>
      </div>
      
      <p className="text-muted-foreground">
        Based on historical performance, route reliability, and optimization scores
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {topContainers.map((optimized, index) => {
          const container = optimized.container;
          const rankBadges = {
            0: { label: "Best Match", variant: "default" as const, icon: Star },
            1: { label: "Great Choice", variant: "secondary" as const, icon: TrendingUp },
            2: { label: "Good Option", variant: "outline" as const, icon: Sparkles }
          };
          const rank = rankBadges[index as 0 | 1 | 2];

          return (
            <Card key={container.id} className="p-5 border-2 hover:shadow-lg transition-shadow relative overflow-hidden">
              {/* Rank Badge */}
              <div className="absolute top-3 right-3">
                <Badge variant={rank.variant} className="flex items-center gap-1">
                  <rank.icon className="h-3 w-3" />
                  {rank.label}
                </Badge>
              </div>

              {/* Performance Badges */}
              <div className="flex flex-wrap gap-2 mb-4 mt-6">
                {optimized.badges.map((badge) => {
                  const badgeConfig = {
                    reliable: { icon: Star, label: "Route Reliable", color: "text-green-600" },
                    fastest: { icon: Zap, label: "Fastest Delivery", color: "text-blue-600" },
                    optimized: { icon: TrendingUp, label: "Best Utilization", color: "text-purple-600" }
                  };
                  const config = badgeConfig[badge];
                  return (
                    <Badge key={badge} variant="outline" className={config.color}>
                      <config.icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  );
                })}
              </div>

              {/* Container Info */}
              <div className="space-y-3 mb-4">
                <div>
                  <div className="text-sm text-muted-foreground">Route</div>
                  <div className="font-semibold text-lg">
                    {container.origin} → {container.destination}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Container Type</span>
                  <span className="font-medium">{container.container_type?.replace(/_/g, ' ').toUpperCase()}</span>
                </div>

                {container.departure_date && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Departure
                    </span>
                    <span className="font-medium">{format(new Date(container.departure_date), 'MMM dd, yyyy')}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Available Space
                  </span>
                  <span className="font-medium">{container.available_volume_m3?.toFixed(1)} m³</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1 text-sm">
                    <DollarSign className="h-3 w-3" />
                    Price
                  </span>
                  <span className="text-xl font-bold text-primary">
                    ${container.price_per_m3 ? container.price_per_m3.toFixed(2) : container.price_usd.toFixed(2)}
                    {container.price_per_m3 && <span className="text-sm text-muted-foreground">/m³</span>}
                  </span>
                </div>
              </div>

              {/* Optimization Score */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Optimization Score</span>
                  <span className="font-bold">{optimized.score.toFixed(0)}/100</span>
                </div>
                <Progress value={optimized.score} className="h-2" />
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                <div className="bg-muted rounded p-2">
                  <div className="text-muted-foreground">Reliability</div>
                  <div className="font-bold">{optimized.routeReliability.toFixed(0)}%</div>
                </div>
                <div className="bg-muted rounded p-2">
                  <div className="text-muted-foreground">Avg Delay</div>
                  <div className="font-bold">{optimized.averageDelay.toFixed(1)} days</div>
                </div>
              </div>

              {/* Why This Container */}
              <div className="mb-4 p-3 bg-primary/5 rounded-md">
                <div className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Why This Container?
                </div>
                <ul className="text-xs space-y-1">
                  {optimized.reasons.slice(0, 3).map((reason, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => onBookContainer(container)} 
                  className="flex-1"
                  size="sm"
                >
                  Book Now
                </Button>
                {onAskQuestion && (
                  <Button 
                    onClick={() => onAskQuestion(container)} 
                    variant="outline"
                    size="sm"
                  >
                    Ask Question
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
