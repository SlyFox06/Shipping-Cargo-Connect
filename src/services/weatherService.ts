// src/services/weatherService.ts
// Unified weather service using WeatherAPI.com (forecasts) + Storm Glass (marine data)

const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY
const STORMGLASS_KEY  = import.meta.env.VITE_STORMGLASS_API_KEY

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CurrentWeather {
  city: string
  country: string
  temp_c: number
  feels_like_c: number
  humidity: number
  wind_kph: number
  wind_dir: string
  pressure_mb: number
  visibility_km: number
  uv: number
  condition: string
  condition_icon: string
  is_day: number
}

export interface ForecastDay {
  date: string          // "2025-03-23"
  max_c: number
  min_c: number
  avg_c: number
  rain_mm: number
  rain_chance: number
  wind_kph: number
  humidity: number
  condition: string
  condition_icon: string
  uv: number
}

export interface MarineData {
  wave_height_m: number
  wave_period_s: number
  wind_speed_ms: number
  wind_dir_deg: number
  air_temp_c: number
  pressure_mb: number
  visibility_km: number
}

export interface PortWeather {
  current: CurrentWeather
  forecast: ForecastDay[]   // 7 days
  marine?: MarineData
}

// ─── WeatherAPI helpers ───────────────────────────────────────────────────────
export async function fetchPortWeather(city: string, days = 7): Promise<PortWeather | null> {
  if (!WEATHER_API_KEY) {
    console.warn("VITE_WEATHER_API_KEY not set — falling back to wttr.in")
    return fetchWttrFallback(city)
  }
  try {
    const res = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(city)}&days=${days}&aqi=no&alerts=no`
    )
    if (!res.ok) throw new Error(`WeatherAPI ${res.status}`)
    const d = await res.json()

    const current: CurrentWeather = {
      city:           d.location.name,
      country:        d.location.country,
      temp_c:         d.current.temp_c,
      feels_like_c:   d.current.feelslike_c,
      humidity:       d.current.humidity,
      wind_kph:       d.current.wind_kph,
      wind_dir:       d.current.wind_dir,
      pressure_mb:    d.current.pressure_mb,
      visibility_km:  d.current.vis_km,
      uv:             d.current.uv,
      condition:      d.current.condition.text,
      condition_icon: "https:" + d.current.condition.icon,
      is_day:         d.current.is_day,
    }

    const forecast: ForecastDay[] = (d.forecast?.forecastday ?? []).map((fd: any) => ({
      date:          fd.date,
      max_c:         fd.day.maxtemp_c,
      min_c:         fd.day.mintemp_c,
      avg_c:         fd.day.avgtemp_c,
      rain_mm:       fd.day.totalprecip_mm,
      rain_chance:   fd.day.daily_chance_of_rain,
      wind_kph:      fd.day.maxwind_kph,
      humidity:      fd.day.avghumidity,
      condition:     fd.day.condition.text,
      condition_icon:"https:" + fd.day.condition.icon,
      uv:            fd.day.uv,
    }))

    return { current, forecast }
  } catch (e) {
    console.error("WeatherAPI fetch failed:", e)
    return fetchWttrFallback(city)
  }
}

// ─── Storm Glass marine data ──────────────────────────────────────────────────
// Requires lat/lng — we geocode via WeatherAPI first
export async function fetchMarineData(city: string): Promise<MarineData | null> {
  if (!STORMGLASS_KEY || !WEATHER_API_KEY) return null
  try {
    // Step 1: geocode
    const geo = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(city)}&aqi=no`
    )
    if (!geo.ok) return null
    const gd = await geo.json()
    const lat = gd.location.lat
    const lng = gd.location.lon

    // Step 2: Storm Glass marine point
    const now   = Math.floor(Date.now() / 1000)
    const end   = now + 3600
    const params = "waveHeight,wavePeriod,windSpeed,windDirection,airTemperature,pressure,visibility"
    const sgRes = await fetch(
      `https://api.stormglass.io/v2/weather/point?lat=${lat}&lng=${lng}&params=${params}&start=${now}&end=${end}`,
      { headers: { Authorization: STORMGLASS_KEY } }
    )
    if (!sgRes.ok) return null
    const sg = await sgRes.json()
    const h = sg.hours?.[0]
    if (!h) return null

    const pick = (v: any) => v?.noaa ?? v?.sg ?? v?.icon ?? Object.values(v ?? {})[0] ?? 0

    return {
      wave_height_m:  pick(h.waveHeight),
      wave_period_s:  pick(h.wavePeriod),
      wind_speed_ms:  pick(h.windSpeed),
      wind_dir_deg:   pick(h.windDirection),
      air_temp_c:     pick(h.airTemperature),
      pressure_mb:    pick(h.pressure),
      visibility_km:  pick(h.visibility),
    }
  } catch (e) {
    console.error("Storm Glass fetch failed:", e)
    return null
  }
}

// ─── Full port data (weather + marine) ───────────────────────────────────────
export async function fetchFullPortData(city: string): Promise<PortWeather | null> {
  const [weather, marine] = await Promise.all([
    fetchPortWeather(city),
    fetchMarineData(city),
  ])
  if (!weather) return null
  return { ...weather, marine: marine ?? undefined }
}

// ─── wttr.in fallback (no key needed) ────────────────────────────────────────
async function fetchWttrFallback(city: string): Promise<PortWeather | null> {
  try {
    const r = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)
    if (!r.ok) return null
    const d = await r.json()
    const c = d.current_condition?.[0]
    const wc = parseInt(c?.weatherCode ?? "113")
    const condMap: Record<string,string> = {
      "113":"Clear","116":"Partly cloudy","119":"Cloudy","122":"Overcast",
      "143":"Mist","176":"Patchy rain","200":"Thundery","263":"Drizzle",
      "293":"Light rain","296":"Moderate rain","302":"Heavy rain","308":"Very heavy rain"
    }

    const current: CurrentWeather = {
      city, country: "",
      temp_c:         parseInt(c?.temp_C ?? "20"),
      feels_like_c:   parseInt(c?.FeelsLikeC ?? "20"),
      humidity:       parseInt(c?.humidity ?? "60"),
      wind_kph:       parseInt(c?.windspeedKmph ?? "10"),
      wind_dir:       c?.winddir16Point ?? "N",
      pressure_mb:    parseInt(c?.pressure ?? "1013"),
      visibility_km:  parseInt(c?.visibility ?? "10"),
      uv:             parseInt(c?.uvIndex ?? "3"),
      condition:      condMap[String(wc)] ?? "Clear",
      condition_icon: "",
      is_day:         1,
    }

    const forecast: ForecastDay[] = (d.weather ?? []).map((w: any) => {
      const hly = w.hourly ?? []
      const avgRain = hly.reduce((s: number, h: any) => s + parseInt(h.precipMM ?? "0"), 0) / Math.max(hly.length, 1)
      const wcode = parseInt(hly[4]?.weatherCode ?? "113")
      return {
        date:          w.date,
        max_c:         parseInt(w.maxtempC),
        min_c:         parseInt(w.mintempC),
        avg_c:         Math.round((parseInt(w.maxtempC) + parseInt(w.mintempC)) / 2),
        rain_mm:       avgRain,
        rain_chance:   hly.reduce((s: number, h: any) => s + parseInt(h.chanceofrain ?? "0"), 0) / Math.max(hly.length, 1),
        wind_kph:      parseInt(w.hourly?.[4]?.windspeedKmph ?? "10"),
        humidity:      parseInt(w.hourly?.[4]?.humidity ?? "60"),
        condition:     condMap[String(wcode)] ?? "Clear",
        condition_icon:"",
        uv:            parseInt(w.uvIndex ?? "3"),
      }
    })

    return { current, forecast }
  } catch {
    return null
  }
}

// ─── Condition → emoji ────────────────────────────────────────────────────────
export function conditionEmoji(condition: string, isDay = 1): string {
  const c = condition.toLowerCase()
  if (c.includes("thunder") || c.includes("storm")) return "⛈"
  if (c.includes("snow") || c.includes("blizzard") || c.includes("ice")) return "❄️"
  if (c.includes("heavy rain") || c.includes("torrential")) return "🌧"
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return "🌦"
  if (c.includes("cloudy") || c.includes("overcast")) return "☁️"
  if (c.includes("partly cloudy") || c.includes("partly")) return "⛅"
  if (c.includes("fog") || c.includes("mist") || c.includes("haze")) return "🌫"
  if (c.includes("clear") || c.includes("sunny")) return isDay ? "☀️" : "🌙"
  return isDay ? "🌤" : "🌙"
}

// ─── Risk level from wind/wave ────────────────────────────────────────────────
export function shippingRisk(windKph: number, waveM?: number): "low" | "medium" | "high" {
  const wRisk = windKph > 60 ? "high" : windKph > 35 ? "medium" : "low"
  const mRisk = waveM != null ? (waveM > 4 ? "high" : waveM > 2 ? "medium" : "low") : "low"
  if (wRisk === "high" || mRisk === "high") return "high"
  if (wRisk === "medium" || mRisk === "medium") return "medium"
  return "low"
}
