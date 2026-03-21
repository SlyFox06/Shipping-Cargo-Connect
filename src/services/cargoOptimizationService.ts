/**
 * AI Cargo Optimization Service
 * Uses a structured prompt template with rule-based AI logic to optimally
 * split cargo across available containers.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CargoItem {
  name: string;
  weightKg: number;
  volumeCBM: number;
  category: 'electronics' | 'perishables' | 'textiles' | 'machinery' | 'chemicals' | 'fragile' | 'high_value' | 'oversized' | 'general';
  isDangerousGoods?: boolean;
  isFragile?: boolean;
  isPerishable?: boolean;
}

export interface AvailableContainer {
  id: string;
  containerType: string;
  origin: string;
  destination: string;
  maxWeightKg: number;
  maxVolumeCBM: number;
  pricePerCBM: number;
  departureDate?: string;
  arrivalDate?: string;
  hasReefer?: boolean;
  hasHazmat?: boolean;
  hasFragileHandling?: boolean;
}

export interface ContainerAllocation {
  containerId: string;
  containerType: string;
  items: string[];
  totalWeightKg: number;
  totalCBM: number;
  utilizationPercent: number;
  warnings: string[];
}

export interface OptimizationResult {
  splits: ContainerAllocation[];
  unallocated: string[];
  costEstimate: number;
  savingsVsSingleContainer: number;
  recommendation: string;
  success: boolean;
}

// ─── Compatibility Rules ──────────────────────────────────────────────────────
const INCOMPATIBLE_PAIRS: [string, string][] = [
  ['chemicals', 'perishables'],
  ['chemicals', 'electronics'],
  ['chemicals', 'food'],
  ['chemicals', 'textiles'],
  ['oversized', 'fragile'],
];

const DG_CATEGORIES = ['chemicals'];

function areCategoriesCompatible(a: string, b: string): boolean {
  return !INCOMPATIBLE_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

function getCategoryWarnings(items: CargoItem[], container: AvailableContainer): string[] {
  const warnings: string[] = [];

  const hasDG = items.some(i => i.isDangerousGoods || DG_CATEGORIES.includes(i.category));
  const hasFragile = items.some(i => i.isFragile || i.category === 'fragile');
  const hasPerishable = items.some(i => i.isPerishable || i.category === 'perishables');
  const hasChemicals = items.some(i => i.category === 'chemicals');
  const hasFood = items.some(i => i.category === 'perishables');

  if (hasDG && !container.hasHazmat) {
    warnings.push('⚠️ Dangerous Goods detected — container must be hazmat-certified');
  }
  if (hasPerishable && !container.hasReefer) {
    warnings.push('🌡️ Perishable cargo requires a refrigerated (reefer) container');
  }
  if (hasFragile && !container.hasFragileHandling) {
    warnings.push('📦 Fragile items — ensure fragile handling is arranged');
  }
  if (hasChemicals && hasFood) {
    warnings.push('🚫 Chemicals and food cannot be stored in the same container');
  }

  // Check for incompatible category pairs within the item list
  const categories = [...new Set(items.map(i => i.category))];
  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      if (!areCategoriesCompatible(categories[i], categories[j])) {
        warnings.push(`⚠️ Incompatible cargo types: ${categories[i]} and ${categories[j]}`);
      }
    }
  }

  return warnings;
}

// ─── Core Optimizer ───────────────────────────────────────────────────────────
export function optimizeCargo(
  cargoItems: CargoItem[],
  availableContainers: AvailableContainer[],
  origin: string,
  destination: string
): OptimizationResult {
  // 0. Filter containers strictly by route
  const relevantContainers = availableContainers.filter(
    c => c.origin.toLowerCase() === origin.toLowerCase() && 
         c.destination.toLowerCase() === destination.toLowerCase()
  );

  if (relevantContainers.length === 0) {
    return {
      splits: [],
      unallocated: cargoItems.map(i => i.name),
      costEstimate: 0,
      savingsVsSingleContainer: 0,
      recommendation: "No containers found matching this specific route.",
      success: false
    };
  }

  // 1. Separate DG / perishables first — they need dedicated containers
  const dgItems = cargoItems.filter(i => i.isDangerousGoods || i.category === 'chemicals');
  const reeferItems = cargoItems.filter(i => i.isPerishable || i.category === 'perishables');
  const fragileItems = cargoItems.filter(i => i.isFragile || i.category === 'fragile');
  const generalItems = cargoItems.filter(
    i => !dgItems.includes(i) && !reeferItems.includes(i)
  );

  // Sort containers by cost efficiency (cheapest per CBM first)
  const sorted = [...relevantContainers].sort(
    (a, b) => a.pricePerCBM - b.pricePerCBM
  );

  const allocations: ContainerAllocation[] = [];
  const unallocated: string[] = [];

  // Helper: try to pack a group of items into suitable containers
  const packGroup = (group: CargoItem[], filter?: (c: AvailableContainer) => boolean) => {
    const suitable = filter ? sorted.filter(filter) : sorted;
    const usedCapacity: Record<string, { usedWeight: number; usedVolume: number; items: CargoItem[] }> = {};

    // Initialize capacity tracking
    suitable.forEach(c => {
      usedCapacity[c.id] = { usedWeight: 0, usedVolume: 0, items: [] };
    });

    // Also include already-started allocations
    allocations.forEach(a => {
      if (!usedCapacity[a.containerId]) {
        const cont = sorted.find(c => c.id === a.containerId);
        if (cont) {
          usedCapacity[a.containerId] = {
            usedWeight: a.totalWeightKg,
            usedVolume: a.totalCBM,
            items: []
          };
        }
      } else {
        usedCapacity[a.containerId].usedWeight += a.totalWeightKg;
        usedCapacity[a.containerId].usedVolume += a.totalCBM;
      }
    });

    for (const item of group) {
      let placed = false;
      for (const container of suitable) {
        const cap = usedCapacity[container.id];
        const remainWeight = container.maxWeightKg - cap.usedWeight;
        const remainVolume = container.maxVolumeCBM - cap.usedVolume;

        if (item.weightKg <= remainWeight && item.volumeCBM <= remainVolume) {
          cap.usedWeight += item.weightKg;
          cap.usedVolume += item.volumeCBM;
          cap.items.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) unallocated.push(item.name);
    }

    // Build allocations from used capacity
    Object.entries(usedCapacity).forEach(([containerId, cap]) => {
      if (cap.items.length === 0) return;
      const container = sorted.find(c => c.id === containerId)!;
      const existingIdx = allocations.findIndex(a => a.containerId === containerId);
      const allItemsInContainer = [...cap.items];
      const warnings = getCategoryWarnings(allItemsInContainer, container);
      const totalWeight = cap.usedWeight;
      const totalVolume = cap.usedVolume;
      const utilization = Math.min(100, Math.round(
        Math.max(totalVolume / container.maxVolumeCBM, totalWeight / container.maxWeightKg) * 100
      ));

      if (existingIdx >= 0) {
        allocations[existingIdx].items.push(...cap.items.map(i => i.name));
        allocations[existingIdx].totalWeightKg = totalWeight;
        allocations[existingIdx].totalCBM = totalVolume;
        allocations[existingIdx].utilizationPercent = utilization;
        allocations[existingIdx].warnings = [...new Set([...allocations[existingIdx].warnings, ...warnings])];
      } else {
        allocations.push({
          containerId,
          containerType: container.containerType,
          items: cap.items.map(i => i.name),
          totalWeightKg: totalWeight,
          totalCBM: totalVolume,
          utilizationPercent: utilization,
          warnings
        });
      }
    });
  };

  // Pack in priority order: DG → Reefer → Fragile → General
  if (dgItems.length) packGroup(dgItems, c => !!c.hasHazmat);
  if (reeferItems.length) packGroup(reeferItems, c => !!c.hasReefer);
  if (fragileItems.length) packGroup(fragileItems);
  if (generalItems.length) packGroup(generalItems);

  // 2. Cost calculation
  const costEstimate = allocations.reduce((sum, alloc) => {
    const container = availableContainers.find(c => c.id === alloc.containerId);
    return sum + (container ? alloc.totalCBM * container.pricePerCBM : 0);
  }, 0);

  // 3. What would single-container cost look like?
  const totalCBM = cargoItems.reduce((s, i) => s + i.volumeCBM, 0);
  const cheapestContainer = sorted[0];
  const singleContainerCost = cheapestContainer
    ? totalCBM * cheapestContainer.pricePerCBM * 1.25 // 25% premium for oversize
    : costEstimate * 1.25;

  const savings = Math.max(0, singleContainerCost - costEstimate);

  // 4. Recommendation text
  let recommendation = '';
  if (unallocated.length > 0) {
    recommendation = `${unallocated.length} item(s) could not be allocated — consider adding more container capacity.`;
  } else if (allocations.length === 1) {
    recommendation = `All cargo fits in a single container with ${allocations[0].utilizationPercent}% utilization — optimal!`;
  } else {
    const avgUtil = Math.round(
      allocations.reduce((s, a) => s + a.utilizationPercent, 0) / allocations.length
    );
    recommendation = `Cargo split across ${allocations.length} containers (avg ${avgUtil}% utilization), saving ~$${savings.toFixed(0)} vs single oversized booking.`;
  }

  return {
    splits: allocations,
    unallocated,
    costEstimate: Math.round(costEstimate * 100) / 100,
    savingsVsSingleContainer: Math.round(savings * 100) / 100,
    recommendation,
    success: unallocated.length === 0
  };
}

/**
 * Converts raw form/DB container data to the optimizer format
 */
export function toOptimizerContainer(c: any): AvailableContainer {
  return {
    id: c.id,
    containerType: c.container_type || 'standard',
    origin: c.origin,
    destination: c.destination,
    maxWeightKg: c.capacity_kg || c.available_weight_kg || 25000,
    maxVolumeCBM: c.total_volume_m3 || c.available_volume_m3 || 67,
    pricePerCBM: c.price_per_m3 || (c.price_usd / (c.total_volume_m3 || 67)),
    departureDate: c.departure_date,
    arrivalDate: c.arrival_date,
    hasReefer: c.container_type?.includes('refrigerated'),
    hasHazmat: c.hazmat_approved || false,
    hasFragileHandling: c.fragile_handling || false,
  };
}

/**
 * AI Optimizer (Claude Mode)
 * Calls the Supabase Edge Function which uses Anthropic Claude 3.5 Sonnet
 * for deep logistics reasoning.
 */
export async function optimizeCargoAI(
  cargoItems: CargoItem[],
  availableContainers: AvailableContainer[],
  origin: string,
  destination: string
): Promise<OptimizationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('route-optimize', {
      body: { cargoItems, containers: availableContainers, origin, destination },
    });

    if (error) throw error;
    return { ...data, success: true };
  } catch (error: any) {
    console.error('Claude optimization error:', error);
    // Fallback to local optimization if AI fails
    const localResult = optimizeCargo(cargoItems, availableContainers, origin, destination);
    return {
      ...localResult,
      recommendation: `⚠️ AI Suggestion failed (using rule-based fallback): ${localResult.recommendation}`,
    };
  }
}
