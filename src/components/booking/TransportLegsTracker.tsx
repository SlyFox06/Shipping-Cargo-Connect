import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Truck, Ship, Package, Clock } from "lucide-react";
import { format } from "date-fns";

interface TransportLeg {
  leg_number: number;
  leg_type: string;
  description: string;
  status: string;
  location?: string;
  origin_port?: string;
  destination_port?: string;
  scheduled_date?: string;
  scheduled_departure?: string;
  scheduled_arrival?: string;
  completed_date?: string;
  updated_at: string;
}

interface TransportLegsTrackerProps {
  legs: TransportLeg[];
  showActions?: boolean;
  onUpdateLegStatus?: (legNumber: number, status: string) => void;
}

export const TransportLegsTracker = ({ 
  legs, 
  showActions = false,
  onUpdateLegStatus 
}: TransportLegsTrackerProps) => {
  const getLegIcon = (legType: string, status: string) => {
    const iconClass = status === 'completed' ? "text-green-600" : 
                      status === 'in_progress' ? "text-blue-600" : 
                      "text-gray-400";
    
    switch (legType) {
      case 'pickup_truck':
        return <Truck className={`h-6 w-6 ${iconClass}`} />;
      case 'sea_shipping':
        return <Ship className={`h-6 w-6 ${iconClass}`} />;
      case 'delivery_truck':
        return <Package className={`h-6 w-6 ${iconClass}`} />;
      default:
        return <Circle className={`h-6 w-6 ${iconClass}`} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">✓ Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-600">🔄 In Progress</Badge>;
      case 'pending':
        return <Badge variant="secondary">⏳ Pending</Badge>;
      case 'delayed':
        return <Badge variant="destructive">⚠️ Delayed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const sortedLegs = [...legs].sort((a, b) => a.leg_number - b.leg_number);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">🚚 Transport Journey</h3>
      
      <div className="space-y-4">
        {sortedLegs.map((leg, index) => (
          <Card key={leg.leg_number} className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                {getLegIcon(leg.leg_type, leg.status)}
                {index < sortedLegs.length - 1 && (
                  <div className="w-0.5 h-12 bg-border mt-2" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">
                      Leg {leg.leg_number}: {leg.description}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {leg.leg_type === 'sea_shipping' 
                        ? `${leg.origin_port} → ${leg.destination_port}`
                        : leg.location}
                    </p>
                  </div>
                  {getStatusBadge(leg.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {leg.scheduled_date && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Scheduled: {format(new Date(leg.scheduled_date), "MMM dd, yyyy")}</span>
                    </div>
                  )}
                  {leg.scheduled_departure && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Departure: {format(new Date(leg.scheduled_departure), "MMM dd, yyyy")}</span>
                    </div>
                  )}
                  {leg.scheduled_arrival && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Arrival: {format(new Date(leg.scheduled_arrival), "MMM dd, yyyy")}</span>
                    </div>
                  )}
                  {leg.completed_date && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Completed: {format(new Date(leg.completed_date), "MMM dd, yyyy")}</span>
                    </div>
                  )}
                </div>

                {showActions && leg.status !== 'completed' && onUpdateLegStatus && (
                  <div className="flex gap-2 mt-2">
                    {leg.status === 'pending' && (
                      <button
                        onClick={() => onUpdateLegStatus(leg.leg_number, 'in_progress')}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Start Leg
                      </button>
                    )}
                    {leg.status === 'in_progress' && (
                      <button
                        onClick={() => onUpdateLegStatus(leg.leg_number, 'completed')}
                        className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};