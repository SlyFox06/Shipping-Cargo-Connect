import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OptimizedContainer {
  container: any;
  score: number;
  routeReliability: number;
  averageDelay: number;
  utilizationScore: number;
  experienceScore: number;
  reasons: string[];
  badges: Array<'reliable' | 'fastest' | 'optimized'>;
}

export const useRouteOptimization = (origin?: string, destination?: string) => {
  const [optimizedContainers, setOptimizedContainers] = useState<OptimizedContainer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (origin && destination) {
      optimizeRoute();
    }
  }, [origin, destination]);

  const optimizeRoute = async () => {
    if (!origin || !destination) return;
    
    setLoading(true);
    try {
      const routeKey = `${origin}_to_${destination}`;

      // Fetch containers on this route with performance data
      const { data: containers, error } = await supabase
        .from('containers')
        .select(`
          *,
          providers(user_id, verified, rating, total_bookings),
          container_performance!container_performance_container_id_fkey(*)
        `)
        .eq('status', 'available')
        .ilike('origin', `%${origin}%`)
        .ilike('destination', `%${destination}%`);

      if (error) throw error;

      // Calculate optimization scores
      const optimized = containers?.map(container => {
        const performance = (container as any).container_performance?.find(
          (p: any) => p.route_key === routeKey
        );

        // Calculate individual scores
        const routeReliability = performance?.total_bookings > 0
          ? (performance.on_time_deliveries / performance.total_bookings) * 100
          : 50; // Default score for new routes

        const averageDelay = performance?.average_delay_days || 0;
        const delayScore = Math.max(0, 100 - averageDelay * 10);

        const utilizationScore = performance?.utilization_average || container.utilization_rate || 0;
        
        const providerExperience = (container as any).providers?.total_bookings || 0;
        const experienceScore = Math.min(100, providerExperience * 2);

        // Weighted total score
        const totalScore = 
          routeReliability * 0.4 +
          delayScore * 0.3 +
          utilizationScore * 0.15 +
          experienceScore * 0.15;

        // Generate reasons
        const reasons: string[] = [];
        const badges: Array<'reliable' | 'fastest' | 'optimized'> = [];

        if (routeReliability > 90) {
          reasons.push(`${routeReliability.toFixed(0)}% on-time delivery rate on this route`);
          badges.push('reliable');
        }

        if (averageDelay < 1) {
          reasons.push('Historically delivers on or ahead of schedule');
          badges.push('fastest');
        }

        if (utilizationScore > 75) {
          reasons.push('High utilization efficiency on similar bookings');
          badges.push('optimized');
        }

        if (providerExperience > 20) {
          reasons.push(`Provider has ${providerExperience} completed shipments`);
        }

        if (performance?.total_bookings > 0) {
          reasons.push(`${performance.total_bookings} successful shipments on this exact route`);
        }

        return {
          container,
          score: totalScore,
          routeReliability,
          averageDelay,
          utilizationScore,
          experienceScore,
          reasons: reasons.length > 0 ? reasons : ['Good availability and pricing'],
          badges
        };
      }) || [];

      // Sort by score and take top results
      optimized.sort((a, b) => b.score - a.score);
      setOptimizedContainers(optimized);

    } catch (error) {
      console.error('Error optimizing route:', error);
      setOptimizedContainers([]);
    } finally {
      setLoading(false);
    }
  };

  return { optimizedContainers, loading, optimizeRoute };
};
