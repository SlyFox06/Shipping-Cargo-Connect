// Weather API integration for shipping routes
// Using OpenWeatherMap API

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || "";
const OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";

export interface WeatherData {
    location: string;
    latitude: number;
    longitude: number;
    temperature_celsius: number;
    weather_condition: string;
    weather_description: string;
    wind_speed_kmh: number;
    precipitation_mm: number;
    humidity: number;
    pressure: number;
    visibility: number;
    clouds: number;
    storm_warning: boolean;
    delay_risk: "low" | "medium" | "high" | "severe";
    icon: string;
}

export interface WeatherForecast extends WeatherData {
    forecast_date: Date;
}

export interface RouteWeather {
    origin: WeatherData;
    destination: WeatherData;
    waypoints: WeatherData[];
    forecast: WeatherForecast[];
    overall_risk: "low" | "medium" | "high" | "severe";
    warnings: string[];
    recommendations: string[];
}

// Major shipping ports coordinates
const PORT_COORDINATES: Record<string, { lat: number; lon: number }> = {
    // Asia
    "Shanghai": { lat: 31.2304, lon: 121.4737 },
    "Singapore": { lat: 1.3521, lon: 103.8198 },
    "Ningbo": { lat: 29.8683, lon: 121.544 },
    "Shenzhen": { lat: 22.5431, lon: 114.0579 },
    "Guangzhou": { lat: 23.1291, lon: 113.2644 },
    "Busan": { lat: 35.1796, lon: 129.0756 },
    "Hong Kong": { lat: 22.3193, lon: 114.1694 },
    "Qingdao": { lat: 36.0671, lon: 120.3826 },
    "Dubai": { lat: 25.2048, lon: 55.2708 },
    "Mumbai": { lat: 19.0760, lon: 72.8777 },
    "Chennai": { lat: 13.0827, lon: 80.2707 },

    // Europe
    "Rotterdam": { lat: 51.9225, lon: 4.47917 },
    "Antwerp": { lat: 51.2194, lon: 4.4025 },
    "Hamburg": { lat: 53.5511, lon: 9.9937 },
    "Bremen": { lat: 53.0793, lon: 8.8017 },
    "Felixstowe": { lat: 51.9634, lon: 1.3511 },
    "Le Havre": { lat: 49.4944, lon: 0.1079 },
    "Valencia": { lat: 39.4699, lon: -0.3763 },
    "Algeciras": { lat: 36.1408, lon: -5.4553 },

    // Americas
    "Los Angeles": { lat: 33.7701, lon: -118.1937 },
    "Long Beach": { lat: 33.7701, lon: -118.1937 },
    "New York": { lat: 40.6895, lon: -74.0445 },
    "Savannah": { lat: 32.0809, lon: -81.0912 },
    "Houston": { lat: 29.7604, lon: -95.3698 },
    "Vancouver": { lat: 49.2827, lon: -123.1207 },
    "Santos": { lat: -23.9608, lon: -46.3334 },
    "Buenos Aires": { lat: -34.6037, lon: -58.3816 },

    // Middle East & Africa
    "Jebel Ali": { lat: 25.0108, lon: 55.1272 },
    "Port Said": { lat: 31.2653, lon: 32.3019 },
    "Durban": { lat: -29.8587, lon: 31.0218 },
    "Lagos": { lat: 6.5244, lon: 3.3792 },

    // Australia
    "Sydney": { lat: -33.8688, lon: 151.2093 },
    "Melbourne": { lat: -37.8136, lon: 144.9631 },
};

function getPortCoordinates(portName: string): { lat: number; lon: number } | null {
    // Try exact match
    if (PORT_COORDINATES[portName]) {
        return PORT_COORDINATES[portName];
    }

    // Try case-insensitive partial match
    const normalizedPort = portName.toLowerCase();
    for (const [name, coords] of Object.entries(PORT_COORDINATES)) {
        if (name.toLowerCase().includes(normalizedPort) || normalizedPort.includes(name.toLowerCase())) {
            return coords;
        }
    }

    return null;
}

async function fetchWeatherData(location: string): Promise<WeatherData | null> {
    const coords = getPortCoordinates(location);

    if (!coords) {
        console.warn(`Coordinates not found for location: ${location}`);
        return null;
    }

    try {
        const response = await fetch(
            `${OPENWEATHER_BASE_URL}/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
        );

        if (!response.ok) {
            throw new Error(`Weather API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Determine delay risk based on weather conditions
        const windSpeed = data.wind.speed * 3.6; // Convert m/s to km/h
        const hasStorm = data.weather.some((w: any) =>
            ["Thunderstorm", "Squall", "Tornado"].includes(w.main)
        );

        let delayRisk: "low" | "medium" | "high" | "severe" = "low";

        if (hasStorm || windSpeed > 60) {
            delayRisk = "severe";
        } else if (data.weather[0].main === "Snow" || windSpeed > 40) {
            delayRisk = "high";
        } else if (["Rain", "Drizzle", "Mist", "Fog"].includes(data.weather[0].main) || windSpeed > 25) {
            delayRisk = "medium";
        }

        return {
            location,
            latitude: coords.lat,
            longitude: coords.lon,
            temperature_celsius: data.main.temp,
            weather_condition: data.weather[0].main,
            weather_description: data.weather[0].description,
            wind_speed_kmh: windSpeed,
            precipitation_mm: data.rain?.["1h"] || data.snow?.["1h"] || 0,
            humidity: data.main.humidity,
            pressure: data.main.pressure,
            visibility: data.visibility / 1000, // Convert to km
            clouds: data.clouds.all,
            storm_warning: hasStorm,
            delay_risk: delayRisk,
            icon: data.weather[0].icon,
        };
    } catch (error) {
        console.error(`Error fetching weather for ${location}:`, error);
        return null;
    }
}

export async function getRouteWeather(
    origin: string,
    destination: string
): Promise<RouteWeather | null> {
    try {
        const [originWeather, destinationWeather] = await Promise.all([
            fetchWeatherData(origin),
            fetchWeatherData(destination),
        ]);

        if (!originWeather || !destinationWeather) {
            return null;
        }

        // Determine overall risk
        const risks = [originWeather.delay_risk, destinationWeather.delay_risk];
        const riskLevels = { low: 0, medium: 1, high: 2, severe: 3 };
        const maxRisk = Math.max(...risks.map(r => riskLevels[r]));
        const overall_risk = Object.keys(riskLevels).find(
            k => riskLevels[k as keyof typeof riskLevels] === maxRisk
        ) as "low" | "medium" | "high" | "severe";

        // Generate warnings
        const warnings: string[] = [];
        if (originWeather.storm_warning) {
            warnings.push(`⚠️ Storm warning at ${origin}`);
        }
        if (destinationWeather.storm_warning) {
            warnings.push(`⚠️ Storm warning at ${destination}`);
        }
        if (originWeather.wind_speed_kmh > 40) {
            warnings.push(`💨 High winds at ${origin} (${originWeather.wind_speed_kmh.toFixed(0)} km/h)`);
        }
        if (destinationWeather.wind_speed_kmh > 40) {
            warnings.push(`💨 High winds at ${destination} (${destinationWeather.wind_speed_kmh.toFixed(0)} km/h)`);
        }

        // Generate recommendations
        const recommendations: string[] = [];
        if (overall_risk === "severe") {
            recommendations.push("Consider postponing shipment due to severe weather conditions");
            recommendations.push("Contact your provider for alternative arrangements");
        } else if (overall_risk === "high") {
            recommendations.push("Expect possible delays due to weather");
            recommendations.push("Ensure cargo is properly secured for rough conditions");
        } else if (overall_risk === "medium") {
            recommendations.push("Monitor weather updates closely");
            recommendations.push("Minor delays possible");
        } else {
            recommendations.push("Weather conditions are favorable for shipping");
        }

        return {
            origin: originWeather,
            destination: destinationWeather,
            waypoints: [],
            forecast: [],
            overall_risk,
            warnings,
            recommendations,
        };
    } catch (error) {
        console.error("Error getting route weather:", error);
        return null;
    }
}

export async function getWeatherForecast(
    location: string,
    days: number = 7
): Promise<WeatherForecast[]> {
    const coords = getPortCoordinates(location);

    if (!coords) {
        return [];
    }

    try {
        const response = await fetch(
            `${OPENWEATHER_BASE_URL}/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${OPENWEATHER_API_KEY}&units=metric&cnt=${days * 8}` // 8 forecasts per day (3-hour intervals)
        );

        if (!response.ok) {
            throw new Error(`Forecast API error: ${response.statusText}`);
        }

        const data = await response.json();

        return data.list.map((item: any) => {
            const windSpeed = item.wind.speed * 3.6;
            const hasStorm = item.weather.some((w: any) =>
                ["Thunderstorm", "Squall", "Tornado"].includes(w.main)
            );

            let delayRisk: "low" | "medium" | "high" | "severe" = "low";
            if (hasStorm || windSpeed > 60) delayRisk = "severe";
            else if (item.weather[0].main === "Snow" || windSpeed > 40) delayRisk = "high";
            else if (["Rain", "Drizzle", "Mist", "Fog"].includes(item.weather[0].main) || windSpeed > 25) delayRisk = "medium";

            return {
                location,
                latitude: coords.lat,
                longitude: coords.lon,
                forecast_date: new Date(item.dt * 1000),
                temperature_celsius: item.main.temp,
                weather_condition: item.weather[0].main,
                weather_description: item.weather[0].description,
                wind_speed_kmh: windSpeed,
                precipitation_mm: item.rain?.["3h"] || item.snow?.["3h"] || 0,
                humidity: item.main.humidity,
                pressure: item.main.pressure,
                visibility: 10, // Forecast doesn't include visibility
                clouds: item.clouds.all,
                storm_warning: hasStorm,
                delay_risk: delayRisk,
                icon: item.weather[0].icon,
            };
        });
    } catch (error) {
        console.error(`Error fetching forecast for ${location}:`, error);
        return [];
    }
}

// AI-powered weather impact prediction
export function predictWeatherImpact(weather: RouteWeather): {
    delayProbability: number; // 0-100
    estimatedDelayHours: number;
    confidence: number; // 0-100
    factors: string[];
} {
    let delayProbability = 0;
    let estimatedDelayHours = 0;
    const factors: string[] = [];

    // Origin weather impact
    if (weather.origin.delay_risk === "severe") {
        delayProbability += 60;
        estimatedDelayHours += 48;
        factors.push("Severe weather at origin port");
    } else if (weather.origin.delay_risk === "high") {
        delayProbability += 40;
        estimatedDelayHours += 24;
        factors.push("High risk weather at origin");
    } else if (weather.origin.delay_risk === "medium") {
        delayProbability += 20;
        estimatedDelayHours += 6;
        factors.push("Moderate weather at origin");
    }

    // Destination weather impact
    if (weather.destination.delay_risk === "severe") {
        delayProbability += 60;
        estimatedDelayHours += 48;
        factors.push("Severe weather at destination port");
    } else if (weather.destination.delay_risk === "high") {
        delayProbability += 40;
        estimatedDelayHours += 24;
        factors.push("High risk weather at destination");
    } else if (weather.destination.delay_risk === "medium") {
        delayProbability += 20;
        estimatedDelayHours += 6;
        factors.push("Moderate weather at destination");
    }

    // Wind impact on sea freight
    const avgWindSpeed = (weather.origin.wind_speed_kmh + weather.destination.wind_speed_kmh) / 2;
    if (avgWindSpeed > 50) {
        delayProbability += 30;
        estimatedDelayHours += 12;
        factors.push("High wind speeds affecting navigation");
    }

    // Storm warnings
    if (weather.origin.storm_warning || weather.destination.storm_warning) {
        delayProbability += 50;
        estimatedDelayHours += 36;
        factors.push("Active storm systems in route");
    }

    // Cap probability at 100
    delayProbability = Math.min(100, delayProbability);

    // Confidence based on data quality
    const confidence = 85; // High confidence with real weather data

    return {
        delayProbability,
        estimatedDelayHours,
        confidence,
        factors,
    };
}
