import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Edit, Eye, Trash2, MapPin, Calendar, Package, DollarSign, Box } from "lucide-react";
import { format } from "date-fns";

interface ContainerCardProps {
  container: any;
  onEdit: (container: any) => void;
  onView: (container: any) => void;
  onDelete: (container: any) => void;
}

export const ContainerCard = ({ container, onEdit, onView, onDelete }: ContainerCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "default";
      case "unavailable":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const utilizationRate = container.utilization_rate || 0;
  const maxCBM = container.max_cbm ?? container.total_volume_m3 ?? 0;
  const availableVolume = container.available_cbm ?? container.available_volume_m3 ?? maxCBM;
  
  const maxWeight = container.max_weight_kg ?? container.capacity_kg ?? 0;
  const availableWeight = container.available_weight_capacity_kg ?? container.available_weight_kg ?? maxWeight;
  
  const remainingPercentage = 100 - utilizationRate;
  const isShared = container.shared_booking_enabled || container.accepts_partial_bookings;
  const isActive = container.status === "available" || container.status === "active";

  // Color coding based on remaining capacity
  const getUtilizationColor = () => {
    if (remainingPercentage > 40) return "bg-success";
    if (remainingPercentage > 20) return "bg-warning";
    return "bg-destructive";
  };

  const getUtilizationBgColor = () => {
    if (remainingPercentage > 40) return "bg-success/10 border-success/20";
    if (remainingPercentage > 20) return "bg-warning/10 border-warning/20";
    return "bg-destructive/10 border-destructive/20";
  };

  return (
    <Card className="p-6 bg-card border-border hover:shadow-[0_0_20px_rgba(0,0,0,0.35)] transition-all">
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{container.container_type}</h3>
            <div className="flex gap-2 mt-2">
              {isActive && utilizationRate > 0 && utilizationRate < 100 ? (
                <Badge className="bg-warning/20 text-warning border-warning/30">Partially Booked</Badge>
              ) : isActive ? (
                <Badge className="bg-success/20 text-success border-success/30">Available</Badge>
              ) : (
                <Badge className="bg-destructive/20 text-destructive border-destructive/30">Fully Booked</Badge>
              )}
              {isShared && (
                <Badge className="bg-primary/20 text-primary border-primary/30">Shared</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" onClick={() => onView(container)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onEdit(container)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onDelete(container)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>

        {/* Enhanced Utilization Bar */}
        <div className={`p-4 rounded-lg border ${getUtilizationBgColor()}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-sm">Capacity Status</span>
            <span className="text-lg font-bold">{utilizationRate.toFixed(1)}% Used</span>
          </div>
          <div className="relative h-3 bg-muted/30 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getUtilizationColor()} transition-all duration-500`}
              style={{ width: `${utilizationRate}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <div>
              <p className="text-muted-foreground">Available</p>
              <p className="font-semibold">{availableVolume?.toFixed(2)} m³</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Capacity</p>
              <p className="font-semibold">{maxCBM?.toFixed(2)} m³</p>
            </div>
          </div>
          {utilizationRate >= 80 && (
            <div className="mt-2 text-xs font-medium">
              ⚠️ High utilization - notify traders
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>
              {container.origin_city && container.origin_country 
                ? `${container.origin_city}, ${container.origin_country}`
                : container.origin
              } → {
              container.destination_city && container.destination_country
                ? `${container.destination_city}, ${container.destination_country}`
                : container.destination
              }
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(new Date(container.departure_date || container.available_from || container.created_at), "MMM dd")} - {format(new Date(container.arrival_date || container.available_until || new Date(Date.now()+86400000*30)), "MMM dd, yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
            <Calendar className="h-3 w-3" />
            <span>Added On: {format(new Date(container.created_at), "MMM dd, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Box className="h-4 w-4" />
            <span>Volume: {availableVolume?.toFixed(2)} m³ available</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Weight: {availableWeight.toLocaleString()} kg available</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <DollarSign className="h-4 w-4" />
            <span>
              {container.price_per_cbm || container.price_per_m3 
                ? `$${container.price_per_cbm || container.price_per_m3}/m³` 
                : `$${container.price_usd?.toLocaleString() || 0}`}
            </span>
          </div>
        </div>

        {container.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {container.description}
          </p>
        )}
      </div>
    </Card>
  );
};
