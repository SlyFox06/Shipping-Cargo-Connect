import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeatherRequest {
  origin: string;
  destination: string;
  containerId?: string;
  bookingId?: string;
  departureDate?: string;
}

interface RouteCheckpoint {
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

// Major shipping route coordinates
const ROUTE_COORDINATES: Record<string, { lat: number; lon: number }> = {
  // Middle East
  "Dubai": { lat: 25.2048, lon: 55.2708 },
  "Abu Dhabi": { lat: 24.4539, lon: 54.3773 },
  "Jebel Ali": { lat: 25.0198, lon: 55.0275 },
  "Muscat": { lat: 23.5880, lon: 58.3829 },
  
  // India
  "Mumbai": { lat: 19.0760, lon: 72.8777 },
  "Chennai": { lat: 13.0827, lon: 80.2707 },
  "Kolkata": { lat: 22.5726, lon: 88.3639 },
  
  // Asia Pacific
  "Singapore": { lat: 1.3521, lon: 103.8198 },
  "Hong Kong": { lat: 22.3193, lon: 114.1694 },
  "Shanghai": { lat: 31.2304, lon: 121.4737 },
  
  // Sea checkpoints
  "Arabian Sea": { lat: 18.0, lon: 65.0 },
  "Gulf of Oman": { lat: 24.0, lon: 58.0 },
  "Bay of Bengal": { lat: 15.0, lon: 88.0 },
  "South China Sea": { lat: 12.0, lon: 113.0 },
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination, containerId, bookingId, departureDate }: WeatherRequest = await req.json();

    const OPENWEATHER_API_KEY = Deno.env.get("OPENWEATHER_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!OPENWEATHER_API_KEY) {
      throw new Error("OPENWEATHER_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get route checkpoints
    const checkpoints = getRouteCheckpoints(origin, destination);
    const routeWeatherData: RouteCheckpoint[] = [];

    // Fetch weather for each checkpoint
    for (const checkpoint of checkpoints) {
      try {
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${checkpoint.lat}&lon=${checkpoint.lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
        const weatherResponse = await fetch(weatherUrl);
        
        if (!weatherResponse.ok) {
          console.error(`Weather API error for ${checkpoint.name}:`, weatherResponse.status);
          continue;
        }

        const weatherData = await weatherResponse.json();

        // Calculate factors
        const windSpeed = weatherData.wind?.speed * 3.6 || 0; // m/s to km/h
        const windFactor = calculateWindFactor(windSpeed);
        
        // Estimate wave height based on wind speed
        const waveHeight = estimateWaveHeight(windSpeed);
        const waveFactor = calculateWaveFactor(waveHeight);
        
        // Check for storms
        const stormProb = weatherData.weather?.[0]?.main === "Thunderstorm" ? 0.8 : 
                         weatherData.weather?.[0]?.main === "Rain" ? 0.4 : 0.1;
        const stormFactor = stormProb;
        
        const visibility = (weatherData.visibility || 10000) / 1000; // meters to km
        const visibilityFactor = calculateVisibilityFactor(visibility);
        
        const rainfall = weatherData.rain?.["1h"] || 0;
        const rainfallFactor = calculateRainfallFactor(rainfall);
        
        const temperature = weatherData.main?.temp || 25;

        // Calculate checkpoint risk
        const checkpointRisk = (windFactor + waveFactor + stormFactor + visibilityFactor + rainfallFactor) / 5;

        routeWeatherData.push({
          name: checkpoint.name,
          lat: checkpoint.lat,
          lon: checkpoint.lon,
          windSpeed,
          waveHeight,
          stormProb,
          visibility,
          rainfall,
          temperature,
          riskScore: checkpointRisk,
        });
      } catch (error) {
        console.error(`Error fetching weather for ${checkpoint.name}:`, error);
      }
    }

    // Get historical delay factor
    const routeKey = `${origin}_to_${destination}`;
    const { data: perfData } = await supabase
      .from("container_performance")
      .select("average_delay_days")
      .eq("route_key", routeKey)
      .single();

    const historicalDelayFactor = perfData?.average_delay_days 
      ? Math.min(perfData.average_delay_days / 10, 1) 
      : 0.2;

    // Calculate overall risk score
    const avgRouteRisk = routeWeatherData.reduce((sum, cp) => sum + cp.riskScore, 0) / routeWeatherData.length;
    const overallRiskScore = (avgRouteRisk * 0.7 + historicalDelayFactor * 0.3);

    // Determine risk level
    let riskLevel: "low" | "medium" | "high";
    if (overallRiskScore < 0.3) riskLevel = "low";
    else if (overallRiskScore < 0.7) riskLevel = "medium";
    else riskLevel = "high";

    // Predict delay hours
    const predictedDelayHours = Math.round(overallRiskScore * 72); // 0-72 hours

    // Generate weather alerts
    const weatherAlerts: string[] = [];
    routeWeatherData.forEach(cp => {
      if (cp.windSpeed > 60) weatherAlerts.push(`⚠️ High winds at ${cp.name}: ${cp.windSpeed.toFixed(0)} km/h`);
      if (cp.waveHeight > 4) weatherAlerts.push(`🌊 High waves at ${cp.name}: ${cp.waveHeight.toFixed(1)}m`);
      if (cp.stormProb > 0.5) weatherAlerts.push(`⛈️ Storm warning at ${cp.name}`);
      if (cp.visibility < 2) weatherAlerts.push(`🌫️ Low visibility at ${cp.name}: ${cp.visibility.toFixed(1)}km`);
    });

    // Calculate safe sailing window
    const safeSailingWindow = {
      recommended: riskLevel === "low",
      delayRecommendation: riskLevel === "high" ? "Consider delaying 24-48 hours" : null,
      bestWindow: riskLevel === "medium" ? "Monitor conditions closely" : null,
    };

    // Store prediction in database
    const prediction = {
      booking_id: bookingId || null,
      container_id: containerId || null,
      route_key: routeKey,
      wind_speed_kmh: routeWeatherData[0]?.windSpeed || 0,
      wave_height_m: routeWeatherData[0]?.waveHeight || 0,
      storm_probability: routeWeatherData[0]?.stormProb || 0,
      visibility_km: routeWeatherData[0]?.visibility || 10,
      rainfall_mm: routeWeatherData[0]?.rainfall || 0,
      temperature_c: routeWeatherData[0]?.temperature || 25,
      wind_factor: routeWeatherData[0] ? calculateWindFactor(routeWeatherData[0].windSpeed) : 0,
      wave_factor: routeWeatherData[0] ? calculateWaveFactor(routeWeatherData[0].waveHeight) : 0,
      storm_factor: routeWeatherData[0]?.stormProb || 0,
      visibility_factor: routeWeatherData[0] ? calculateVisibilityFactor(routeWeatherData[0].visibility) : 0,
      rainfall_factor: routeWeatherData[0] ? calculateRainfallFactor(routeWeatherData[0].rainfall) : 0,
      historical_delay_factor: historicalDelayFactor,
      overall_risk_score: overallRiskScore,
      risk_level: riskLevel,
      predicted_delay_hours: predictedDelayHours,
      route_checkpoints: routeWeatherData,
      weather_alerts: weatherAlerts,
      safe_sailing_window: safeSailingWindow,
    };

    await supabase.from("weather_predictions").insert(prediction);

    return new Response(
      JSON.stringify({
        success: true,
        prediction: {
          riskLevel,
          riskScore: overallRiskScore,
          predictedDelayHours,
          routeCheckpoints: routeWeatherData,
          weatherAlerts,
          safeSailingWindow,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Weather prediction error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

// Helper functions
function getRouteCheckpoints(origin: string, destination: string): Array<{ name: string; lat: number; lon: number }> {
  const checkpoints: Array<{ name: string; lat: number; lon: number }> = [];
  
  // Add origin
  if (ROUTE_COORDINATES[origin]) {
    checkpoints.push({ name: origin, ...ROUTE_COORDINATES[origin] });
  }
  
  // Add intermediate sea checkpoints based on route
  if (origin.includes("Dubai") || origin.includes("Abu Dhabi")) {
    checkpoints.push({ name: "Gulf of Oman", ...ROUTE_COORDINATES["Gulf of Oman"] });
    checkpoints.push({ name: "Arabian Sea", ...ROUTE_COORDINATES["Arabian Sea"] });
  }
  
  if (destination.includes("Mumbai") || destination.includes("India")) {
    checkpoints.push({ name: "Arabian Sea", ...ROUTE_COORDINATES["Arabian Sea"] });
  }
  
  if (destination.includes("Singapore") || destination.includes("China")) {
    checkpoints.push({ name: "Bay of Bengal", ...ROUTE_COORDINATES["Bay of Bengal"] });
    checkpoints.push({ name: "South China Sea", ...ROUTE_COORDINATES["South China Sea"] });
  }
  
  // Add destination
  if (ROUTE_COORDINATES[destination]) {
    checkpoints.push({ name: destination, ...ROUTE_COORDINATES[destination] });
  }
  
  return checkpoints;
}

function calculateWindFactor(windSpeedKmh: number): number {
  if (windSpeedKmh < 20) return 0.1;
  if (windSpeedKmh < 40) return 0.3;
  if (windSpeedKmh < 60) return 0.6;
  return 0.9;
}

function calculateWaveFactor(waveHeightM: number): number {
  if (waveHeightM < 1) return 0.1;
  if (waveHeightM < 2) return 0.3;
  if (waveHeightM < 4) return 0.6;
  return 0.9;
}

function calculateVisibilityFactor(visibilityKm: number): number {
  if (visibilityKm > 10) return 0.1;
  if (visibilityKm > 5) return 0.3;
  if (visibilityKm > 2) return 0.6;
  return 0.9;
}

function calculateRainfallFactor(rainfallMm: number): number {
  if (rainfallMm < 2) return 0.1;
  if (rainfallMm < 10) return 0.3;
  if (rainfallMm < 20) return 0.6;
  return 0.9;
}

function estimateWaveHeight(windSpeedKmh: number): number {
  // Simplified wave height estimation based on wind speed
  // Real-world calculations would be more complex
  if (windSpeedKmh < 20) return 0.5;
  if (windSpeedKmh < 40) return 1.5;
  if (windSpeedKmh < 60) return 3.0;
  return 5.0;
}

serve(handler);
