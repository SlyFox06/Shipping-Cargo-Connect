import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProviderLayout from "@/components/layout/ProviderLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Save, User, Building, Lock } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    company_name: "",
    company_registration: "",
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (role !== 'provider') {
        navigate('/dashboard');
        return;
      }
      await fetchProfile(session.user.id);
    };
    checkAuth();
  }, [navigate]);

  const fetchProfile = async (uid: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, company_name")
        .eq("id", uid)
        .single();

      if (profileError) throw profileError;

      const { data: providerData } = await supabase
        .from("providers")
        .select("company_registration")
        .eq("user_id", uid)
        .single();

      setProfile({
        full_name: profileData.full_name || "",
        email: profileData.email || "",
        phone: profileData.phone || "",
        company_name: profileData.company_name || "",
        company_registration: providerData?.company_registration || "",
      });
    } catch (error: any) {
      toast({
        title: "Error loading profile",
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

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          company_name: profile.company_name,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      const { error: providerError } = await supabase
        .from("providers")
        .update({ company_registration: profile.company_registration })
        .eq("user_id", user.id);

      if (providerError) throw providerError;

      toast({ title: "Success", description: "Profile updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters long", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      toast({ title: "Success", description: "Password updated successfully" });
      setPasswordData({ newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProviderLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and business information</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <User className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Profile Information</h3>
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
                <Input id="email" type="email" value={profile.email} disabled className="bg-muted" />
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
              <Button onClick={handleProfileUpdate} disabled={loading} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Profile
              </Button>
            </div>
          </Card>

          {/* Business Information */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Building className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Business Information</h3>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  value={profile.company_name}
                  onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <Label htmlFor="registration">Company Registration Number</Label>
                <Input
                  id="registration"
                  value={profile.company_registration}
                  onChange={(e) => setProfile({ ...profile, company_registration: e.target.value })}
                  placeholder="Enter registration number"
                />
              </div>
              <Button onClick={handleProfileUpdate} disabled={loading} className="w-full mt-4">
                <Save className="h-4 w-4 mr-2" />
                Save Business Info
              </Button>
            </div>
          </Card>

          {/* Password Change */}
          <Card className="p-6 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <Lock className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Change Password</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
              <div className="md:col-span-2">
                <Button onClick={handlePasswordChange} disabled={loading} className="w-full">
                  <Lock className="h-4 w-4 mr-2" />
                  Update Password
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </ProviderLayout>
  );
};

export default Settings;
