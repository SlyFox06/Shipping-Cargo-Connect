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
import { ProviderRouteForm } from "./ProviderRouteForm";
import { useForm } from "react-hook-form";

interface AddContainerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  providerId: string;
  isProviderVerified: boolean;
}

export const AddContainerModal = ({ open, onClose, onSuccess, providerId, isProviderVerified }: AddContainerModalProps) => {
  const [loading, setLoading] = useState(false);
  const [routeConfig, setRouteConfig] = useState({
    origin: "",
    destination: "",
    departureDate: "",
    arrivalDate: ""
  });

  const form = useForm({
    defaultValues: {
      origin: "",
      destination: "",
      departure_date: "",
      arrival_date: "",
    }
  });

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
    total_volume_m3: ""
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !isProviderVerified) {
      toast.error("Your provider account is under review.");
      return;
    }
    if (!newOpen) onClose();
  };

  useEffect(() => {
    const length = parseFloat(formData.length_ft);
    const width = parseFloat(formData.width_ft);
    const height = parseFloat(formData.height_ft);
    const rate = parseFloat(formData.base_rate_per_sqft);
    
    if (length && width && height) {
      const volume_m3 = (length * width * height * 0.0283168).toFixed(2);
      setFormData(prev => ({ ...prev, total_volume_m3: volume_m3 }));
    }
    
    if (length && width && rate) {
      const price = (length * width * rate).toFixed(2);
      setFormData(prev => ({ ...prev, price_usd: price }));
    }
  }, [formData.length_ft, formData.width_ft, formData.height_ft, formData.base_rate_per_sqft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("containers").insert({
        provider_id: providerId,
        container_type: formData.container_type as any,
        origin: routeConfig.origin,
        destination: routeConfig.destination,
        departure_date: routeConfig.departureDate,
        arrival_date: routeConfig.arrivalDate,
        capacity_kg: parseFloat(formData.capacity_kg),
        length_ft: parseFloat(formData.length_ft),
        width_ft: parseFloat(formData.width_ft),
        height_ft: parseFloat(formData.height_ft),
        price_per_m3: parseFloat(formData.price_usd),
        description: formData.description,
        transport_mode: formData.transport_mode as any,
        status: "active",
        currency: formData.currency,
        total_volume_m3: parseFloat(formData.total_volume_m3),
        available_volume_m3: parseFloat(formData.total_volume_m3),
        total_weight_capacity_kg: parseFloat(formData.capacity_kg),
        available_weight_kg: parseFloat(formData.capacity_kg),
      });

      if (error) throw error;
      toast.success("Container added!");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Add New Container
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8">
          <ProviderRouteForm form={form} onRouteChange={setRouteConfig} disabled={!isProviderVerified || loading} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Transport Mode</Label>
              <Select value={formData.transport_mode} onValueChange={v => setFormData({...formData, transport_mode:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sea">Sea</SelectItem>
                  <SelectItem value="air">Air</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Container Type</Label>
              <Select value={formData.container_type} onValueChange={v => setFormData({...formData, container_type:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard_20">20ft Standard</SelectItem>
                  <SelectItem value="standard_40">40ft Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
             <Input placeholder="Length (ft)" value={formData.length_ft} onChange={e => setFormData({...formData, length_ft:e.target.value})} />
             <Input placeholder="Width (ft)" value={formData.width_ft} onChange={e => setFormData({...formData, width_ft:e.target.value})} />
             <Input placeholder="Height (ft)" value={formData.height_ft} onChange={e => setFormData({...formData, height_ft:e.target.value})} />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Add Container"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
