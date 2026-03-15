export interface WeightDistribution {
  leftSideWeight: number;
  rightSideWeight: number;
  frontWeight: number;
  rearWeight: number;
  centerOfGravityX: number;
  centerOfGravityY: number;
}

export interface BalanceResult {
  isSafe: boolean;
  distribution: WeightDistribution;
  warnings: string[];
  suggestions: string[];
  balanceScore: number; // 0-100
}

export const calculateWeightBalance = (
  cargoWeight: number,
  cargoLength: number,
  cargoWidth: number,
  containerLength: number = 40, // Default 40ft container
  containerWidth: number = 8,   // Default 8ft width
  existingCargo: Array<{ weight: number; x: number; y: number }> = []
): BalanceResult => {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Calculate center of gravity for new cargo (assuming center placement)
  const newCargoX = containerLength / 2;
  const newCargoY = containerWidth / 2;

  // Calculate total weight distribution including existing cargo
  let totalWeight = cargoWeight;
  let totalMomentX = cargoWeight * newCargoX;
  let totalMomentY = cargoWeight * newCargoY;

  existingCargo.forEach(cargo => {
    totalWeight += cargo.weight;
    totalMomentX += cargo.weight * cargo.x;
    totalMomentY += cargo.weight * cargo.y;
  });

  const centerOfGravityX = totalMomentX / totalWeight;
  const centerOfGravityY = totalMomentY / totalWeight;

  // Calculate side weights (simplified model)
  const leftSideWeight = totalWeight * (containerWidth - centerOfGravityY) / containerWidth;
  const rightSideWeight = totalWeight * centerOfGravityY / containerWidth;
  const frontWeight = totalWeight * (containerLength - centerOfGravityX) / containerLength;
  const rearWeight = totalWeight * centerOfGravityX / containerLength;

  // Safety checks
  const lateralImbalance = Math.abs(leftSideWeight - rightSideWeight) / totalWeight;
  const longitudinalImbalance = Math.abs(frontWeight - rearWeight) / totalWeight;

  const distribution: WeightDistribution = {
    leftSideWeight,
    rightSideWeight,
    frontWeight,
    rearWeight,
    centerOfGravityX,
    centerOfGravityY
  };

  // Check for dangerous imbalances (>15% difference)
  if (lateralImbalance > 0.15) {
    warnings.push('⚠️ Unsafe lateral weight distribution detected');
    suggestions.push('Reposition cargo to balance left and right sides');
  }

  if (longitudinalImbalance > 0.15) {
    warnings.push('⚠️ Unsafe front-to-rear weight distribution');
    suggestions.push('Adjust cargo position along the length of the container');
  }

  // Check center of gravity position
  const cgOffsetX = Math.abs(centerOfGravityX - containerLength / 2);
  const cgOffsetY = Math.abs(centerOfGravityY - containerWidth / 2);

  if (cgOffsetX > containerLength * 0.2) {
    warnings.push('⚠️ Center of gravity too far from container center (longitudinal)');
    suggestions.push('Move heavy items toward the center of the container');
  }

  if (cgOffsetY > containerWidth * 0.2) {
    warnings.push('⚠️ Center of gravity too far from container center (lateral)');
    suggestions.push('Balance weight distribution across the width');
  }

  // Calculate balance score (0-100)
  const lateralScore = Math.max(0, 100 - lateralImbalance * 500);
  const longitudinalScore = Math.max(0, 100 - longitudinalImbalance * 500);
  const cgScore = Math.max(0, 100 - (cgOffsetX / containerLength + cgOffsetY / containerWidth) * 100);
  const balanceScore = (lateralScore + longitudinalScore + cgScore) / 3;

  const isSafe = warnings.length === 0 && balanceScore >= 70;

  if (!isSafe && suggestions.length === 0) {
    suggestions.push('Consider splitting cargo across multiple containers');
    suggestions.push('Use counter-balancing materials to stabilize load');
  }

  return {
    isSafe,
    distribution,
    warnings,
    suggestions,
    balanceScore: Math.round(balanceScore)
  };
};
