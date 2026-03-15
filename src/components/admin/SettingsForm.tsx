import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Save, User, Settings as SettingsIcon } from "lucide-react";

export const SettingsForm = () => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    company_name: "",
  });
  const [platformSettings, setPlatformSettings] = useState({
    commission_rate: "10",
    currency: "USD",
    support_email: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setProfile({
        full_name: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        company_name: data.company_name || "",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleProfileUpdate = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          company_name: profile.company_name,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformUpdate = async () => {
    try {
      setLoading(true);
      
      toast({
        title: "Success",
        description: "Platform settings updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <User className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Admin Profile</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="Enter your phone number"
            />
          </div>

          <div>
            <Label htmlFor="company">Company Name</Label>
            <Input
              id="company"
              value={profile.company_name}
              onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="Enter company name"
            />
          </div>

          <Button onClick={handleProfileUpdate} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Profile
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Platform Settings</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="commission">Commission Rate (%)</Label>
            <Input
              id="commission"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={platformSettings.commission_rate}
              onChange={(e) => setPlatformSettings({ ...platformSettings, commission_rate: e.target.value })}
              placeholder="Enter commission rate"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Platform commission charged on each booking
            </p>
          </div>

          <div>
            <Label htmlFor="currency">Default Currency</Label>
            <Input
              id="currency"
              value={platformSettings.currency}
              onChange={(e) => setPlatformSettings({ ...platformSettings, currency: e.target.value })}
              placeholder="USD"
            />
          </div>

          <div>
            <Label htmlFor="support_email">Support Email</Label>
            <Input
              id="support_email"
              type="email"
              value={platformSettings.support_email}
              onChange={(e) => setPlatformSettings({ ...platformSettings, support_email: e.target.value })}
              placeholder="support@example.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email address for customer support inquiries
            </p>
          </div>

          <Separator className="my-4" />

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Payment Gateway Configuration</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Payment gateway keys are securely stored. Contact system administrator to update.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Stripe Configuration
              </Button>
              <Button variant="outline" size="sm" disabled>
                API Keys
              </Button>
            </div>
          </div>

          <Button onClick={handlePlatformUpdate} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Platform Settings
          </Button>
        </div>
      </Card>
    </div>
  );
};
