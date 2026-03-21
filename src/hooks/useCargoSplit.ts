import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CargoItem {
  name: string;
  weightKg: number;
  cbm: number;
  fragile: boolean;
  dangerous: boolean;
  type: 'food' | 'chemical' | 'electronics' | 'textiles' | 'machinery' | 'other';
}

export interface SplitResult {
  splits: Array<{
    containerId: string;
    providerName: string;
    departureDate: string;
    arrivalDate: string;
    items: string[];
    totalWeightKg: number;
    totalCBM: number;
    availableWeightKg: number;
    availableCBM: number;
    utilizationPercent: number;
    priceForSpace: number;
    warnings: string[];
  }>;
  unallocated: string[];
  totalCost: number;
  savingsVsSingleContainer: number;
  containersUsed: number;
  recommendation: string;
}

export function useCargoSplit() {
  const [result, setResult] = useState<SplitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const splitCargo = useCallback(async (
    cargoItems: CargoItem[],
    origin: string,
    destination: string,
    requiredArrivalDate: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("cargo-split", {
        body: { cargoItems, origin, destination, requiredArrivalDate },
      });

      if (error) throw error;
      setResult(data);
      return data;
    } catch (err: any) {
      setError(err.message || "Cargo splitting failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { splitCargo, result, loading, error, reset };
}
