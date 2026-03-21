import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Package,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  TrendingDown,
  Box,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useCargoOptimizer } from "@/hooks/useCargoOptimizer";
import { useCargoSplit, type CargoItem as AIItem } from "@/hooks/useCargoSplit";
import type { CargoItem } from "@/services/cargoOptimizationService";
import { format, addDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type CargoCategory = CargoItem["category"];

const CATEGORY_OPTIONS: { value: CargoCategory; label: string; emoji: string }[] = [
  { value: "general", label: "General Cargo", emoji: "📦" },
  { value: "electronics", label: "Electronics", emoji: "💻" },
  { value: "perishables", label: "Perishables / Food", emoji: "🥗" },
  { value: "textiles", label: "Textiles / Garments", emoji: "👕" },
  { value: "machinery", label: "Machinery / Equipment", emoji: "⚙️" },
  { value: "chemicals", label: "Chemicals / Hazmat", emoji: "⚗️" },
  { value: "fragile", label: "Fragile Items", emoji: "🔮" },
  { value: "high_value", label: "High-Value Goods", emoji: "💎" },
  { value: "oversized", label: "Oversized Cargo", emoji: "🏗️" },
];

const UTILIZATION_COLOR = (pct: number) => {
  if (pct >= 90) return "bg-green-500";
  if (pct >= 60) return "bg-blue-500";
  if (pct >= 30) return "bg-yellow-500";
  return "bg-red-400";
};

interface AICargoOptimizerProps {
  availableContainers: any[];
  origin: string;
  destination: string;
}

export const AICargoOptimizer = ({
  availableContainers,
  origin,
  destination,
}: AICargoOptimizerProps) => {
  const { result: manualResult, loading: manualLoading, error: manualError, optimize: optimizeManual, reset: resetManual } = useCargoOptimizer();
  const { splitCargo, result: aiResult, loading: aiLoading, error: aiError, reset: resetAI } = useCargoSplit();
  
  const [expanded, setExpanded] = useState(true);
  const [useAI, setUseAI] = useState(false);
  const [requiredArrivalDate, setRequiredArrivalDate] = useState<Date>(addDays(new Date(), 14));
  const [manualOrigin, setManualOrigin] = useState(origin || "");
  const [manualDestination, setManualDestination] = useState(destination || "");
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { name: "", weightKg: 0, volumeCBM: 0, category: "general" },
  ]);

  const addItem = () =>
    setCargoItems((prev) => [
      ...prev,
      { name: "", weightKg: 0, volumeCBM: 0, category: "general" },
    ]);

  const removeItem = (idx: number) =>
    setCargoItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof CargoItem, value: any) => {
    setCargoItems((prev) => {
      const copy = [...prev];
      (copy[idx] as any)[field] = value;
      return copy;
    });
  };

  const handleOptimize = async () => {
    const valid = cargoItems.filter((i) => i.name.trim() && i.weightKg > 0 && i.volumeCBM > 0);
    if (useAI) {
      const aiItems: AIItem[] = valid.map(i => ({
        name: i.name,
        weightKg: i.weightKg,
        cbm: i.volumeCBM,
        fragile: !!i.isFragile,
        dangerous: !!i.isDangerousGoods,
        type: i.category === 'chemicals' ? 'chemical' : 
              i.category === 'perishables' ? 'food' : 
              i.category === 'electronics' ? 'electronics' :
              i.category === 'textiles' ? 'textiles' :
              i.category === 'machinery' ? 'machinery' : 'other'
      }));
      await splitCargo(aiItems, manualOrigin, manualDestination, format(requiredArrivalDate, 'yyyy-MM-dd'));
    } else {
      optimizeManual(valid, availableContainers, manualOrigin, manualDestination);
    }
  };

  const handleReset = () => {
    resetManual();
    resetAI();
  };

  const loading = manualLoading || aiLoading;
  const error = manualError || aiError;
  const result = useAI ? aiResult : manualResult;
  const costValue = useAI ? (result as any)?.totalCost : (result as any)?.costEstimate;

  const totalWeight = cargoItems.reduce((s, i) => s + (i.weightKg || 0), 0);
  const totalVolume = cargoItems.reduce((s, i) => s + (i.volumeCBM || 0), 0);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight">AI Cargo Optimizer</h3>
            <p className="text-xs text-muted-foreground">Smart split across available containers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-violet-500 border-violet-400/40 bg-violet-500/10 text-[10px]">
            <Zap className="h-3 w-3 mr-1" /> AI Powered
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Separator />
            <div className="p-4 space-y-4">
              {/* Cargo Items Form */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Cargo Items</Label>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{totalWeight.toFixed(0)} kg total</span>
                    <span>•</span>
                    <span>{totalVolume.toFixed(2)} CBM total</span>
                  </div>
                </div>

                {cargoItems.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-12 gap-2 items-center p-3 bg-background/40 rounded-lg border border-border/30"
                  >
                    {/* Name */}
                    <div className="col-span-4">
                      <Input
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)}
                        className="h-8 text-sm bg-background/50"
                      />
                    </div>

                    {/* Category */}
                    <div className="col-span-3">
                      <Select
                        value={item.category}
                        onValueChange={(v) => updateItem(idx, "category", v as CargoCategory)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.emoji} {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Weight */}
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="kg"
                        min={0}
                        step={1}
                        value={item.weightKg || ""}
                        onChange={(e) => updateItem(idx, "weightKg", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm bg-background/50"
                      />
                    </div>

                    {/* Volume */}
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="CBM"
                        min={0}
                        step={0.1}
                        value={item.volumeCBM || ""}
                        onChange={(e) => updateItem(idx, "volumeCBM", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm bg-background/50"
                      />
                    </div>

                    {/* Delete */}
                    <div className="col-span-1 flex justify-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive"
                        onClick={() => removeItem(idx)}
                        disabled={cargoItems.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* DG / Fragile Flags */}
                    <div className="col-span-12 flex gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={item.isDangerousGoods || false}
                          onChange={(e) => updateItem(idx, "isDangerousGoods", e.target.checked)}
                          className="h-3 w-3 accent-red-500"
                        />
                        Dangerous Goods
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={item.isFragile || false}
                          onChange={(e) => updateItem(idx, "isFragile", e.target.checked)}
                          className="h-3 w-3 accent-yellow-500"
                        />
                        Fragile
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={item.isPerishable || false}
                          onChange={(e) => updateItem(idx, "isPerishable", e.target.checked)}
                          className="h-3 w-3 accent-blue-500"
                        />
                        Perishable
                      </label>
                    </div>
                  </motion.div>
                ))}

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 border-dashed text-sm h-9"
                  onClick={addItem}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Cargo Item
                </Button>
              </div>

              {/* Route Info & Delivery Deadline */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-3 p-3 bg-background/30 rounded-lg border border-border/20">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">Route Configuration</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{availableContainers.length} containers online</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground ml-1">Origin</Label>
                      <Input 
                        placeholder="e.g. Mumbai" 
                        value={manualOrigin} 
                        onChange={(e) => setManualOrigin(e.target.value)}
                        className="h-7 text-[11px] bg-background/50 border-primary/20 focus-visible:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground ml-1">Destination</Label>
                      <Input 
                        placeholder="e.g. Dubai" 
                        value={manualDestination} 
                        onChange={(e) => setManualDestination(e.target.value)}
                        className="h-7 text-[11px] bg-background/50 border-primary/20 focus-visible:ring-primary/30"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/30 rounded-lg p-2.5 border border-border/20">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  Delivery Deadline:
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"ghost"}
                        className={cn(
                          "h-6 p-0 text-[11px] font-medium text-foreground hover:bg-transparent underline underline-offset-2",
                          !requiredArrivalDate && "text-muted-foreground"
                        )}
                      >
                        {requiredArrivalDate ? format(requiredArrivalDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={requiredArrivalDate}
                        onSelect={(date) => date && setRequiredArrivalDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Run Button & AI Toggle */}
              <div className="space-y-3">
                <div 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    useAI 
                    ? "bg-orange-500/10 border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.1)]" 
                    : "bg-background/40 border-border/30"
                  }`}
                  onClick={() => setUseAI(!useAI)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${useAI ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`}>
                      <Zap className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Claude Mode (Advanced AI)</p>
                      <p className="text-[10px] text-muted-foreground">Deep logistics reasoning & date-strict splitting</p>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${useAI ? "bg-orange-500" : "bg-muted"}`}>
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${useAI ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                </div>

                <Button
                  className={`w-full text-white gap-2 h-10 transition-all ${
                    useAI 
                    ? "bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/20" 
                    : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  }`}
                  onClick={handleOptimize}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : useAI ? (
                    <Zap className="h-4 w-4" />
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                  {loading ? "Reasoning..." : useAI ? "Run Claude Optimizer" : "Run AI Cargo Optimizer"}
                </Button>
              </div>

              {/* Results */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <Separator />

                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <Card className="p-3 text-center bg-background/40">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <Box className="h-3.5 w-3.5 text-violet-500" />
                          <span className="text-[11px] text-muted-foreground">Units</span>
                        </div>
                        <p className="text-2xl font-bold text-violet-500">{result.splits.length}</p>
                      </Card>
                      <Card className="p-3 text-center bg-background/40">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <DollarSign className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-[11px] text-muted-foreground">Cost Est.</span>
                        </div>
                        <p className="text-2xl font-bold text-green-500">${costValue?.toLocaleString()}</p>
                      </Card>
                      <Card className="p-3 text-center bg-background/40">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <TrendingDown className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-[11px] text-muted-foreground">You Save</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-500">${result.savingsVsSingleContainer.toLocaleString()}</p>
                      </Card>
                    </div>

                    {/* Recommendation */}
                    <Alert className={(useAI ? result.unallocated.length === 0 : (result as any).success) ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}>
                      {(useAI ? result.unallocated.length === 0 : (result as any).success) ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <AlertDescription className="text-sm">{result.recommendation}</AlertDescription>
                    </Alert>

                    {/* Container Splits */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Allocation Plan</Label>
                      {result.splits.map((split, i) => (
                        <motion.div
                          key={split.containerId}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <Card className="p-3 bg-background/40 border-border/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                                  {i + 1}
                                </div>
                                <div className="flex flex-col">
                                  <p className="text-xs font-semibold capitalize">{(split as any).providerName ? `${(split as any).providerName}'s Unit` : split.containerType.replace(/_/g, " ")}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {(split as any).departureDate ? `${format(new Date((split as any).departureDate), 'MMM d')} → ${format(new Date((split as any).arrivalDate), 'MMM d')}` : `${split.totalWeightKg.toFixed(0)} kg · ${split.totalCBM.toFixed(2)} CBM`}
                                  </p>
                                </div>
                              </div>
                              <Badge
                                className={`text-[10px] text-white ${UTILIZATION_COLOR(split.utilizationPercent)}`}
                              >
                                {split.utilizationPercent}% full
                              </Badge>
                            </div>

                            <Progress value={split.utilizationPercent} className="h-1.5" />

                            <div className="flex items-center justify-between">
                                <div className="flex flex-wrap gap-1">
                                    {split.items.map((item) => (
                                        <Badge
                                        key={item}
                                        variant="outline"
                                        className="text-[10px] bg-violet-500/10 border-violet-400/30 text-violet-600 dark:text-violet-400"
                                        >
                                        {item}
                                        </Badge>
                                    ))}
                                </div>
                                {useAI && (split as any).priceForSpace && (
                                    <span className="text-xs font-bold text-green-500">${(split as any).priceForSpace.toLocaleString()}</span>
                                )}
                            </div>

                            {/* Warnings */}
                            {split.warnings.length > 0 && (
                              <div className="space-y-1">
                                {split.warnings.map((w, wi) => (
                                  <p key={wi} className="text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                    {w}
                                  </p>
                                ))}
                              </div>
                            )}
                          </Card>
                        </motion.div>
                      ))}
                    </div>

                    {/* Unallocated Items */}
                    {result.unallocated.length > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <span className="font-semibold">Could not allocate:</span>{" "}
                          {result.unallocated.join(", ")}. Add more container capacity or extend deadline.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Reset */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-muted-foreground text-xs"
                      onClick={handleReset}
                    >
                      Clear Results
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};
