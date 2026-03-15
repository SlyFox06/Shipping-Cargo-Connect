import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProviderLayout from "@/components/layout/ProviderLayout";
import TraderLayout from "@/components/layout/TraderLayout";
import { ProviderAnalytics } from "@/components/provider/ProviderAnalytics";
import { TraderAnalytics } from "@/components/trader/TraderAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";

const CommonAnalytics = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      
      setUserId(session.user.id);
      
      const { role: userRole } = await getUserRole(session.user.id);
      if (userRole === 'admin') {
        navigate('/dashboard/admin/analytics');
        return;
      }
      setRole(userRole || null);

      // Get provider ID if user is a provider
      if (userRole === 'provider') {
        const { data: providerData } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', session.user.id)
          .single();
        
        if (providerData) {
          setProviderId(providerData.id);
        }
      }

      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  if (loading) return null;

  const content = (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          {role === 'provider' ? 'Performance metrics and revenue analytics' : 'Spending trends and booking analytics'}
        </p>
      </div>

      {role === 'provider' && providerId ? (
        <ProviderAnalytics providerId={providerId} userId={userId} />
      ) : role === 'trader' ? (
        <TraderAnalytics userId={userId} />
      ) : (
        <div className="text-center text-muted-foreground py-12">
          <p>Analytics available for providers and traders only</p>
        </div>
      )}
    </div>
  );

  if (role === 'provider') {
    return <ProviderLayout>{content}</ProviderLayout>;
  } else {
    return <TraderLayout>{content}</TraderLayout>;
  }
};

export default CommonAnalytics;
