import { useState, useCallback } from 'react';
import { priceForecastService } from '@/services/priceForecastService';

export interface AIForecastResult {
  min: number;
  max: number;
  recommended: number;
  confidence: "low" | "medium" | "high";
  trend: "rising" | "stable" | "falling";
  peakWarning: boolean;
  reasoning: string;
  breakdown: {
    baseFreight: number;
    fuelSurcharge: number;
    portHandling: number;
    insurance: number;
  };
}

export function useAIPriceForecast() {
  const [result, setResult] = useState<AIForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getForecast = useCallback(async (params: {
    origin: string;
    destination: string;
    cargoType: string;
    weightKg: number;
    cbm: number;
    departureDate: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await priceForecastService.getAIForecast(params);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch AI forecast");
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, getForecast };
}
