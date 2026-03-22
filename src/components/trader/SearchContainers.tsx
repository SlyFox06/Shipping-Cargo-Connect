import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, MapPin, Calendar, Package, DollarSign, Filter, X, SlidersHorizontal, MessageSquare, Box, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { z } from "zod";
import { useContainerRecommendations } from "@/hooks/useContainerRecommendations";
import { useRouteOptimization } from "@/hooks/useRouteOptimization";
import { RouteOptimizationSection } from "./RouteOptimizationSection";
import { DelayPredictionBadge } from "./DelayPredictionBadge";
import { useWeatherPrediction } from "@/hooks/useWeatherPrediction";
import { WeatherRiskBadge } from "@/components/weather/WeatherRiskBadge";
import { Slider } from "@/components/ui/slider";

const searchSchema = z.object({
  origin: z.string().max(100).optional(),
  destination: z.string().max(100).optional(),
  transport_mode: z.string().optional(),
  container_type: z.string().optional(),
  min_price: z.number().min(0).optional(),
  max_price: z.number().min(0).optional(),
  min_capacity: z.number().min(0).optional(),
  max_capacity: z.number().min(0).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

interface SearchContainersProps {
  onBookContainer: (container: any) => void;
  onAskQuestion?: (container: any) => void;
}

export const SearchContainers = ({ onBookContainer, onAskQuestion }: SearchContainersProps) => {
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortBy, setSortBy] = useState<string>("price_asc");
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    transport_mode: "all",
    container_type: "all",
    min_price: "",
    max_price: "",
    min_capacity: "",
    max_capacity: "",
    date_from: "",
    date_to: "",
    min_rating: 0
  });
  const [cargoWeight, setCargoWeight] = useState("");
  const [cargoVolume, setCargoVolume] = useState("");
  const [useAI, setUseAI] = useState(false);
  const { recommendations, loading: aiLoading, getRecommendations } = useContainerRecommendations();
  const { optimizedContainers, loading: optimizing } = useRouteOptimization(filters.origin, filters.destination);
  const { prediction: routeWeatherPrediction, loading: routeWeatherLoading, predictWeather } = useWeatherPrediction();

  const fetchContainers = async () => {
    setLoading(true);
    try {
      // Validate filters
      const validationResult = searchSchema.safeParse({
        origin: filters.origin || undefined,
        destination: filters.destination || undefined,
        transport_mode: filters.transport_mode || undefined,
        container_type: filters.container_type || undefined,
        min_price: filters.min_price ? parseFloat(filters.min_price) : undefined,
        max_price: filters.max_price ? parseFloat(filters.max_price) : undefined,
        min_capacity: filters.min_capacity ? parseFloat(filters.min_capacity) : undefined,
        max_capacity: filters.max_capacity ? parseFloat(filters.max_capacity) : undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      });

      if (!validationResult.success) {
        toast.error("Invalid filter values");
        setLoading(false);
        return;
      }

      let query = supabase
        .from("containers")
        .select("*, providers(user_id, verified, rating), departure_date")
        .eq("status", "available");

      // Text filters
      if (filters.origin.trim()) {
        query = query.ilike("origin", `%${filters.origin.trim()}%`);
      }
      if (filters.destination.trim()) {
        query = query.ilike("destination", `%${filters.destination.trim()}%`);
      }

      // Enum filters
      if (filters.transport_mode && filters.transport_mode !== "all") {
        query = query.eq("transport_mode", filters.transport_mode as any);
      }
      if (filters.container_type && filters.container_type !== "all") {
        query = query.eq("container_type", filters.container_type as any);
      }

      // Price range
      if (filters.min_price) {
        query = query.gte("price_usd", parseFloat(filters.min_price));
      }
      if (filters.max_price) {
        query = query.lte("price_usd", parseFloat(filters.max_price));
      }

      // Capacity range
      if (filters.min_capacity) {
        query = query.gte("capacity_kg", parseFloat(filters.min_capacity));
      }
      if (filters.max_capacity) {
        query = query.lte("capacity_kg", parseFloat(filters.max_capacity));
      }

      // Date range
      if (filters.date_from) {
        query = query.gte("available_from", filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte("available_until", filters.date_to);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      let processedData = data || [];

      // Filter by provider rating if specified
      if (filters.min_rating > 0) {
        processedData = processedData.filter((c: any) => 
          (c.providers?.rating || 0) >= filters.min_rating
        );
      }

      // Get AI recommendations if enabled
      if (useAI && cargoWeight && cargoVolume && processedData.length > 0) {
        const aiRecs = await getRecommendations({
          cargoWeight: parseFloat(cargoWeight),
          cargoVolume: parseFloat(cargoVolume),
          origin: filters.origin,
          destination: filters.destination,
          containers: processedData
        });

        if (aiRecs && aiRecs.length > 0) {
          // Add AI scores to containers
          processedData = processedData.map((container: any) => {
            const aiRec = aiRecs.find((r: any) => r.container?.id === container.id);
            return {
              ...container,
              aiScore: aiRec?.score || 0,
              aiReason: aiRec?.reason || ''
            };
          });
          
          // Sort by AI score
          processedData.sort((a: any, b: any) => (b.aiScore || 0) - (a.aiScore || 0));
          toast.success("AI recommendations applied!");
        }
      }
      
      // Regular sorting
      if (!useAI) {
        switch (sortBy) {
          case "price_asc":
            processedData.sort((a: any, b: any) => a.price_usd - b.price_usd);
            break;
          case "price_desc":
            processedData.sort((a: any, b: any) => b.price_usd - a.price_usd);
            break;
          case "capacity_asc":
            processedData.sort((a: any, b: any) => a.capacity_kg - b.capacity_kg);
            break;
          case "capacity_desc":
            processedData.sort((a: any, b: any) => b.capacity_kg - a.capacity_kg);
            break;
          case "date_asc":
            processedData.sort((a: any, b: any) => new Date(a.available_from).getTime() - new Date(b.available_from).getTime());
            break;
        }
      }
      
      setContainers(processedData);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch containers");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      origin: "",
      destination: "",
      transport_mode: "all",
      container_type: "all",
      min_price: "",
      max_price: "",
      min_capacity: "",
      max_capacity: "",
      date_from: "",
      date_to: "",
      min_rating: 0
    });
    setCargoWeight("");
    setCargoVolume("");
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "transport_mode" || key === "container_type") {
      return value !== "all" && value !== "";
    }
    return value !== "";
  }).length;

  useEffect(() => {
    fetchContainers();
  }, [sortBy]);

  // Fetch weather prediction when origin and destination change
  useEffect(() => {
    if (filters.origin && filters.destination) {
      predictWeather(filters.origin, filters.destination);
    }
  }, [filters.origin, filters.destination]);

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* AI and Smart Match Toggles */}
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-lg border border-primary/20">
              <input
                type="checkbox"
                id="useAI"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="useAI" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI-Powered Recommendations - Get personalized container suggestions
              </label>
            </div>

          </div>

          {useAI && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2">Cargo Weight (kg)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 15000"
                    value={cargoWeight}
                    onChange={(e) => setCargoWeight(e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <Label className="mb-2">Cargo Volume (m³)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 25.5"
                    value={cargoVolume}
                    onChange={(e) => setCargoVolume(e.target.value)}
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {useAI 
                  ? "🤖 AI will analyze all factors to recommend the best containers for your specific needs"
                  : "🎯 Our algorithm will find the most suitable and cost-effective containers"}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Origin city..."
              value={filters.origin}
              onChange={(e) => setFilters({ ...filters, origin: e.target.value })}
              maxLength={100}
            />
            <Input
              placeholder="Destination city..."
              value={filters.destination}
              onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
              maxLength={100}
            />
            <Select value={filters.transport_mode || "all"} onValueChange={(value) => setFilters({ ...filters, transport_mode: value === "all" ? "" : value })}>
              <SelectTrigger>
                <SelectValue placeholder="Transport mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="sea">🚢 Sea</SelectItem>
                <SelectItem value="air">✈️ Air</SelectItem>
                <SelectItem value="rail">🚂 Rail</SelectItem>
                <SelectItem value="road">🚛 Road</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchContainers} disabled={loading} className="w-full">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

          {/* Advanced Filters Toggle */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Advanced Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              )}
            </div>

            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Container Type */}
                <div>
                  <Label>Container Type</Label>
                  <Select value={filters.container_type || "all"} onValueChange={(value) => setFilters({ ...filters, container_type: value === "all" ? "" : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="standard_20ft">20ft Standard</SelectItem>
                      <SelectItem value="standard_40ft">40ft Standard</SelectItem>
                      <SelectItem value="high_cube_40ft">40ft High Cube</SelectItem>
                      <SelectItem value="refrigerated">Refrigerated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div>
                  <Label>Available From</Label>
                  <Input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  />
                </div>

                {/* Date To */}
                <div>
                  <Label>Available Until</Label>
                  <Input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                    min={filters.date_from}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Price Range */}
                <div className="space-y-2">
                  <Label>Price Range (USD)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.min_price}
                      onChange={(e) => setFilters({ ...filters, min_price: e.target.value })}
                      min="0"
                      step="100"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.max_price}
                      onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
                      min="0"
                      step="100"
                    />
                  </div>
                </div>

                {/* Provider Rating */}
                <div className="space-y-2">
                  <Label>Minimum Provider Rating</Label>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[filters.min_rating]}
                      onValueChange={(value) => setFilters({ ...filters, min_rating: value[0] })}
                      max={5}
                      step={0.5}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1 min-w-[60px]">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{filters.min_rating}</span>
                    </div>
                  </div>
                </div>

                {/* Capacity Range */}
                <div className="space-y-2">
                  <Label>Capacity Range (kg)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.min_capacity}
                      onChange={(e) => setFilters({ ...filters, min_capacity: e.target.value })}
                      min="0"
                      step="1000"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.max_capacity}
                      onChange={(e) => setFilters({ ...filters, max_capacity: e.target.value })}
                      min="0"
                      step="1000"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </Card>

      {/* Route Optimization & Weather Section */}
      {(optimizing || routeWeatherLoading) && filters.origin && filters.destination && (
        <Card className="p-6">
          <div className="flex items-center gap-2 animate-pulse">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Analyzing route performance and weather...</h2>
          </div>
        </Card>
      )}
      
      {!optimizing && !routeWeatherLoading && filters.origin && filters.destination && (
        <div className="space-y-4">
          {routeWeatherPrediction && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Route Weather Conditions</h3>
                <WeatherRiskBadge 
                  riskLevel={routeWeatherPrediction.riskLevel}
                  predictedDelayHours={routeWeatherPrediction.predictedDelayHours}
                  compact
                />
              </div>
              {routeWeatherPrediction.weatherAlerts.length > 0 && (
                <div className="mt-3 space-y-1">
                  {routeWeatherPrediction.weatherAlerts.map((alert, i) => (
                    <div key={i} className="text-sm text-muted-foreground bg-destructive/10 p-2 rounded">
                      {alert}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
          
          {optimizedContainers.length > 0 && (
            <RouteOptimizationSection
              optimizedContainers={optimizedContainers}
              onBookContainer={onBookContainer}
              onAskQuestion={onAskQuestion}
            />
          )}
        </div>
      )}

      {/* Results Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {loading ? "Searching..." : `${containers.length} container${containers.length !== 1 ? 's' : ''} found`}
        </p>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
            <SelectItem value="capacity_asc">Capacity: Low to High</SelectItem>
            <SelectItem value="capacity_desc">Capacity: High to Low</SelectItem>
            <SelectItem value="date_asc">Departure: Earliest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {containers.map((container) => {
          // Calculate booking deadline
          const departureDate = container.departure_date ? new Date(container.departure_date) : null;
          const bookingDeadline = departureDate ? new Date(departureDate.getTime() - 2 * 24 * 60 * 60 * 1000) : null;
          const currentDate = new Date();
          currentDate.setHours(0, 0, 0, 0);
          const isBookingClosed = bookingDeadline ? currentDate > bookingDeadline : false;

          return (
          <Card key={container.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{container.container_type}</h3>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {isBookingClosed ? (
                      <Badge variant="destructive">
                        ⚠️ Booking Closed
                      </Badge>
                    ) : (
                      <Badge variant={(container.status === "available" || container.status === "active") ? "default" : "secondary"}>
                        {(container.status === "available" || container.status === "active") && (container.utilization_rate > 0 && container.utilization_rate < 100)
                          ? "🟡 Shared Space"
                          : (container.status === "available" || container.status === "active")
                          ? "🟢 Available"
                          : "🔴 Fully Booked"}
                      </Badge>
                    )}
                {container.providers?.verified && (
                  <Badge variant="outline" className="bg-[#7C3AED]/20 text-[#7C3AED] border-[#7C3AED]/30">
                    ✓ Verified
                  </Badge>
                )}
                {container.providers?.rating && (
                  <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />
                    {container.providers.rating.toFixed(1)}
                  </Badge>
                )}
                {container.departure_date && (
                  <DelayPredictionBadge
                    containerId={container.id}
                    route={`${container.origin}_to_${container.destination}`}
                    departureDate={container.departure_date}
                  />
                )}
                  </div>
                </div>
                {useAI && container.aiScore > 0 && (
                  <Badge className="bg-gradient-to-r from-primary to-blue-600 text-white">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI: {container.aiScore}/100
                  </Badge>
                )}
              </div>

              {/* Utilization Bar */}
              {container.utilization_rate !== undefined && container.utilization_rate > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-medium">Utilization</span>
                    <span className="text-muted-foreground">{container.utilization_rate.toFixed(1)}%</span>
                  </div>
                  <Progress value={container.utilization_rate} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(container.available_cbm ?? container.available_volume_m3)?.toFixed(2)} m³ available
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {container.origin_city && container.origin_country 
                      ? `${container.origin_city}, ${container.origin_country}`
                      : container.origin
                    } → {
                    container.destination_city && container.destination_country
                      ? `${container.destination_city}, ${container.destination_country}`
                      : container.destination
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(container.available_from), "MMM dd")} - {format(new Date(container.available_until), "MMM dd, yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                  <Calendar className="h-3 w-3" />
                  <span>Added On: {format(new Date(container.created_at), "MMM dd, yyyy")}</span>
                </div>
                {bookingDeadline && (
                  <div className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded text-sm">
                    <p className="font-medium text-orange-900 dark:text-orange-200">
                      📦 Delivery Deadline: {format(bookingDeadline, "MMM dd, yyyy")}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Box className="h-4 w-4" />
                  <span>Volume: {(container.available_cbm ?? container.available_volume_m3)?.toFixed(2) || 'N/A'} m³</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>Weight: {(container.available_weight_kg ?? container.max_weight_kg ?? container.capacity_kg)?.toLocaleString()} kg</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <DollarSign className="h-4 w-4" />
                  <span>
                    {container.price_per_cbm || container.price_per_m3 
                      ? `$${container.price_per_cbm || container.price_per_m3}/m³` 
                      : `$${container.price_usd?.toLocaleString() || 0}`}
                  </span>
                </div>
              </div>

              {useAI && container.aiReason && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs font-medium text-primary mb-1">🤖 AI Insight</p>
                  <p className="text-sm text-muted-foreground">{container.aiReason}</p>
                </div>
              )}

              {container.description && !container.aiReason && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {container.description}
                </p>
              )}

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => onAskQuestion?.(container)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Ask Question
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={() => onBookContainer(container)}
                  disabled={isBookingClosed}
                >
                  {isBookingClosed ? "Booking Closed" : "Book Now"}
                </Button>
              </div>
            </div>
          </Card>
        );
        })}
      </div>

      {containers.length === 0 && !loading && (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No containers found</p>
          <p className="text-sm text-muted-foreground mt-2">Try adjusting your search filters</p>
        </Card>
      )}
    </div>
  );
};
