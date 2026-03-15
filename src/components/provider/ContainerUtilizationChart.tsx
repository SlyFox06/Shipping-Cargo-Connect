import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Package, TrendingUp, AlertCircle } from "lucide-react";

interface ContainerUtilizationChartProps {
  containers: any[];
}

export const ContainerUtilizationChart = ({ containers }: ContainerUtilizationChartProps) => {
  const totalContainers = containers.length;
  const fullyBooked = containers.filter(c => (c.utilization_rate || 0) >= 100).length;
  const partiallyBooked = containers.filter(c => (c.utilization_rate || 0) > 0 && (c.utilization_rate || 0) < 100).length;
  const available = containers.filter(c => (c.utilization_rate || 0) === 0).length;
  
  const avgUtilization = containers.length > 0
    ? containers.reduce((sum, c) => sum + (c.utilization_rate || 0), 0) / containers.length
    : 0;

  const highUtilizationContainers = containers.filter(c => (c.utilization_rate || 0) >= 80);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Containers</p>
            <p className="text-3xl font-bold">{totalContainers}</p>
          </div>
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Avg Utilization</p>
            <p className="text-3xl font-bold">{avgUtilization.toFixed(1)}%</p>
          </div>
          <TrendingUp className="h-8 w-8 text-green-500" />
        </div>
        <Progress value={avgUtilization} className="mt-2" />
      </Card>

      <Card className="p-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <div>
          <p className="text-sm text-muted-foreground mb-1">🟢 Available</p>
          <p className="text-2xl font-bold">{available}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalContainers > 0 ? ((available / totalContainers) * 100).toFixed(0) : 0}% of total
          </p>
        </div>
      </Card>

      <Card className="p-6 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
        <div>
          <p className="text-sm text-muted-foreground mb-1">🟡 Partially Booked</p>
          <p className="text-2xl font-bold">{partiallyBooked}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalContainers > 0 ? ((partiallyBooked / totalContainers) * 100).toFixed(0) : 0}% of total
          </p>
        </div>
      </Card>

      {highUtilizationContainers.length > 0 && (
        <Card className="p-6 md:col-span-2 lg:col-span-4 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold mb-1">High Utilization Alert</p>
              <p className="text-sm text-muted-foreground">
                {highUtilizationContainers.length} container{highUtilizationContainers.length > 1 ? 's' : ''} {highUtilizationContainers.length > 1 ? 'are' : 'is'} at or above 80% capacity.
                Consider adding more containers for these routes.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
