import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, Calendar, Ruler, DollarSign, Truck } from "lucide-react";
import { format } from "date-fns";

interface ViewContainerModalProps {
  open: boolean;
  onClose: () => void;
  container: any;
}

export const ViewContainerModal = ({ open, onClose, container }: ViewContainerModalProps) => {
  if (!container) return null;

  const getStatusBadge = (status: string) => {
    const styles = {
      available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      partially_booked: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      fully_booked: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    };
    return styles[status as keyof typeof styles] || styles.available;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Container Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Type */}
          <div className="flex items-center gap-3">
            <Badge className={getStatusBadge(container.status)}>
              {container.status.replace("_", " ").toUpperCase()}
            </Badge>
            <Badge variant="outline">{container.container_type}</Badge>
            <Badge variant="secondary">
              <Truck className="h-3 w-3 mr-1" />
              {container.transport_mode}
            </Badge>
          </div>

          {/* Route Information */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Route Information
            </h3>
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div>
                <p className="text-sm text-muted-foreground">Origin</p>
                <p className="font-medium">
                  {container.origin_city && container.origin_country 
                    ? `${container.origin_city}, ${container.origin_country}`
                    : container.origin}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Destination</p>
                <p className="font-medium">
                  {container.destination_city && container.destination_country
                    ? `${container.destination_city}, ${container.destination_country}`
                    : container.destination}
                </p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </h3>
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div>
                <p className="text-sm text-muted-foreground">Departure Date</p>
                <p className="font-medium">
                  {format(new Date(container.available_from), "MMM dd, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Arrival Date</p>
                <p className="font-medium">
                  {format(new Date(container.available_until), "MMM dd, yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Dimensions and Capacity */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Dimensions & Capacity
            </h3>
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div>
                <p className="text-sm text-muted-foreground">Dimensions (L × W × H)</p>
                <p className="font-medium">
                  {container.length_ft} × {container.width_ft} × {container.height_ft} ft
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Floor Area</p>
                <p className="font-medium">
                  {(container.length_ft * container.width_ft).toFixed(1)} sq ft
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Max Capacity</p>
                <p className="font-medium">{container.capacity_kg.toLocaleString()} kg</p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing
            </h3>
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div>
                <p className="text-sm text-muted-foreground">Base Rate per Sq Ft</p>
                <p className="font-medium">${container.base_rate_per_sqft}/sq ft</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Price</p>
                <p className="font-bold text-lg">${container.price_usd.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {container.description && (
            <div className="space-y-2">
              <h3 className="font-semibold">Description</h3>
              <p className="text-sm text-muted-foreground pl-6">{container.description}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-t pt-4 text-xs text-muted-foreground">
            <p>Created: {format(new Date(container.created_at), "PPpp")}</p>
            <p>Last Updated: {format(new Date(container.updated_at), "PPpp")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
