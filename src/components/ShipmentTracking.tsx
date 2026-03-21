import { useEffect, useState } from "react";
import { shipmentService, Milestone } from "@/services/shipmentService";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { format } from "date-fns";

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

interface ShipmentTrackingProps {
  bookingId: string;
}

export const ShipmentTracking = ({ bookingId }: ShipmentTrackingProps) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMilestones = async () => {
      try {
        const data = await shipmentService.getMilestones(bookingId);
        setMilestones(data);
      } catch (error) {
        console.error("Error fetching milestones:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMilestones();

    const unsubscribe = shipmentService.subscribeToMilestones(bookingId, () => {
      fetchMilestones();
    });

    return () => {
      unsubscribe();
    };
  }, [bookingId]);

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
