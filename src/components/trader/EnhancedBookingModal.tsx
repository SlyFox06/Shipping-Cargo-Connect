import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle2, Scale, Package2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { calculateVolumeBasedPrice } from "@/utils/pricing";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { CARGO_CATEGORIES, getCategoryLabel, validateCargoSafety, type CargoCategory } from "@/utils/cargoValidation";
import { calculateCargoSplit, type SplitResult } from "@/utils/cargoSplitting";
import { calculateWeightBalance } from "@/utils/weightBalance";
import { useWeatherPrediction } from "@/hooks/useWeatherPrediction";
import { WeatherWidget } from "@/components/weather/WeatherWidget";
import { RouteWeatherMap } from "@/components/weather/RouteWeatherMap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EnhancedBookingModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  container: any;
  traderId: string;
}

export const EnhancedBookingModal = ({ open, onClose, onSuccess, container, traderId }: EnhancedBookingModalProps) => {
  const [loading, setLoading] = useState(false);
  const [cargoCategory, setCargoCategory] = useState<CargoCategory>(CARGO_CATEGORIES.TEXTILES);
  const [formData, setFormData] = useState({
    cargo_description: "",
    cargo_weight_kg: "",
    cargo_volume_m3: "",
    cargo_length: "",
    cargo_width: "",
    cargo_height: "",
    pickup_date: "",
    delivery_date: "",
    pickup_address: "",
    drop_address: "",
    final_delivery_date: ""
  });
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);
  const [safetyValidation, setSafetyValidation] = useState<any>(null);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [weightBalance, setWeightBalance] = useState<any>(null);
  const [recommendedContainers, setRecommendedContainers] = useState<any[]>([]);
  const [balanceAnalysis, setBalanceAnalysis] = useState<any>(null);
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [selectedSplitOption, setSelectedSplitOption] = useState<number | null>(null);
  const { prediction: weatherPrediction, loading: weatherLoading, predictWeather } = useWeatherPrediction();

  // Validate cargo safety
  useEffect(() => {
    if (cargoCategory) {
      const validation = validateCargoSafety(cargoCategory, container);
      setSafetyValidation(validation);
    }
  }, [cargoCategory, container]);

  // Fetch weather prediction when modal opens
  useEffect(() => {
    if (open && container?.origin && container?.destination) {
      predictWeather(
        container.origin,
        container.destination,
        container.id,
        undefined,
        container.departure_date || undefined
      );
    }
  }, [open, container]);

  // Calculate price and check for splitting needs
  useEffect(() => {
    if (formData.cargo_volume_m3 && formData.cargo_weight_kg) {
      const volume = parseFloat(formData.cargo_volume_m3);
      const weight = parseFloat(formData.cargo_weight_kg);

      // Calculate price
      if (container.price_per_m3) {
        const pricing = calculateVolumeBasedPrice({
          pricePerM3: container.price_per_m3,
          cargoVolume: volume,
          cargoWeight: weight,
          origin: { city: container.origin_city || container.origin, country: container.origin_country || "Unknown" },
          destination: { city: container.destination_city || container.destination, country: container.destination_country || "Unknown" }
        });
        setEstimatedPrice(pricing.totalPrice);
        setPriceBreakdown(pricing.breakdown);
      }

      // Check if splitting is needed
      const availableVolume = container.available_volume_m3 || container.total_volume_m3;
      const availableWeight = container.available_weight_kg || container.capacity_kg;

      if (volume > availableVolume || weight > availableWeight) {
        // Fetch similar containers for splitting
        fetchSimilarContainers(volume, weight);
      } else {
        setSplitResult(null);
      }

      // Calculate weight balance
      if (formData.cargo_length && formData.cargo_width) {
        const balance = calculateWeightBalance(
          weight,
          parseFloat(formData.cargo_length),
          parseFloat(formData.cargo_width)
        );
        setWeightBalance(balance);
      }
    }
  }, [formData.cargo_volume_m3, formData.cargo_weight_kg, formData.cargo_length, formData.cargo_width, container]);

  const fetchSimilarContainers = async (volume: number, weight: number) => {
    try {
      const { data: containers } = await supabase
        .from("containers")
        .select("*")
        .eq("status", "available")
        .ilike("origin", `%${container.origin}%`)
        .ilike("destination", `%${container.destination}%`)
        .limit(5);

      if (containers) {
        const split = calculateCargoSplit(volume, weight, containers);
        setSplitResult(split);
      }
    } catch (error) {
      console.error("Error fetching containers for split:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check safety validation
    if (safetyValidation && !safetyValidation.isValid) {
      toast.error("Cannot book: Container doesn't meet safety requirements");
      return;
    }

    // Check weight balance
    if (weightBalance && !weightBalance.isSafe) {
      toast.error("Cannot book: Unsafe weight distribution. Please adjust cargo placement or split booking.");
      return;
    }

    setLoading(true);

    try {
      const cargoVolume = parseFloat(formData.cargo_volume_m3);
      const cargoWeight = parseFloat(formData.cargo_weight_kg);

      // Get provider for notification
      const { data: provider } = await supabase
        .from("providers")
        .select("user_id")
        .eq("id", container.provider_id)
        .single();

      const finalPrice = estimatedPrice || container.price_usd;
      const spaceUtilization = (cargoVolume / (container.total_volume_m3 || 1)) * 100;

      const { error } = await supabase.from("bookings").insert({
        booking_number: `BK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        trader_id: traderId,
        container_id: container.id,
        provider_id: container.provider_id,
        cargo_description: formData.cargo_description,
        cargo_category: cargoCategory,
        cargo_weight_kg: cargoWeight,
        booked_volume_m3: cargoVolume,
        booked_weight_kg: cargoWeight,
        price_usd: finalPrice,
        price_per_m3: container.price_per_m3,
        space_utilization_percent: spaceUtilization,
        pickup_date: formData.pickup_date,
        delivery_date: formData.delivery_date,
        pickup_address: formData.pickup_address,
        drop_address: formData.drop_address,
        final_delivery_date: formData.final_delivery_date,
        status: "pending",
        safety_flags: {
          category: cargoCategory,
          validated: true,
          warnings: safetyValidation?.warnings || []
        },
        weight_distribution: weightBalance?.distribution || {}
      });

      if (error) throw error;

      // Create notification for provider
      if (provider) {
        await supabase.from("notifications").insert({
          user_id: provider.user_id,
          type: "booking",
          title: "New Booking Request",
          message: `New booking request for container from ${container.origin} to ${container.destination}`,
          link: "/dashboard/provider/bookings"
        });
      }

      toast.success("Booking submitted successfully!");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Booking error:", error);
      toast.error(error.message || "Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Enhanced Smart Booking</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cargo Category Selection */}
          <Card className="p-4">
            <Label className="text-base font-semibold mb-3 block">Cargo Category</Label>
            <Select value={cargoCategory} onValueChange={(v) => setCargoCategory(v as CargoCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CARGO_CATEGORIES).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {getCategoryLabel(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Safety Validation Alert */}
          {safetyValidation && !safetyValidation.isValid && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold">Safety Requirements Not Met:</div>
                <ul className="list-disc list-inside mt-2">
                  {safetyValidation.violations.map((v: string, i: number) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {safetyValidation && safetyValidation.warnings.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold">Safety Warnings:</div>
                <ul className="list-disc list-inside mt-2">
                  {safetyValidation.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Cargo Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cargo Description *</Label>
              <Textarea
                required
                value={formData.cargo_description}
                onChange={(e) => setFormData({ ...formData, cargo_description: e.target.value })}
              />
            </div>

            <div className="space-y-4">
              <div>
                <Label>Weight (kg) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={formData.cargo_weight_kg}
                  onChange={(e) => setFormData({ ...formData, cargo_weight_kg: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Volume (m³) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={formData.cargo_volume_m3}
                  onChange={(e) => setFormData({ ...formData, cargo_volume_m3: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Dimensions for Weight Balance */}
          <Card className="p-4">
            <Label className="text-base font-semibold mb-3 flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Cargo Dimensions (for weight balance check)
            </Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Length (ft)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.cargo_length}
                  onChange={(e) => setFormData({ ...formData, cargo_length: e.target.value })}
                />
              </div>
              <div>
                <Label>Width (ft)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.cargo_width}
                  onChange={(e) => setFormData({ ...formData, cargo_width: e.target.value })}
                />
              </div>
              <div>
                <Label>Height (ft)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.cargo_height}
                  onChange={(e) => setFormData({ ...formData, cargo_height: e.target.value })}
                />
              </div>
            </div>
          </Card>

          {/* Weight Balance Result */}
          {weightBalance && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Weight Balance Analysis
                </Label>
                <Badge variant={weightBalance.isSafe ? "default" : "destructive"}>
                  {weightBalance.isSafe ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                  Score: {weightBalance.balanceScore}/100
                </Badge>
              </div>
              
              <Progress value={weightBalance.balanceScore} className="mb-4" />

              {weightBalance.warnings.length > 0 && (
                <Alert variant="destructive" className="mb-3">
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {weightBalance.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {weightBalance.suggestions.length > 0 && (
                <div className="text-sm">
                  <div className="font-semibold mb-1">Suggestions:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {weightBalance.suggestions.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* Cargo Split Alert */}
          {splitResult && splitResult.needsSplit && (
            <Card className="p-4 border-orange-500">
              <Label className="text-base font-semibold mb-3 flex items-center gap-2">
                <Package2 className="h-4 w-4" />
                Cargo Split Required
              </Label>
              <p className="text-sm text-muted-foreground mb-3">{splitResult.message}</p>
              
              <div className="space-y-2">
                {splitResult.splits.map((split, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-md">
                    <div>
                      <div className="font-semibold text-sm">{split.containerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {split.allocatedVolume.toFixed(2)} m³ • {split.allocatedWeight.toFixed(0)} kg
                      </div>
                    </div>
                    <Badge>{split.percentage.toFixed(0)}%</Badge>
                  </div>
                ))}
              </div>
              
              <Separator className="my-3" />
              <div className="flex justify-between text-sm">
                <span>Total Cost:</span>
                <span className="font-bold">${splitResult.totalCost.toFixed(2)}</span>
              </div>
            </Card>
          )}

          {/* Addresses and Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Pickup Address *</Label>
              <Input required value={formData.pickup_address} onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })} />
            </div>
            <div>
              <Label>Delivery Address *</Label>
              <Input required value={formData.drop_address} onChange={(e) => setFormData({ ...formData, drop_address: e.target.value })} />
            </div>
            <div>
              <Label>Pickup Date *</Label>
              <Input type="date" required value={formData.pickup_date} onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })} />
            </div>
            <div>
              <Label>Final Delivery Date *</Label>
              <Input type="date" required value={formData.final_delivery_date} onChange={(e) => setFormData({ ...formData, final_delivery_date: e.target.value })} />
            </div>
          </div>

          {/* Price Estimate */}
          {estimatedPrice && (
            <Card className="p-4 bg-primary/5">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-muted-foreground">Estimated Cost</div>
                  <div className="text-2xl font-bold">${estimatedPrice.toFixed(2)}</div>
                </div>
                {priceBreakdown && (
                  <div className="text-sm text-right">
                    <div>Base: ${priceBreakdown.basePrice.toFixed(2)}</div>
                    {priceBreakdown.surcharges > 0 && <div>Surcharges: ${priceBreakdown.surcharges.toFixed(2)}</div>}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Weather Forecast Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-semibold">Weather Forecast</h3>
            {weatherLoading ? (
              <Card className="p-6">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2">Fetching weather data...</span>
                </div>
              </Card>
            ) : weatherPrediction ? (
              <div className="space-y-4">
                <WeatherWidget prediction={weatherPrediction} />
                {weatherPrediction.routeCheckpoints.length > 0 && (
                  <RouteWeatherMap checkpoints={weatherPrediction.routeCheckpoints} />
                )}
              </div>
            ) : (
              <Card className="p-4 text-center text-muted-foreground">
                Weather data unavailable
              </Card>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || (safetyValidation && !safetyValidation.isValid) || (weightBalance && !weightBalance.isSafe)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Booking
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
