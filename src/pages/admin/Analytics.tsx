import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { AnalyticsCharts } from "@/components/admin/AnalyticsCharts";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";

const Analytics = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (role !== 'admin') {
        navigate('/dashboard');
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground mt-1">Revenue, user growth, and platform metrics</p>
        </div>

        <AnalyticsCharts />
      </div>
    </AdminLayout>
  );
};

export default Analytics;
