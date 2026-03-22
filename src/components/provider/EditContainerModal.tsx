import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Box, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { ProviderRouteForm, type RouteConfig } from "./ProviderRouteForm";

interface EditContainerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  container: any;
  isProviderVerified: boolean;
}

export const EditContainerModal = ({ open, onClose, onSuccess, container, isProviderVerified }: EditContainerModalProps) => {

  const [loading, setLoading] = useState(false);
  const [routeConfig, setRouteConfig] = useState<RouteConfig | null>(null);
  const form = useForm();


  const [formData, setFormData] = useState({
    container_type: "",
    capacity_kg: "",
    length_ft: "",
    width_ft: "",
    height_ft: "",
    base_rate_per_sqft: "",
    price_usd: "",
    description: "",
    transport_mode: "sea",
    currency: "USD",
    total_volume_m3: "",
  });

  // Initialize form with container data
  useEffect(() => {
    if (container && open) {
      setFormData({
        container_type: container.container_type || "",
        capacity_kg: container.capacity_kg?.toString() || "",
        length_ft: container.length_ft?.toString() || "",
        width_ft: container.width_ft?.toString() || "",
        height_ft: container.height_ft?.toString() || "",
        base_rate_per_sqft: container.base_rate_per_sqft?.toString() || "10.00",
        price_usd: container.price_usd?.toString() || "",
        description: container.description || "",
        transport_mode: container.transport_mode || "sea",
        currency: container.currency || "USD",
        total_volume_m3: container.total_volume_m3?.toString() || "",
      });

      // Also set initial route config if needed, though ProviderRouteForm handles initialData prop
    }
  }, [container, open]);

  // Auto-calculate price and volume based on dimensions
  useEffect(() => {
    const length = parseFloat(formData.length_ft);
    const width = parseFloat(formData.width_ft);
    const height = parseFloat(formData.height_ft);
    const rate = parseFloat(formData.base_rate_per_sqft);
    
    if (length && width && height) {
      const length_m = length * 0.3048;
      const width_m = width * 0.3048;
      const height_m = height * 0.3048;
      const volume_m3 = (length_m * width_m * height_m).toFixed(2);
      setFormData(prev => ({ ...prev, total_volume_m3: volume_m3 }));
    }
    
    if (length && width && rate) {
      const sqft = length * width;
      const price = (sqft * rate).toFixed(2);
      setFormData(prev => ({ ...prev, price_usd: price }));
    }
  }, [formData.length_ft, formData.width_ft, formData.height_ft, formData.base_rate_per_sqft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProviderVerified) {
      toast.error("Your provider account must be verified to edit containers");
      return;
    }
    if (!routeConfig) {
      toast.error("Route configuration is required");
      return;
    }

    setLoading(true);

    try {
      const volumeM3 = parseFloat(formData.total_volume_m3);
      
      const { error } = await supabase
        .from("containers")
        .update({
          container_type: formData.container_type as any,
          origin: routeConfig.origin,
          origin_city: routeConfig.origin.split(',')[0]?.trim(),
          origin_country: routeConfig.origin.split(',')[1]?.trim() || routeConfig.origin,
          destination: routeConfig.destination,
          destination_city: routeConfig.destination.split(',')[0]?.trim(),
          destination_country: routeConfig.destination.split(',')[1]?.trim() || routeConfig.destination,
          available_from: routeConfig.departureDate,
          available_until: routeConfig.arrivalDate,
          capacity_kg: parseFloat(formData.capacity_kg),
          length_ft: parseFloat(formData.length_ft),
          width_ft: parseFloat(formData.width_ft),
          height_ft: parseFloat(formData.height_ft),
          base_rate_per_sqft: parseFloat(formData.base_rate_per_sqft),
          price_usd: parseFloat(formData.price_usd),
          description: formData.description,
          transport_mode: formData.transport_mode as any,
          currency: formData.currency,
          total_volume_m3: volumeM3,
          total_weight_capacity_kg: parseFloat(formData.capacity_kg),
          cargo_type: routeConfig.cargoTypesAllowed?.[0] || 'general',
        })
        .eq("id", container.id);

      if (error) throw error;

      toast.success("Container updated successfully!");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update container");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-secondary/20 bg-card/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-secondary" />
            Edit Container Lifecycle
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="p-1 bg-gradient-to-br from-secondary/20 via-transparent to-primary/20 rounded-2xl">
            <div className="bg-card p-6 rounded-[14px]">
              <ProviderRouteForm 
                form={form}
                initialData={{
                  origin: container?.origin,
                  destination: container?.destination,
                  cargoTypesAllowed: container?.cargo_type ? [container.cargo_type] : ["general"],
                  departureDate: container?.available_from,
                  arrivalDate: container?.available_until,
                  transitPorts: [],
                }}
                onRouteChange={setRouteConfig}
                disabled={!isProviderVerified || loading}
              />

            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-secondary" />
              <h3 className="font-bold text-sm uppercase tracking-wider">Specifications & Global Pricing</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Transport Mode *</Label>
                <Select 
                  value={formData.transport_mode} 
                  onValueChange={(value) => setFormData({ ...formData, transport_mode: value })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sea">🚢 Sea</SelectItem>
                    <SelectItem value="air">✈️ Air</SelectItem>
                    <SelectItem value="rail">🚂 Rail</SelectItem>
                    <SelectItem value="road">🚛 Road</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Container Type *</Label>
                <Select 
                  value={formData.container_type} 
                  onValueChange={(value) => setFormData({ ...formData, container_type: value })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard_20">20ft Standard</SelectItem>
                    <SelectItem value="standard_40">40ft Standard</SelectItem>
                    <SelectItem value="high_cube_40">40ft High Cube</SelectItem>
                    <SelectItem value="refrigerated_20">20ft Refrigerated</SelectItem>
                    <SelectItem value="refrigerated_40">40ft Refrigerated</SelectItem>
                    <SelectItem value="open_top">Open Top</SelectItem>
                    <SelectItem value="flat_rack">Flat Rack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Length (ft)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.length_ft}
                  onChange={(e) => setFormData({ ...formData, length_ft: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label>Width (ft)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.width_ft}
                  onChange={(e) => setFormData({ ...formData, width_ft: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label>Height (ft)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.height_ft}
                  onChange={(e) => setFormData({ ...formData, height_ft: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label>Max Weight Capacity (kg)</Label>
                <Input
                  type="number"
                  value={formData.capacity_kg}
                  onChange={(e) => setFormData({ ...formData, capacity_kg: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Badge variant="secondary" className="mb-2 w-full justify-center gap-2 py-2 border-dashed border-secondary/40">
                  <Box className="h-3 w-3" />
                  Total Volume: {formData.total_volume_m3 || '0.00'} m³
                </Badge>
              </div>
            </div>

            <div className="p-4 bg-muted/20 rounded-xl border border-secondary/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    <DollarSign className="h-3 w-3" /> Currency
                  </Label>
                  <Select value={formData.currency} onValueChange={(v) => setFormData({...formData, currency: v})}>
                    <SelectTrigger className="h-10 bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">🇺🇸 USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">🇪🇺 EUR - Euro</SelectItem>
                      <SelectItem value="INR">🇮🇳 INR - Indian Rupee</SelectItem>
                      <SelectItem value="AED">🇦🇪 AED - UAE Dirham</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">AI Estimation Result</Label>
                  <div className="h-10 flex items-center justify-between px-4 bg-secondary/10 rounded-lg text-secondary border border-secondary/30">
                    <span className="text-xs font-medium">Updated Total</span>
                    <span className="font-black">{formData.currency} {formData.price_usd}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description & Terminal Notes</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Update container details or special requirements..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <Button variant="ghost" onClick={onClose} disabled={loading} className="px-8 font-medium">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !isProviderVerified}
              className="px-12 bg-gradient-to-r from-secondary to-primary hover:shadow-lg hover:shadow-secondary/20 transition-all font-bold group"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <>
                  Save Changes
                  <Sparkles className="ml-2 h-4 w-4 group-hover:rotate-12 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
