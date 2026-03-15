import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Package, Box } from "lucide-react";

interface BookingUtilizationCardProps {
  booking: any;
}

export const BookingUtilizationCard = ({ booking }: BookingUtilizationCardProps) => {
  const spaceUtilization = booking.space_utilization_percent || 0;
  const bookedVolume = booking.booked_volume_m3 || 0;
  const totalVolume = booking.containers?.total_volume_m3 || 1;
  
  const getUtilizationColor = () => {
    if (spaceUtilization > 70) return "text-green-600 dark:text-green-400";
    if (spaceUtilization > 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const getProgressColor = () => {
    if (spaceUtilization > 70) return "bg-green-500";
    if (spaceUtilization > 40) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <Card className="p-4 bg-muted/50">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Your Space Utilization</span>
          </div>
          <span className={`text-lg font-bold ${getUtilizationColor()}`}>
            {spaceUtilization.toFixed(1)}%
          </span>
        </div>
        
        <div className="relative">
          <Progress value={spaceUtilization} className="h-2" />
          <style>{`
            .progress-indicator-${booking.id} [data-state="complete"] {
              background-color: ${spaceUtilization > 70 ? 'rgb(34 197 94)' : spaceUtilization > 40 ? 'rgb(234 179 8)' : 'rgb(249 115 22)'};
            }
          `}</style>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Your Space:</span>
            <span className="font-medium">{bookedVolume.toFixed(2)} m³</span>
          </div>
          <div className="flex items-center gap-1">
            <Box className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">{totalVolume.toFixed(2)} m³</span>
          </div>
        </div>

        {booking.containers?.shared_booking_enabled && (
          <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded">
            📦 Shared container - You're utilizing {spaceUtilization.toFixed(1)}% of the total space
          </div>
        )}
      </div>
    </Card>
  );
};
