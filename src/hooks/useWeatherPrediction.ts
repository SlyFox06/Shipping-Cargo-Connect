import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RouteCheckpoint {
  name: string;
  lat: number;
  lon: number;
  windSpeed: number;
  waveHeight: number;
  stormProb: number;
  visibility: number;
  rainfall: number;
  temperature: number;
  riskScore: number;
}

export interface WeatherPrediction {
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  predictedDelayHours: number;
  routeCheckpoints: RouteCheckpoint[];
  weatherAlerts: string[];
  safeSailingWindow: {
    recommended: boolean;
    delayRecommendation: string | null;
    bestWindow: string | null;
  };
}

export const useWeatherPrediction = () => {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<WeatherPrediction | null>(null);

  const predictWeather = async (
    origin: string,
    destination: string,
    containerId?: string,
    bookingId?: string,
    departureDate?: string
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('predict-weather', {
        body: {
          origin,
          destination,
          containerId,
          bookingId,
          departureDate,
        },
      });

      if (error) throw error;

      setPrediction(data.prediction);
      return data.prediction;
    } catch (error: any) {
      console.error('Error predicting weather:', error);
      toast.error('Failed to fetch weather prediction');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { prediction, loading, predictWeather };
};
