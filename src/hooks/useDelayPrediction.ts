import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DelayPrediction {
  riskScore: 'low' | 'medium' | 'high';
  delayDays: number;
  confidence: number;
  factors: string[];
}

export const useDelayPrediction = () => {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<DelayPrediction | null>(null);

  const predictDelay = async (containerId: string, route: string, departureDate: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('predict-delay', {
        body: { 
          containerId, 
          route,
          departureDate
        }
      });

      if (error) throw error;

      setPrediction(data.prediction);
      return data.prediction;
    } catch (error: any) {
      console.error('Error predicting delay:', error);
      toast.error('Failed to predict delivery delay');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { prediction, loading, predictDelay };
};
