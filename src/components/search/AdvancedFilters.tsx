import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Filter, X, Save, Bell } from "lucide-react";
import { useState } from "react";

interface FilterState {
  origin: string;
  destination: string;
  containerType: string[];
  transportMode: string[];
  priceMin: number;
  priceMax: number;
  capacityMin: number;
  capacityMax: number;
  departureStart: string;
  departureEnd: string;
  arrivalStart: string;
  arrivalEnd: string;
  refrigerated: boolean;
  hazmatApproved: boolean;
  verifiedProvidersOnly: boolean;
  minRating: number;
}

interface AdvancedFiltersProps {
  onApplyFilters: (filters: FilterState) => void;
  onSaveSearch?: (filters: FilterState, name: string) => void;
  initialFilters?: Partial<FilterState>;
}

const CONTAINER_TYPES = [
  { value: "dry_20ft", label: "20ft Dry Container" },
  { value: "dry_40ft", label: "40ft Dry Container" },
  { value: "dry_40ft_hc", label: "40ft High Cube" },
  { value: "refrigerated_20ft", label: "20ft Refrigerated" },
  { value: "refrigerated_40ft", label: "40ft Refrigerated" },
  { value: "open_top_20ft", label: "20ft Open Top" },
  { value: "open_top_40ft", label: "40ft Open Top" },
  { value: "flat_rack_20ft", label: "20ft Flat Rack" },
  { value: "flat_rack_40ft", label: "40ft Flat Rack" },
  { value: "tank_20ft", label: "20ft Tank" },
];

const TRANSPORT_MODES = [
  { value: "sea", label: "Sea Freight" },
  { value: "air", label: "Air Freight" },
  { value: "rail", label: "Rail Freight" },
  { value: "road", label: "Road Freight" },
  { value: "multimodal", label: "Multimodal" },
];

export function AdvancedFilters({ onApplyFilters, onSaveSearch, initialFilters }: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    origin: initialFilters?.origin || "",
    destination: initialFilters?.destination || "",
    containerType: initialFilters?.containerType || [],
    transportMode: initialFilters?.transportMode || [],
    priceMin: initialFilters?.priceMin || 0,
    priceMax: initialFilters?.priceMax || 50000,
    capacityMin: initialFilters?.capacityMin || 0,
    capacityMax: initialFilters?.capacityMax || 30000,
    departureStart: initialFilters?.departureStart || "",
    departureEnd: initialFilters?.departureEnd || "",
    arrivalStart: initialFilters?.arrivalStart || "",
    arrivalEnd: initialFilters?.arrivalEnd || "",
    refrigerated: initialFilters?.refrigerated || false,
    hazmatApproved: initialFilters?.hazmatApproved || false,
    verifiedProvidersOnly: initialFilters?.verifiedProvidersOnly || false,
    minRating: initialFilters?.minRating || 0,
  });

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState("");

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayFilter = (key: "containerType" | "transportMode", value: string) => {
    setFilters(prev => {
      const current = prev[key];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const resetFilters = () => {
    setFilters({
      origin: "",
      destination: "",
      containerType: [],
      transportMode: [],
      priceMin: 0,
      priceMax: 50000,
      capacityMin: 0,
      capacityMax: 30000,
      departureStart: "",
      departureEnd: "",
      arrivalStart: "",
      arrivalEnd: "",
      refrigerated: false,
      hazmatApproved: false,
      verifiedProvidersOnly: false,
      minRating: 0,
    });
  };

  const handleSaveSearch = () => {
    if (onSaveSearch && searchName.trim()) {
      onSaveSearch(filters, searchName);
      setSearchName("");
      setShowSaveDialog(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Advanced Filters</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Reset
          </Button>
          {onSaveSearch && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveDialog(!showSaveDialog)}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save Search
            </Button>
          )}
        </div>
      </div>

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="mb-6 p-4 border border-primary/20 rounded-lg bg-primary/5">
          <Label>Search Name</Label>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="e.g., Mumbai to Dubai - Dry 40ft"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="bg-background/50"
            />
            <Button onClick={handleSaveSearch} className="gap-2">
              <Bell className="h-4 w-4" />
              Save & Alert Me
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Location */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Origin Port/City</Label>
            <Input
              placeholder="e.g., Mumbai, Shanghai, Rotterdam"
              value={filters.origin}
              onChange={(e) => updateFilter("origin", e.target.value)}
              className="mt-2 bg-background/50"
            />
          </div>
          <div>
            <Label>Destination Port/City</Label>
            <Input
              placeholder="e.g., Dubai, Singapore, Los Angeles"
              value={filters.destination}
              onChange={(e) => updateFilter("destination", e.target.value)}
              className="mt-2 bg-background/50"
            />
          </div>
        </div>

        {/* Container Type */}
        <div>
          <Label>Container Type</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mt-2">
            {CONTAINER_TYPES.map((type) => (
              <Button
                key={type.value}
                variant={filters.containerType.includes(type.value) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleArrayFilter("containerType", type.value)}
                className="justify-start text-xs"
              >
                {type.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Transport Mode */}
        <div>
          <Label>Transport Mode</Label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
            {TRANSPORT_MODES.map((mode) => (
              <Button
                key={mode.value}
                variant={filters.transportMode.includes(mode.value) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleArrayFilter("transportMode", mode.value)}
                className="gap-2"
              >
                {mode.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <Label>Price Range (USD): ${filters.priceMin} - ${filters.priceMax}</Label>
          <div className="mt-4">
            <Slider
              min={0}
              max={50000}
              step={100}
              value={[filters.priceMin, filters.priceMax]}
              onValueChange={([min, max]) => {
                updateFilter("priceMin", min);
                updateFilter("priceMax", max);
              }}
              className="w-full"
            />
          </div>
        </div>

        {/* Capacity Range */}
        <div>
          <Label>Capacity Range (kg): {filters.capacityMin} - {filters.capacityMax}</Label>
          <div className="mt-4">
            <Slider
              min={0}
              max={30000}
              step={100}
              value={[filters.capacityMin, filters.capacityMax]}
              onValueChange={([min, max]) => {
                updateFilter("capacityMin", min);
                updateFilter("capacityMax", max);
              }}
              className="w-full"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Departure Date Range</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Input
                type="date"
                value={filters.departureStart}
                onChange={(e) => updateFilter("departureStart", e.target.value)}
                className="bg-background/50"
              />
              <Input
                type="date"
                value={filters.departureEnd}
                onChange={(e) => updateFilter("departureEnd", e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>
          <div>
            <Label>Arrival Date Range</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Input
                type="date"
                value={filters.arrivalStart}
                onChange={(e) => updateFilter("arrivalStart", e.target.value)}
                className="bg-background/50"
              />
              <Input
                type="date"
                value={filters.arrivalEnd}
                onChange={(e) => updateFilter("arrivalEnd", e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>
        </div>

        {/* Special Requirements */}
        <div>
          <Label className="mb-3 block">Special Requirements</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background/30">
              <div className="flex items-center gap-2">
                <Label htmlFor="refrigerated" className="cursor-pointer">Refrigerated Container</Label>
              </div>
              <Switch
                id="refrigerated"
                checked={filters.refrigerated}
                onCheckedChange={(checked) => updateFilter("refrigerated", checked)}
              />
            </div>
            <div className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background/30">
              <div className="flex items-center gap-2">
                <Label htmlFor="hazmat" className="cursor-pointer">Hazmat Approved</Label>
              </div>
              <Switch
                id="hazmat"
                checked={filters.hazmatApproved}
                onCheckedChange={(checked) => updateFilter("hazmatApproved", checked)}
              />
            </div>
            <div className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background/30">
              <div className="flex items-center gap-2">
                <Label htmlFor="verified" className="cursor-pointer">Verified Providers Only</Label>
              </div>
              <Switch
                id="verified"
                checked={filters.verifiedProvidersOnly}
                onCheckedChange={(checked) => updateFilter("verifiedProvidersOnly", checked)}
              />
            </div>
          </div>
        </div>

        {/* Minimum Rating */}
        <div>
          <Label>Minimum Provider Rating: {filters.minRating} ⭐</Label>
          <Select
            value={filters.minRating.toString()}
            onValueChange={(value) => updateFilter("minRating", parseInt(value))}
          >
            <SelectTrigger className="mt-2 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">No Minimum</SelectItem>
              <SelectItem value="3">3+ Stars</SelectItem>
              <SelectItem value="4">4+ Stars</SelectItem>
              <SelectItem value="5">5 Stars Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Apply Button */}
        <Button
          onClick={() => onApplyFilters(filters)}
          className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg py-6"
        >
          <Filter className="h-5 w-5 mr-2" />
          Apply Filters
        </Button>
      </div>
    </Card>
  );
}
