import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MapPin, Calendar, Package, DollarSign, Box, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { calculateVolumeBasedPrice } from "@/utils/pricing";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  container: any;
  traderId: string;
}

export const BookingModal = ({ open, onClose, onSuccess, container, traderId }: BookingModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cargo_description: "",
    cargo_weight_kg: "",
    cargo_volume_m3: "",
    pickup_date: "",
    delivery_date: "",
    pickup_address: "",
    drop_address: "",
    final_delivery_date: ""
  });
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);

  // Calculate price when volume or weight changes
  useEffect(() => {
    if (formData.cargo_volume_m3 && formData.cargo_weight_kg && container.price_per_m3) {
      const pricing = calculateVolumeBasedPrice({
        pricePerM3: container.price_per_m3,
        cargoVolume: parseFloat(formData.cargo_volume_m3),
        cargoWeight: parseFloat(formData.cargo_weight_kg),
        origin: { city: container.origin_city || container.origin, country: container.origin_country || "Unknown" },
        destination: { city: container.destination_city || container.destination, country: container.destination_country || "Unknown" }
      });
      setEstimatedPrice(pricing.totalPrice);
      setPriceBreakdown(pricing.breakdown);
    }
  }, [formData.cargo_volume_m3, formData.cargo_weight_kg, container]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check booking deadline (2 days before departure)
      if (container.departure_date) {
        const departureDate = new Date(container.departure_date);
        const bookingDeadline = new Date(departureDate);
        bookingDeadline.setDate(bookingDeadline.getDate() - 2);
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        
        if (currentDate > bookingDeadline) {
          toast.error("Booking for this container has closed. Book at least 2 days before departure.");
          setLoading(false);
          return;
        }
      }

      const cargoVolume = parseFloat(formData.cargo_volume_m3);
      const cargoWeight = parseFloat(formData.cargo_weight_kg);

      // Validation: Check available capacity
      const availableVolume = container.available_volume_m3 || container.total_volume_m3;
      const availableWeight = container.available_weight_kg || container.capacity_kg;

      if (cargoVolume > availableVolume) {
        toast.error(`Cargo volume exceeds available space (${availableVolume?.toFixed(2)} m³)`);
        setLoading(false);
        return;
      }

      if (cargoWeight > availableWeight) {
        toast.error(`Cargo weight exceeds available capacity (${availableWeight.toLocaleString()} kg)`);
        setLoading(false);
        return;
      }

      // Get provider user_id for notification
      const { data: provider } = await supabase
        .from("providers")
        .select("user_id")
        .eq("id", container.provider_id)
        .single();

      const finalPrice = estimatedPrice || container.price_usd;
      const spaceUtilization = (cargoVolume / (container.total_volume_m3 || 1)) * 100;

      const { error } = await supabase.from("bookings").insert({
        trader_id: traderId,
        provider_id: container.provider_id,
        container_id: container.id,
        cargo_description: formData.cargo_description,
        cargo_weight_kg: cargoWeight,
        booked_volume_m3: cargoVolume,
        booked_weight_kg: cargoWeight,
        price_per_m3: container.price_per_m3,
        space_utilization_percent: spaceUtilization,
        pickup_date: formData.pickup_date,
        delivery_date: formData.delivery_date,
        pickup_address: formData.pickup_address,
        drop_address: formData.drop_address,
        final_delivery_date: formData.final_delivery_date,
        price_usd: finalPrice,
        status: "pending",
        booking_number: `BK-${Date.now()}`
      });

      if (error) throw error;

      // Create notification for provider
      if (provider) {
        await supabase.from("notifications").insert([
          {
            user_id: provider.user_id,
            type: "booking",
            title: "New Booking Request",
            message: `New booking request for ${container.container_type} - ${cargoVolume.toFixed(2)} m³`,
            link: `/dashboard/provider/bookings`,
          },
        ]);
      }

      toast.success("Booking request sent successfully!");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  if (!container) return null;

  const availableVolume = container.available_volume_m3 || container.total_volume_m3;
  const availableWeight = container.available_weight_kg || container.capacity_kg;
  const utilizationRate = container.utilization_rate || 0;
  
  // Calculate booking deadline and delivery deadline
  const departureDate = container.departure_date ? new Date(container.departure_date) : null;
  const bookingDeadline = departureDate ? new Date(departureDate.getTime() - 2 * 24 * 60 * 60 * 1000) : null;
  const deliveryDeadline = bookingDeadline;
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  const isBookingClosed = bookingDeadline ? currentDate > bookingDeadline : false;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book Container Space</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">{container.container_type}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{container.origin} → {container.destination}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(container.available_from), "MMM dd")} - {format(new Date(container.available_until), "MMM dd, yyyy")}
              </span>
            </div>
            {deliveryDeadline && (
              <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-900">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                  📦 Cargo Delivery Deadline: {format(deliveryDeadline, "MMM dd, yyyy")}
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Cargo must be delivered at least 2 days before container departure
                </p>
              </div>
            )}
            {isBookingClosed && (
              <Alert className="mt-2 border-red-500 bg-red-50 dark:bg-red-950/20">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-900 dark:text-red-200 font-medium">
                  ⚠️ Booking Closed - Must book at least 2 days before departure
                </AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="flex items-center gap-2 text-sm">
                <Box className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Available Volume</p>
                  <p className="text-muted-foreground">{availableVolume?.toFixed(2)} m³</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Available Weight</p>
                  <p className="text-muted-foreground">{availableWeight.toLocaleString()} kg</p>
                </div>
              </div>
            </div>
            {utilizationRate > 0 && (
              <Alert className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This container is {utilizationRate.toFixed(1)}% utilized. You're booking shared space.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-center gap-2 text-sm font-semibold text-primary mt-3">
              <DollarSign className="h-4 w-4" />
              <span>{container.price_per_m3 ? `$${container.price_per_m3}/m³` : `$${container.price_usd.toLocaleString()}`}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="cargo_description">Cargo Description *</Label>
              <Textarea
                id="cargo_description"
                value={formData.cargo_description}
                onChange={(e) => setFormData({ ...formData, cargo_description: e.target.value })}
                placeholder="Describe your cargo..."
                required
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cargo_volume_m3">Cargo Volume (m³) *</Label>
                <Input
                  id="cargo_volume_m3"
                  type="number"
                  step="0.01"
                  value={formData.cargo_volume_m3}
                  onChange={(e) => setFormData({ ...formData, cargo_volume_m3: e.target.value })}
                  placeholder="e.g. 5.5"
                  required
                  max={availableVolume}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Max: {availableVolume?.toFixed(2)} m³
                </p>
              </div>

              <div>
                <Label htmlFor="cargo_weight_kg">Cargo Weight (kg) *</Label>
                <Input
                  id="cargo_weight_kg"
                  type="number"
                  value={formData.cargo_weight_kg}
                  onChange={(e) => setFormData({ ...formData, cargo_weight_kg: e.target.value })}
                  placeholder="e.g. 5000"
                  required
                  max={availableWeight}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Max: {availableWeight.toLocaleString()} kg
                </p>
              </div>
            </div>

            {estimatedPrice && (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-2">Estimated Cost</h4>
                <p className="text-2xl font-bold text-primary mb-2">${estimatedPrice.toLocaleString()}</p>
                {priceBreakdown && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Volume: ${priceBreakdown.volumeCharge}</p>
                    <p>Weight: ${priceBreakdown.weightCharge}</p>
                    <p>Distance: ${priceBreakdown.distanceCharge}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {formData.cargo_volume_m3 && availableVolume 
                    ? `Utilizing ${((parseFloat(formData.cargo_volume_m3) / availableVolume) * 100).toFixed(1)}% of available space`
                    : ''}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="pickup_address">Pickup Address *</Label>
                <Textarea
                  id="pickup_address"
                  value={formData.pickup_address}
                  onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
                  placeholder="Enter full pickup address..."
                  required
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="drop_address">Delivery Address *</Label>
                <Textarea
                  id="drop_address"
                  value={formData.drop_address}
                  onChange={(e) => setFormData({ ...formData, drop_address: e.target.value })}
                  placeholder="Enter full delivery address..."
                  required
                  rows={2}
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">🚚 Multi-Leg Transport Plan</h4>
              <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Leg 1:</span>
                  <span>Truck pickup from your location</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Leg 2:</span>
                  <span>Sea shipping ({container.origin} → {container.destination})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Leg 3:</span>
                  <span>Final truck delivery to destination</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pickup_date">Pickup Date *</Label>
                <Input
                  id="pickup_date"
                  type="date"
                  value={formData.pickup_date}
                  onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
                  required
                  min={container.available_from}
                  max={deliveryDeadline ? format(deliveryDeadline, "yyyy-MM-dd") : container.available_until}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leg 1: Truck pickup date
                </p>
              </div>
              <div>
                <Label htmlFor="delivery_date">Port Handover Date *</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  required
                  max={deliveryDeadline ? format(deliveryDeadline, "yyyy-MM-dd") : container.available_until}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leg 2: Latest port arrival
                </p>
              </div>
              <div>
                <Label htmlFor="final_delivery_date">Final Delivery Date *</Label>
                <Input
                  id="final_delivery_date"
                  type="date"
                  value={formData.final_delivery_date}
                  onChange={(e) => setFormData({ ...formData, final_delivery_date: e.target.value })}
                  required
                  min={formData.delivery_date || container.available_from}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leg 3: Final delivery to address
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || isBookingClosed}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : isBookingClosed ? (
                  "Booking Closed"
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};