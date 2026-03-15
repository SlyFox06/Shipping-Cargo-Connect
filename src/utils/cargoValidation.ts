export const CARGO_CATEGORIES = {
  ELECTRONICS: 'electronics',
  PERISHABLES: 'perishables',
  TEXTILES: 'textiles',
  MACHINERY: 'machinery',
  CHEMICALS: 'chemicals',
  FRAGILE: 'fragile',
  HIGH_VALUE: 'high_value',
  OVERSIZED: 'oversized'
} as const;

export type CargoCategory = typeof CARGO_CATEGORIES[keyof typeof CARGO_CATEGORIES];

export interface SafetyRequirement {
  requiresHazmat: boolean;
  requiresReefer: boolean;
  requiresFragileHandling: boolean;
  requiresInsurance: boolean;
  maxDimensions?: { length: number; width: number; height: number };
  minValue?: number;
}

export const CARGO_SAFETY_RULES: Record<CargoCategory, SafetyRequirement> = {
  [CARGO_CATEGORIES.ELECTRONICS]: {
    requiresHazmat: false,
    requiresReefer: false,
    requiresFragileHandling: true,
    requiresInsurance: true,
    minValue: 5000
  },
  [CARGO_CATEGORIES.PERISHABLES]: {
    requiresHazmat: false,
    requiresReefer: true,
    requiresFragileHandling: false,
    requiresInsurance: false
  },
  [CARGO_CATEGORIES.TEXTILES]: {
    requiresHazmat: false,
    requiresReefer: false,
    requiresFragileHandling: false,
    requiresInsurance: false
  },
  [CARGO_CATEGORIES.MACHINERY]: {
    requiresHazmat: false,
    requiresReefer: false,
    requiresFragileHandling: false,
    requiresInsurance: true,
    minValue: 10000
  },
  [CARGO_CATEGORIES.CHEMICALS]: {
    requiresHazmat: true,
    requiresReefer: false,
    requiresFragileHandling: true,
    requiresInsurance: true
  },
  [CARGO_CATEGORIES.FRAGILE]: {
    requiresHazmat: false,
    requiresReefer: false,
    requiresFragileHandling: true,
    requiresInsurance: true
  },
  [CARGO_CATEGORIES.HIGH_VALUE]: {
    requiresHazmat: false,
    requiresReefer: false,
    requiresFragileHandling: true,
    requiresInsurance: true,
    minValue: 50000
  },
  [CARGO_CATEGORIES.OVERSIZED]: {
    requiresHazmat: false,
    requiresReefer: false,
    requiresFragileHandling: false,
    requiresInsurance: true,
    maxDimensions: { length: 40, width: 8, height: 8 }
  }
};

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  warnings: string[];
  recommendedContainers?: string[];
}

export const validateCargoSafety = (
  cargoCategory: CargoCategory,
  container: any
): ValidationResult => {
  const rules = CARGO_SAFETY_RULES[cargoCategory];
  const violations: string[] = [];
  const warnings: string[] = [];

  // Check hazmat
  if (rules.requiresHazmat && !container.hazmat_approved) {
    violations.push('This cargo requires a hazmat-approved container');
  }

  // Check reefer (refrigerated)
  if (rules.requiresReefer) {
    const isReefer = container.container_type?.includes('refrigerated');
    if (!isReefer) {
      violations.push('Perishable cargo requires a refrigerated container');
    }
  }

  // Check fragile handling
  if (rules.requiresFragileHandling && !container.fragile_handling) {
    warnings.push('Fragile cargo recommended for containers with fragile handling capability');
  }

  // Check insurance
  if (rules.requiresInsurance && !container.insurance_available) {
    warnings.push('Insurance recommended for this cargo type');
  }

  return {
    isValid: violations.length === 0,
    violations,
    warnings
  };
};

export const getCategoryLabel = (category: CargoCategory): string => {
  const labels: Record<CargoCategory, string> = {
    electronics: 'Electronics',
    perishables: 'Perishables',
    textiles: 'Textiles',
    machinery: 'Machinery',
    chemicals: 'Chemicals / Hazardous',
    fragile: 'Fragile Items',
    high_value: 'High-Value Goods',
    oversized: 'Oversized Cargo'
  };
  return labels[category];
};
