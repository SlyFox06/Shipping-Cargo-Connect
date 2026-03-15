import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SavedChart {
  id: string;
  chart_name: string;
  chart_type: string;
  chart_data: any;
  created_at: string;
}

interface SavedChartsListProps {
  userId: string;
  userRole: "trader" | "provider";
}

export const SavedChartsList = ({ userId, userRole }: SavedChartsListProps) => {
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSavedCharts();

    // Real-time subscription
    const channel = supabase
      .channel(`saved-charts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_analytics_charts',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchSavedCharts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchSavedCharts = async () => {
    try {
      const { data, error } = await supabase
        .from("saved_analytics_charts")
        .select("*")
        .eq("user_id", userId)
        .eq("user_role", userRole)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSavedCharts(data || []);
    } catch (error: any) {
      console.error("Error fetching saved charts:", error);
      toast.error("Failed to load saved charts");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (chartId: string) => {
    setDeletingId(chartId);
    
    try {
      const { error } = await supabase
        .from("saved_analytics_charts")
        .delete()
        .eq("id", chartId)
        .eq("user_id", userId); // Extra security check

      if (error) throw error;

      // Update UI immediately
      setSavedCharts(prev => prev.filter(chart => chart.id !== chartId));
      
      toast.success("Chart deleted successfully");
    } catch (error: any) {
      console.error("Error deleting chart:", error);
      toast.error("Failed to delete chart");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
        <CardHeader>
          <CardTitle className="text-foreground">My Saved Charts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (savedCharts.length === 0) {
    return (
      <Card className="bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
        <CardHeader>
          <CardTitle className="text-foreground">My Saved Charts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No saved charts yet</p>
            <p className="text-xs mt-1">Charts you save will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-[0_0_20px_rgba(0,0,0,0.35)]">
      <CardHeader>
        <CardTitle className="text-foreground">My Saved Charts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {savedCharts.map((chart) => (
            <div
              key={chart.id}
              className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1">
                <h4 className="font-medium text-foreground">{chart.chart_name}</h4>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-muted-foreground capitalize">
                    Type: {chart.chart_type.replace(/_/g, ' ')}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(chart.created_at), "MMM dd, yyyy")}
                  </span>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(chart.id)}
                disabled={deletingId === chart.id}
                className="bg-destructive/20 hover:bg-destructive hover:text-destructive-foreground border border-destructive/30 transition-colors"
              >
                {deletingId === chart.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive hover:text-destructive-foreground" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
