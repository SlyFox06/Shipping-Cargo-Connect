import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProviderLayout from "@/components/layout/ProviderLayout";
import { Card } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";

const Earnings = () => {
  const navigate = useNavigate();

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
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    <ProviderLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Earnings</h1>
          <p className="text-muted-foreground mt-1">Track revenue and payout schedules</p>
        </div>

        <Card className="p-12 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
          <div className="text-center text-muted-foreground">
            <DollarSign className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Earnings Dashboard Coming Soon</p>
            <p className="text-sm mt-2">View earnings, pending payouts, and transaction history</p>
          </div>
        </Card>
      </div>
    </ProviderLayout>
  );
};

export default Earnings;
