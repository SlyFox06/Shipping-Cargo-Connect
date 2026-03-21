import { useState, useCallback } from 'react';
import {
  optimizeCargo,
  optimizeCargoAI,
  toOptimizerContainer,
  type CargoItem,
  type OptimizationResult,
} from '@/services/cargoOptimizationService';

interface UseCargoOptimizerResult {
  result: OptimizationResult | null;
  loading: boolean;
  error: string | null;
  optimize: (cargoItems: CargoItem[], containers: any[], origin: string, destination: string, useAI?: boolean) => Promise<void>;
  reset: () => void;
}

export function useCargoOptimizer(): UseCargoOptimizerResult {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimize = useCallback(
    async (cargoItems: CargoItem[], rawContainers: any[], origin: string, destination: string, useAI = false) => {
      setLoading(true);
      setError(null);
      try {
        if (!cargoItems.length) throw new Error('Please add at least one cargo item.');
        if (!rawContainers.length) throw new Error('No containers available to optimize against.');

        const containers = rawContainers.map(toOptimizerContainer);
        
        let optimized;
        if (useAI) {
          optimized = await optimizeCargoAI(cargoItems, containers, origin, destination);
        } else {
          optimized = optimizeCargo(cargoItems, containers, origin, destination);
        }
        
        setResult(optimized);
      } catch (err: any) {
        setError(err.message || 'Optimization failed');
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, optimize, reset };
}
