import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import ProviderLayout from "@/components/layout/ProviderLayout";
import TraderLayout from "@/components/layout/TraderLayout";
import { Card } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";

const CommonSettings = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role: userRole } = await getUserRole(session.user.id);
      setRole(userRole || null);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  const content = (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Account settings and preferences</p>
      </div>

      <Card className="p-12 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
        <div className="text-center text-muted-foreground">
          <SettingsIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Settings Coming Soon</p>
          <p className="text-sm mt-2">Profile settings, notifications, and account preferences</p>
        </div>
      </Card>
    </div>
  );

  if (loading) return null;

  if (role === 'admin') {
    return <AdminLayout>{content}</AdminLayout>;
  } else if (role === 'provider') {
    return <ProviderLayout>{content}</ProviderLayout>;
  } else {
    return <TraderLayout>{content}</TraderLayout>;
  }
};

export default CommonSettings;
