import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { ProviderRouteForm, type RouteConfig } from "./ProviderRouteForm";

interface AddContainerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  providerId: string;
  isProviderVerified: boolean;
}

export const AddContainerModal = ({ open, onClose, onSuccess, providerId, isProviderVerified }: AddContainerModalProps) => {
  const [loading, setLoading] = useState(false);
  const [routeConfig, setRouteConfig] = useState<RouteConfig | null>(null);
  const form = useForm();

  
  const [formData, setFormData] = useState({
    container_type: "",
    capacity_kg: "",
    length_ft: "",
    width_ft: "",
    height_ft: "",
    base_rate_per_sqft: "10.00",
    price_usd: "",
    description: "",
    transport_mode: "sea",
    currency: "USD",
    total_volume_m3: "",
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !isProviderVerified) {
      toast.error("Your provider account is under review. You can add containers once approved by the admin.");
      return;
    }
    if (!newOpen) {
      onClose();
    }
  };

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
    if (!routeConfig) {
      toast.error("Please configure the route information");
      return;
    }
    setLoading(true);

    try {
      const volumeM3 = parseFloat(formData.total_volume_m3);
      
      const { error } = await supabase.from("containers").insert({
        provider_id: providerId,
        container_type: formData.container_type as any,
        origin: routeConfig.origin,
        // Helper to extract city/country if format is "City, Country"
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
        status: "available",
        currency: formData.currency,
        total_volume_m3: volumeM3,
        available_volume_m3: volumeM3,
        total_weight_capacity_kg: parseFloat(formData.capacity_kg),
        available_weight_kg: parseFloat(formData.capacity_kg),
        cargo_type: routeConfig.cargoTypesAllowed?.[0] || 'general',
      });

      if (error) throw error;

      toast.success("Container added successfully!");
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        container_type: "",
        capacity_kg: "",
        length_ft: "",
        width_ft: "",
        height_ft: "",
        base_rate_per_sqft: "10.00",
        price_usd: "",
        description: "",
        transport_mode: "sea",
        currency: "USD",
        total_volume_m3: "",
      });

    } catch (error: any) {
      toast.error(error.message || "Failed to add container");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-primary/20 bg-card/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Add New Container Route
          </DialogTitle>
        </DialogHeader>

        {!isProviderVerified && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-destructive font-medium">
              Your provider account is under review. You can add containers once approved.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Route Configuration Component */}
          <div className="p-1 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 rounded-2xl">
            <div className="bg-card p-6 rounded-[14px]">
              <ProviderRouteForm 
                form={form}
                onRouteChange={setRouteConfig}
                disabled={!isProviderVerified || loading}
              />

            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-sm uppercase tracking-wider">Specifications & Pricing</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="transport_mode">Transport Mode *</Label>
                <Select 
                  value={formData.transport_mode} 
                  onValueChange={(value) => setFormData({ ...formData, transport_mode: value })}
                  disabled={!isProviderVerified}
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
              <div>
                <Label htmlFor="container_type">Container Type *</Label>
                <Select 
                  value={formData.container_type} 
                  onValueChange={(value) => setFormData({ ...formData, container_type: value })}
                  disabled={!isProviderVerified}
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
              <div>
                <Label htmlFor="length_ft">Length (ft) *</Label>
                <Input
                  id="length_ft"
                  type="number"
                  step="0.1"
                  value={formData.length_ft}
                  onChange={(e) => setFormData({ ...formData, length_ft: e.target.value })}
                  placeholder="e.g. 20"
                  required
                  disabled={!isProviderVerified}
                  className="h-10"
                />
              </div>
              <div>
                <Label htmlFor="width_ft">Width (ft) *</Label>
                <Input
                  id="width_ft"
                  type="number"
                  step="0.1"
                  value={formData.width_ft}
                  onChange={(e) => setFormData({ ...formData, width_ft: e.target.value })}
                  placeholder="e.g. 8"
                  required
                  disabled={!isProviderVerified}
                  className="h-10"
                />
              </div>
              <div>
                <Label htmlFor="height_ft">Height (ft) *</Label>
                <Input
                  id="height_ft"
                  type="number"
                  step="0.1"
                  value={formData.height_ft}
                  onChange={(e) => setFormData({ ...formData, height_ft: e.target.value })}
                  placeholder="e.g. 8.5"
                  required
                  disabled={!isProviderVerified}
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="capacity_kg">Weight Capacity (kg) *</Label>
                <Input
                  id="capacity_kg"
                  type="number"
                  value={formData.capacity_kg}
                  onChange={(e) => setFormData({ ...formData, capacity_kg: e.target.value })}
                  placeholder="e.g. 25000"
                  required
                  disabled={!isProviderVerified}
                  className="h-10"
                />
              </div>
              <div>
                <Label htmlFor="volume_display">Calculated Volume</Label>
                <Input
                  id="volume_display"
                  value={`${formData.total_volume_m3 || '0.00'} m³`}
                  readOnly
                  disabled
                  className="h-10 bg-muted/50 font-bold"
                />
              </div>
            </div>

            <div className="p-4 bg-muted/20 rounded-xl border border-dashed border-primary/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Pricing Currency</Label>
                  <Select 
                    value={formData.currency} 
                    onValueChange={(v) => setFormData({...formData, currency: v})}
                    disabled={!isProviderVerified}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">🇺🇸 USD - US Dollar</SelectItem>
                      <SelectItem value="AED">🇦🇪 AED - UAE Dirham</SelectItem>
                      <SelectItem value="EUR">🇪🇺 EUR - Euro</SelectItem>
                      <SelectItem value="INR">🇮🇳 INR - Indian Rupee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Rate/SqFt</Label>
                    <Input 
                      type="number" 
                      value={formData.base_rate_per_sqft} 
                      onChange={(e) => setFormData({...formData, base_rate_per_sqft: e.target.value})}
                      className="h-8 text-xs"
                      disabled={!isProviderVerified}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Total (AI Est)</Label>
                    <div className="h-8 flex items-center px-3 bg-primary/10 rounded-md text-primary font-bold text-xs border border-primary/20">
                      {formData.currency} {formData.price_usd}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Public Description & Special Instructions</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="List any special handling equipment, temperature ranges, or route specifics..."
                rows={3}
                disabled={!isProviderVerified}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose} 
              disabled={loading}
              className="px-8"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !isProviderVerified}
              className="px-12 bg-gradient-to-r from-primary to-blue-600 hover:shadow-lg hover:shadow-primary/20 transition-all font-bold group"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Publish Container
                  <Sparkles className="ml-2 h-4 w-4 group-hover:scale-125 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
