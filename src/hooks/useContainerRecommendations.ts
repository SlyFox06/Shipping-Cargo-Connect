import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecommendationParams {
  cargoWeight: number;
  cargoVolume: number;
  origin: string;
  destination: string;
  budget?: number;
  deliveryDeadline?: string;
  containers: any[];
}

interface Recommendation {
  index: number;
  score: number;
  reason: string;
  container: any;
}

export const useContainerRecommendations = () => {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const getRecommendations = async (params: RecommendationParams) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('recommend-containers', {
        body: params
      });

      if (error) {
        if (error.message.includes('429')) {
          toast.error('Rate limit exceeded. Please try again in a moment.');
        } else if (error.message.includes('402')) {
          toast.error('AI service temporarily unavailable. Using basic recommendations.');
        } else {
          throw error;
        }
        return [];
      }

      setRecommendations(data.recommendations || []);
      return data.recommendations || [];
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      toast.error('Failed to get AI recommendations. Using smart match instead.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { recommendations, loading, getRecommendations };
};
