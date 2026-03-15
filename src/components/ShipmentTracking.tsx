import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { format } from "date-fns";

interface Milestone {
  id: string;
  milestone: string;
  status: string;
  completed_date: string | null;
  location: string | null;
  notes: string | null;
}

interface ShipmentTrackingProps {
  bookingId: string;
}

const milestoneLabels: Record<string, string> = {
  booking_confirmed: "Booking Confirmed",
  container_assigned: "Container Assigned",
  cargo_loaded: "Cargo Loaded",
  in_transit: "In Transit",
  at_destination_port: "At Destination Port",
  customs_clearance: "Customs Clearance",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

export const ShipmentTracking = ({ bookingId }: ShipmentTrackingProps) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMilestones();

    const channel = supabase
      .channel(`milestones-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shipment_milestones",
          filter: `booking_id=eq.${bookingId}`,
        },
        () => {
          fetchMilestones();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  const fetchMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from("shipment_milestones")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at");

      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      console.error("Error fetching milestones:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">Shipment Timeline</h3>
      
      <div className="space-y-6">
        {milestones.map((milestone, index) => {
          const isCompleted = milestone.status === "completed";
          const isDelayed = milestone.status === "delayed";
          const isPending = milestone.status === "pending";

          return (
            <div key={milestone.id} className="relative">
              {index < milestones.length - 1 && (
                <div
                  className={`absolute left-4 top-8 w-0.5 h-full ${
                    isCompleted ? "bg-success" : "bg-border"
                  }`}
                />
              )}
              
              <div className="flex gap-4">
                <div className="relative">
                  {isCompleted ? (
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  ) : isPending ? (
                    <Circle className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <Clock className="h-8 w-8 text-warning" />
                  )}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      {milestoneLabels[milestone.milestone]}
                    </h4>
                    <Badge
                      variant={
                        isCompleted
                          ? "default"
                          : isDelayed
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {milestone.status}
                    </Badge>
                  </div>
                  
                  {milestone.completed_date && (
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(milestone.completed_date), "PPp")}
                    </p>
                  )}
                  
                  {milestone.location && (
                    <p className="text-sm text-muted-foreground">
                      📍 {milestone.location}
                    </p>
                  )}
                  
                  {milestone.notes && (
                    <p className="text-sm">{milestone.notes}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
