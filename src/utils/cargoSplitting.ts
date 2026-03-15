export interface CargoSplit {
  containerId: string;
  containerName: string;
  allocatedVolume: number;
  allocatedWeight: number;
  percentage: number;
  estimatedCost: number;
}

export interface SplitResult {
  needsSplit: boolean;
  splits: CargoSplit[];
  totalContainers: number;
  totalCost: number;
  message: string;
}

export const calculateCargoSplit = (
  requestedVolume: number,
  requestedWeight: number,
  availableContainers: any[]
): SplitResult => {
  // Sort containers by best space efficiency
  const sortedContainers = [...availableContainers].sort((a, b) => {
    const efficiencyA = (a.available_volume_m3 / a.price_usd) * (a.performance_score || 1);
    const efficiencyB = (b.available_volume_m3 / b.price_usd) * (b.performance_score || 1);
    return efficiencyB - efficiencyA;
  });

  // Check if single container is sufficient
  const singleContainer = sortedContainers.find(
    c => c.available_volume_m3 >= requestedVolume && c.available_weight_kg >= requestedWeight
  );

  if (singleContainer) {
    return {
      needsSplit: false,
      splits: [{
        containerId: singleContainer.id,
        containerName: `${singleContainer.origin} → ${singleContainer.destination}`,
        allocatedVolume: requestedVolume,
        allocatedWeight: requestedWeight,
        percentage: 100,
        estimatedCost: (requestedVolume * (singleContainer.price_per_m3 || singleContainer.price_usd))
      }],
      totalContainers: 1,
      totalCost: requestedVolume * (singleContainer.price_per_m3 || singleContainer.price_usd),
      message: 'Your cargo fits in a single container'
    };
  }

  // Need to split - use greedy algorithm
  let remainingVolume = requestedVolume;
  let remainingWeight = requestedWeight;
  const splits: CargoSplit[] = [];
  let totalCost = 0;

  for (const container of sortedContainers) {
    if (remainingVolume <= 0 && remainingWeight <= 0) break;

    const allocatedVolume = Math.min(remainingVolume, container.available_volume_m3);
    const allocatedWeight = Math.min(remainingWeight, container.available_weight_kg);

    // Check if this container can actually hold the cargo
    const volumeRatio = allocatedVolume / container.available_volume_m3;
    const weightRatio = allocatedWeight / container.available_weight_kg;
    const canFit = volumeRatio <= 1 && weightRatio <= 1;

    if (!canFit) continue;

    const actualVolume = Math.min(allocatedVolume, allocatedWeight / (requestedWeight / requestedVolume));
    const actualWeight = Math.min(allocatedWeight, allocatedVolume * (requestedWeight / requestedVolume));

    const cost = actualVolume * (container.price_per_m3 || container.price_usd / container.total_volume_m3);

    splits.push({
      containerId: container.id,
      containerName: `${container.container_type} - ${container.origin} → ${container.destination}`,
      allocatedVolume: actualVolume,
      allocatedWeight: actualWeight,
      percentage: (actualVolume / requestedVolume) * 100,
      estimatedCost: cost
    });

    totalCost += cost;
    remainingVolume -= actualVolume;
    remainingWeight -= actualWeight;
  }

  const allFits = remainingVolume <= 0 && remainingWeight <= 0;

  return {
    needsSplit: true,
    splits,
    totalContainers: splits.length,
    totalCost,
    message: allFits 
      ? `Your cargo will be split across ${splits.length} containers for optimal space utilization`
      : `⚠️ Unable to fit all cargo in available containers. Consider reducing volume or adding more containers.`
  };
};
