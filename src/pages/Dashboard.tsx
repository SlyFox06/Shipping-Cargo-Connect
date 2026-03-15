import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole, signOut } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      const { role, error } = await getUserRole(session.user.id);

      if (error || !role) {
        // Sign out to prevent an infinite redirect loop, then send to auth
        await signOut();
        toast({
          title: "Account setup incomplete",
          description: "Your account profile was not found. Please sign up again.",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      // Redirect based on role
      switch (role) {
        case 'provider':
          navigate('/dashboard/provider');
          break;
        case 'trader':
          navigate('/dashboard/trader');
          break;
        case 'admin':
          navigate('/dashboard/admin');
          break;
        default:
          await signOut();
          navigate('/auth');
      }
    };

    checkUserAndRedirect();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  );
};

export default Dashboard;
