// Dynamic pricing calculation utilities

interface Location {
  city: string;
  country: string;
}

interface ContainerSpecs {
  length_ft: number;
  width_ft: number;
  height_ft: number;
  base_rate_per_sqft: number;
  price_per_m3?: number;
}

interface PricingParams {
  containerSize: ContainerSpecs;
  cargoWeight: number; // in kg
  cargoVolume?: number; // in m³
  origin: Location;
  destination: Location;
}

interface VolumePricingParams {
  pricePerM3: number;
  cargoVolume: number; // in m³
  cargoWeight: number; // in kg
  origin: Location;
  destination: Location;
}

// Approximate distance calculation using Haversine formula
// This is a simplified version - in production, you'd use a geocoding API
const cityCoordinates: { [key: string]: { lat: number; lng: number } } = {
  // Major cities (add more as needed)
  "Mumbai, India": { lat: 19.0760, lng: 72.8777 },
  "Delhi, India": { lat: 28.7041, lng: 77.1025 },
  "Shanghai, China": { lat: 31.2304, lng: 121.4737 },
  "Singapore, Singapore": { lat: 1.3521, lng: 103.8198 },
  "Dubai, UAE": { lat: 25.2048, lng: 55.2708 },
  "London, UK": { lat: 51.5074, lng: -0.1278 },
  "New York, USA": { lat: 40.7128, lng: -74.0060 },
  "Los Angeles, USA": { lat: 34.0522, lng: -118.2437 },
  "Sydney, Australia": { lat: -33.8688, lng: 151.2093 },
  "Tokyo, Japan": { lat: 35.6762, lng: 139.6503 },
};

function getCoordinates(city: string, country: string): { lat: number; lng: number } | null {
  const key = `${city}, ${country}`;
  return cityCoordinates[key] || null;
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export function calculateDynamicPrice(params: PricingParams & { 
  utilizationRate?: number; 
  demandMultiplier?: number 
}): {
  totalPrice: number;
  breakdown: {
    sizeCharge: number;
    weightCharge: number;
    distanceCharge: number;
    utilizationAdjustment: number;
    demandAdjustment: number;
  };
  distanceKm: number;
} {
  const { containerSize, cargoWeight, origin, destination, utilizationRate = 0, demandMultiplier = 1.0 } = params;

  // Calculate container area (sq ft)
  const containerArea = containerSize.length_ft * containerSize.width_ft;
  const baseSizeCharge = containerArea * containerSize.base_rate_per_sqft;

  // Weight charge: $2 per kg
  const weightMultiplier = 2;
  const baseWeightCharge = cargoWeight * weightMultiplier;

  // Distance charge: Get coordinates and calculate distance
  let distanceKm = 0;
  let baseDistanceCharge = 0;

  const originCoords = getCoordinates(origin.city, origin.country);
  const destCoords = getCoordinates(destination.city, destination.country);

  if (originCoords && destCoords) {
    distanceKm = calculateDistance(
      originCoords.lat,
      originCoords.lng,
      destCoords.lat,
      destCoords.lng
    );
    // Distance multiplier: $1.5 per km (with a minimum of 100km)
    const effectiveDistance = Math.max(distanceKm, 100);
    baseDistanceCharge = effectiveDistance * 1.5;
  } else {
    // Fallback: use a flat rate if coordinates not found
    baseDistanceCharge = 500; // Default distance charge
    distanceKm = 333; // Implied ~333km
  }

  // Dynamic pricing adjustments
  // Utilization discount: Higher utilization = lower price (encourage shared containers)
  // 0-30% utilization: no discount
  // 30-60% utilization: 5% discount
  // 60-80% utilization: 10% discount
  // 80-95% utilization: 15% discount
  let utilizationDiscount = 0;
  if (utilizationRate >= 80) {
    utilizationDiscount = 0.15;
  } else if (utilizationRate >= 60) {
    utilizationDiscount = 0.10;
  } else if (utilizationRate >= 30) {
    utilizationDiscount = 0.05;
  }

  // Demand surge pricing: Routes with high demand get higher prices
  // demandMultiplier typically ranges from 0.8 (low demand) to 1.5 (high demand)
  const demandAdjustment = (demandMultiplier - 1.0);

  // Apply adjustments
  const utilizationAdjustmentAmount = -(baseSizeCharge + baseWeightCharge + baseDistanceCharge) * utilizationDiscount;
  const demandAdjustmentAmount = (baseSizeCharge + baseWeightCharge + baseDistanceCharge) * demandAdjustment;

  const sizeCharge = baseSizeCharge;
  const weightCharge = baseWeightCharge;
  const distanceCharge = baseDistanceCharge;

  const totalPrice = Math.round(
    sizeCharge + weightCharge + distanceCharge + utilizationAdjustmentAmount + demandAdjustmentAmount
  );

  return {
    totalPrice: Math.max(totalPrice, 100), // Minimum price of $100
    breakdown: {
      sizeCharge: Math.round(sizeCharge),
      weightCharge: Math.round(weightCharge),
      distanceCharge: Math.round(distanceCharge),
      utilizationAdjustment: Math.round(utilizationAdjustmentAmount),
      demandAdjustment: Math.round(demandAdjustmentAmount),
    },
    distanceKm: Math.round(distanceKm),
  };
}

// Calculate price based on volume usage (for shared containers)
export function calculateVolumeBasedPrice(params: VolumePricingParams): {
  totalPrice: number;
  breakdown: {
    volumeCharge: number;
    weightCharge: number;
    distanceCharge: number;
  };
  distanceKm: number;
} {
  const { pricePerM3, cargoVolume, cargoWeight, origin, destination } = params;

  // Volume charge: price per m³
  const volumeCharge = cargoVolume * pricePerM3;

  // Weight charge: $0.5 per kg (reduced for shared containers)
  const weightMultiplier = 0.5;
  const weightCharge = cargoWeight * weightMultiplier;

  // Distance charge calculation
  let distanceKm = 0;
  let distanceCharge = 0;

  const originCoords = getCoordinates(origin.city, origin.country);
  const destCoords = getCoordinates(destination.city, destination.country);

  if (originCoords && destCoords) {
    distanceKm = calculateDistance(
      originCoords.lat,
      originCoords.lng,
      destCoords.lat,
      destCoords.lng
    );
    // Distance multiplier: $0.5 per km per m³ (proportional to space used)
    const effectiveDistance = Math.max(distanceKm, 100);
    distanceCharge = effectiveDistance * 0.5 * cargoVolume;
  } else {
    // Fallback: proportional distance charge
    distanceCharge = 200 * cargoVolume;
    distanceKm = 333;
  }

  const totalPrice = Math.round(volumeCharge + weightCharge + distanceCharge);

  return {
    totalPrice,
    breakdown: {
      volumeCharge: Math.round(volumeCharge),
      weightCharge: Math.round(weightCharge),
      distanceCharge: Math.round(distanceCharge),
    },
    distanceKm: Math.round(distanceKm),
  };
}

export function formatPriceBreakdown(breakdown: {
  sizeCharge: number;
  weightCharge: number;
  distanceCharge: number;
}): string {
  return `Container Size: $${breakdown.sizeCharge} + Weight: $${breakdown.weightCharge} + Distance: $${breakdown.distanceCharge}`;
}

export function formatVolumePriceBreakdown(breakdown: {
  volumeCharge: number;
  weightCharge: number;
  distanceCharge: number;
}): string {
  return `Volume: $${breakdown.volumeCharge} + Weight: $${breakdown.weightCharge} + Distance: $${breakdown.distanceCharge}`;
}
