import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { ProviderRouteForm } from "./ProviderRouteForm";

interface EditContainerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  container: any;
  isProviderVerified: boolean;
}

export const EditContainerModal = ({ open, onClose, onSuccess, container, isProviderVerified }: EditContainerModalProps) => {
  const [loading, setLoading] = useState(false);
  const [routeConfig, setRouteConfig] = useState({
    origin: container?.origin || "",
    destination: container?.destination || "",
    departureDate: container?.departure_date || "",
    arrivalDate: container?.arrival_date || ""
  });

  const form = useForm({
    defaultValues: {
      origin: container?.origin || "",
      destination: container?.destination || "",
      departure_date: container?.departure_date || "",
      arrival_date: container?.arrival_date || ""
    }
  });

  const [formData, setFormData] = useState({
    container_type: container?.container_type || "",
    capacity_kg: String(container?.capacity_kg || ""),
    length_ft: String(container?.length_ft || ""),
    width_ft: String(container?.width_ft || ""),
    height_ft: String(container?.height_ft || ""),
    base_rate_per_sqft: "10.00",
    price_usd: String(container?.price_per_m3 || ""),
    description: container?.description || "",
    transport_mode: container?.transport_mode || "sea",
    currency: container?.currency || "USD",
    total_volume_m3: String(container?.total_volume_m3 || "")
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !isProviderVerified) {
      toast.error("Account under review.");
      return;
    }
    if (!newOpen) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("containers")
        .update({
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
          currency: formData.currency,
          total_volume_m3: parseFloat(formData.total_volume_m3),
          total_weight_capacity_kg: parseFloat(formData.capacity_kg)
        })
        .eq("id", container.id);

      if (error) throw error;
      toast.success("Container updated!");
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
            Edit Container
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
               <Label>Price (USD)</Label>
               <Input value={formData.price_usd} onChange={e => setFormData({...formData, price_usd:e.target.value})} />
            </div>
          </div>

          <div className="flex justify-end gap-3">
             <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
             <Button type="submit" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Save Changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
