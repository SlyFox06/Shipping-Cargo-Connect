import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddContainerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  providerId: string;
  isProviderVerified: boolean;
}

export const AddContainerModal = ({ open, onClose, onSuccess, providerId, isProviderVerified }: AddContainerModalProps) => {
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !isProviderVerified) {
      toast.error("Your provider account is under review. You can add containers once approved by the admin.");
      return;
    }
    if (!newOpen) {
      onClose();
    }
  };
  const [formData, setFormData] = useState({
    container_type: "",
    origin_country: "",
    origin_city: "",
    destination_country: "",
    destination_city: "",
    available_from: "",
    available_until: "",
    capacity_kg: "",
    length_ft: "",
    width_ft: "",
    height_ft: "",
    base_rate_per_sqft: "10.00",
    price_usd: "",
    description: "",
    transport_mode: "sea",
    currency: "USD",
    total_volume_m3: ""
  });

  // Auto-calculate price and volume based on dimensions
  useEffect(() => {
    const length = parseFloat(formData.length_ft);
    const width = parseFloat(formData.width_ft);
    const height = parseFloat(formData.height_ft);
    const rate = parseFloat(formData.base_rate_per_sqft);
    
    // Calculate volume in m³ (ft to m conversion: 1 ft = 0.3048 m)
    if (length && width && height) {
      const length_m = length * 0.3048;
      const width_m = width * 0.3048;
      const height_m = height * 0.3048;
      const volume_m3 = (length_m * width_m * height_m).toFixed(2);
      setFormData(prev => ({ ...prev, total_volume_m3: volume_m3 }));
    }
    
    // Calculate price
    if (length && width && rate) {
      const sqft = length * width;
      const price = (sqft * rate).toFixed(2);
      setFormData(prev => ({ ...prev, price_usd: price }));
    }
  }, [formData.length_ft, formData.width_ft, formData.height_ft, formData.base_rate_per_sqft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const volumeM3 = parseFloat(formData.total_volume_m3);
      
      const { error } = await supabase.from("containers").insert({
        provider_id: providerId,
        container_type: formData.container_type as any,
        origin: `${formData.origin_country}, ${formData.origin_city}`,
        origin_country: formData.origin_country,
        origin_city: formData.origin_city,
        destination: `${formData.destination_country}, ${formData.destination_city}`,
        destination_country: formData.destination_country,
        destination_city: formData.destination_city,
        available_from: formData.available_from,
        available_until: formData.available_until,
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
        available_weight_kg: parseFloat(formData.capacity_kg)
      });

      if (error) throw error;

      toast.success("Container added successfully!");
      onSuccess();
      onClose();
      setFormData({
        container_type: "",
        origin_country: "",
        origin_city: "",
        destination_country: "",
        destination_city: "",
        available_from: "",
        available_until: "",
        capacity_kg: "",
        length_ft: "",
        width_ft: "",
        height_ft: "",
        base_rate_per_sqft: "10.00",
        price_usd: "",
        description: "",
        transport_mode: "sea",
        currency: "USD",
        total_volume_m3: ""
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to add container");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Container</DialogTitle>
        </DialogHeader>
        {!isProviderVerified && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              Your provider account is under review. You can add containers once approved by the admin.
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="transport_mode">Transport Mode *</Label>
                <Select value={formData.transport_mode} onValueChange={(value) => setFormData({ ...formData, transport_mode: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sea">Sea</SelectItem>
                    <SelectItem value="air">Air</SelectItem>
                    <SelectItem value="rail">Rail</SelectItem>
                    <SelectItem value="road">Road</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="container_type">Container Type *</Label>
                <Select value={formData.container_type} onValueChange={(value) => setFormData({ ...formData, container_type: value })}>
                  <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="origin_country">Origin Country *</Label>
                <Input
                  id="origin_country"
                  value={formData.origin_country}
                  onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })}
                  placeholder="e.g. India"
                  required
                  disabled={!isProviderVerified}
                />
              </div>
              <div>
                <Label htmlFor="origin_city">Origin City *</Label>
                <Input
                  id="origin_city"
                  value={formData.origin_city}
                  onChange={(e) => setFormData({ ...formData, origin_city: e.target.value })}
                  placeholder="e.g. Mumbai"
                  required
                  disabled={!isProviderVerified}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="destination_country">Destination Country *</Label>
                <Input
                  id="destination_country"
                  value={formData.destination_country}
                  onChange={(e) => setFormData({ ...formData, destination_country: e.target.value })}
                  placeholder="e.g. UAE"
                  required
                  disabled={!isProviderVerified}
                />
              </div>
              <div>
                <Label htmlFor="destination_city">Destination City *</Label>
                <Input
                  id="destination_city"
                  value={formData.destination_city}
                  onChange={(e) => setFormData({ ...formData, destination_city: e.target.value })}
                  placeholder="e.g. Dubai"
                  required
                  disabled={!isProviderVerified}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="available_from">Departure Date *</Label>
                <Input
                  id="available_from"
                  type="date"
                  value={formData.available_from}
                  onChange={(e) => setFormData({ ...formData, available_from: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="available_until">Arrival Date *</Label>
                <Input
                  id="available_until"
                  type="date"
                  value={formData.available_until}
                  onChange={(e) => setFormData({ ...formData, available_until: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Container Dimensions & Pricing</h3>
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
                  />
                </div>
              </div>
              
              {/* Auto-calculated Volume Display */}
              <div className="mt-4">
                <Label htmlFor="volume_m3">Volume (m³)</Label>
                <Input
                  id="volume_m3"
                  type="text"
                  value={formData.total_volume_m3 || "0.00"}
                  readOnly
                  className="bg-muted"
                  placeholder="Auto-calculated"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically calculated from dimensions
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="currency">Currency *</Label>
                <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">🇺🇸 USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">🇪🇺 EUR - Euro</SelectItem>
                    <SelectItem value="INR">🇮🇳 INR - Indian Rupee</SelectItem>
                    <SelectItem value="GBP">🇬🇧 GBP - British Pound</SelectItem>
                    <SelectItem value="AED">🇦🇪 AED - UAE Dirham</SelectItem>
                    <SelectItem value="CAD">🇨🇦 CAD - Canadian Dollar</SelectItem>
                    <SelectItem value="AUD">🇦🇺 AUD - Australian Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="base_rate_per_sqft">Base Rate per Sq Ft *</Label>
                  <Input
                    id="base_rate_per_sqft"
                    type="number"
                    step="0.01"
                    value={formData.base_rate_per_sqft}
                    onChange={(e) => setFormData({ ...formData, base_rate_per_sqft: e.target.value })}
                    placeholder="e.g. 10.00"
                    required
                    disabled={!isProviderVerified}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cost per square foot in {formData.currency}
                  </p>
                </div>
                <div>
                  <Label htmlFor="price_usd">Total Price ({formData.currency}) *</Label>
                  <Input
                    id="price_usd"
                    type="number"
                    step="0.01"
                    value={formData.price_usd}
                    readOnly
                    className="bg-muted"
                    placeholder="Auto-calculated"
                    required
                    disabled={!isProviderVerified}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.length_ft && formData.width_ft ? 
                      `${(parseFloat(formData.length_ft) * parseFloat(formData.width_ft)).toFixed(1)} sq ft × ${formData.currency} ${formData.base_rate_per_sqft}/sq ft` 
                      : 'Calculated from dimensions'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="capacity_kg">Max Capacity (kg) *</Label>
              <Input
                id="capacity_kg"
                type="number"
                value={formData.capacity_kg}
                onChange={(e) => setFormData({ ...formData, capacity_kg: e.target.value })}
                placeholder="e.g. 25000"
                required
                disabled={!isProviderVerified}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe container features, restrictions..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading || !isProviderVerified}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !isProviderVerified}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Container"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
