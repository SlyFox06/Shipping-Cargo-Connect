import { CheckCircle2, Circle, Truck, Package } from "lucide-react";

interface BookingProgressProps {
  status: string;
}

export const BookingProgress = ({ status }: BookingProgressProps) => {
  const steps = [
    { key: "pending", label: "Pending", icon: Circle },
    { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
    { key: "in_transit", label: "In Transit", icon: Truck },
    { key: "delivered", label: "Delivered", icon: Package }
  ];

  const statusOrder = ["pending", "confirmed", "in_transit", "delivered"];
  const currentIndex = statusOrder.indexOf(status);

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
          />
        </div>

        {/* Steps */}
        {steps.map((step, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                } ${isCurrent ? "ring-4 ring-primary/20 scale-110" : ""}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={`text-xs mt-2 font-medium ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
