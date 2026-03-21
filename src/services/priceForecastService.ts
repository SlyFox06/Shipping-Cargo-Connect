import { supabase } from "@/integrations/supabase/client";

export interface ForecastData {
  date: string;
  predictedPrice: number;
  confidenceLower: number;
  confidenceUpper: number;
  isHistorical: boolean;
}

export const priceForecastService = {
  async getForecastForRoute(origin: string, destination: string): Promise<ForecastData[]> {
    try {
      // 1. Fetch historical booking data for this route
      const { data: historicalBookings, error } = await supabase
        .from("bookings")
        .select(`
          price_usd,
          created_at,
          containers!inner (
            origin,
            destination
          )
        `)
        .eq("containers.origin", origin)
        .eq("containers.destination", destination)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // 2. Process historical data (simplified trend analysis)
      const mockHistory: ForecastData[] = (historicalBookings || []).map(b => ({
        date: new Date(b.created_at).toISOString().split('T')[0],
        predictedPrice: Number(b.price_usd),
        confidenceLower: Number(b.price_usd) * 0.95,
        confidenceUpper: Number(b.price_usd) * 1.05,
        isHistorical: true
      }));

      // 3. Generate future predictions (30 days)
      const lastPrice = mockHistory.length > 0 
        ? mockHistory[mockHistory.length - 1].predictedPrice 
        : 1200; // Default fallback
      
      const futureForecast: ForecastData[] = [];
      const today = new Date();
      
      for (let i = 1; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // Simple seasonal + random drift model for the prototype
        const drift = Math.sin(i / 5) * 50; 
        const randomness = (Math.random() - 0.5) * 30;
        const predicted = lastPrice + drift + randomness;
        
        futureForecast.push({
          date: date.toISOString().split('T')[0],
          predictedPrice: Math.round(predicted),
          confidenceLower: Math.round(predicted * 0.9),
          confidenceUpper: Math.round(predicted * 1.1),
          isHistorical: false
        });
      }

      return [...mockHistory.slice(-10), ...futureForecast];
    } catch (error) {
      console.error("Forecast error:", error);
      return []; // Return empty on error
    }
  }
};
