import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Check, Minus, Ship, Package, Clock, DollarSign } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Container {
    id: string;
    origin: string;
    destination: string;
    container_type: string;
    price_usd: number;
    capacity_kg: number;
    transport_mode: string;
    departure_date: string;
    arrival_date: string;
    providers?: {
        company_name: string;
        rating?: number;
    };
    features?: {
        refrigerated?: boolean;
        hazmat_approved?: boolean;
        tracking?: boolean;
        insurance?: boolean;
    };
}

interface ComparisonViewProps {
    containers: Container[];
    onRemove: (containerId: string) => void;
    onBook: (containerId: string) => void;
    onClear: () => void;
}

export function ComparisonView({ containers, onRemove, onBook, onClear }: ComparisonViewProps) {
    if (containers.length === 0) {
        return (
            <Card className="p-8 text-center bg-card/50">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No containers to compare</p>
                <p className="text-sm text-muted-foreground mt-1">
                    Select containers from search results to compare
                </p>
            </Card>
        );
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const calculateTransitDays = (departure: string, arrival: string) => {
        const start = new Date(departure);
        const end = new Date(arrival);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return days;
    };

    const getBestValue = (containers: Container[], key: keyof Container) => {
        if (key === "price_usd") {
            return Math.min(...containers.map(c => c.price_usd as number));
        }
        if (key === "capacity_kg") {
            return Math.max(...containers.map(c => c.capacity_kg as number));
        }
        return null;
    };

    const bestPrice = getBestValue(containers, "price_usd");
    const bestCapacity = getBestValue(containers, "capacity_kg");

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                    Compare Containers ({containers.length})
                </h2>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onClear}
                    className="gap-2"
                >
                    <X className="h-4 w-4" />
                    Clear All
                </Button>
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Feature</TableHead>
                            {containers.map((container) => (
                                <TableHead key={container.id} className="text-center min-w-[200px]">
                                    <div className="flex flex-col items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onRemove(container.id)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* Provider */}
                        <TableRow>
                            <TableCell className="font-semibold">Provider</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    <div>
                                        <p className="font-medium">{container.providers?.company_name || "Unknown"}</p>
                                        {container.providers?.rating && (
                                            <p className="text-sm text-muted-foreground">
                                                ⭐ {container.providers.rating.toFixed(1)}
                                            </p>
                                        )}
                                    </div>
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Route */}
                        <TableRow>
                            <TableCell className="font-semibold">Route</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <Ship className="h-4 w-4 text-primary" />
                                        <p className="text-sm font-medium">{container.origin}</p>
                                        <p className="text-xs text-muted-foreground">↓</p>
                                        <p className="text-sm font-medium">{container.destination}</p>
                                    </div>
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Price */}
                        <TableRow className="bg-primary/5">
                            <TableCell className="font-semibold flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Price
                            </TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    <div className="flex flex-col items-center">
                                        <p className="text-2xl font-bold text-primary">
                                            ${container.price_usd.toLocaleString()}
                                        </p>
                                        {container.price_usd === bestPrice && (
                                            <Badge className="mt-1 bg-green-500/20 text-green-700">
                                                Best Price
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Container Type */}
                        <TableRow>
                            <TableCell className="font-semibold">Container Type</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    <Badge variant="outline">
                                        {container.container_type.replace(/_/g, " ").toUpperCase()}
                                    </Badge>
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Capacity */}
                        <TableRow className="bg-secondary/5">
                            <TableCell className="font-semibold flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Capacity
                            </TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    <div className="flex flex-col items-center">
                                        <p className="font-semibold">{container.capacity_kg.toLocaleString()} kg</p>
                                        {container.capacity_kg === bestCapacity && (
                                            <Badge className="mt-1 bg-blue-500/20 text-blue-700">
                                                Highest Capacity
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Transport Mode */}
                        <TableRow>
                            <TableCell className="font-semibold">Transport</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    <Badge>{container.transport_mode.toUpperCase()}</Badge>
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Departure Date */}
                        <TableRow>
                            <TableCell className="font-semibold">Departure</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    <p className="text-sm">{formatDate(container.departure_date)}</p>
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Arrival Date */}
                        <TableRow>
                            <TableCell className="font-semibold">Arrival</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    <p className="text-sm">{formatDate(container.arrival_date)}</p>
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Transit Time */}
                        <TableRow className="bg-primary/5">
                            <TableCell className="font-semibold flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Transit Time
                            </TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    <p className="font-medium">
                                        {calculateTransitDays(container.departure_date, container.arrival_date)} days
                                    </p>
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Features */}
                        <TableRow>
                            <TableCell className="font-semibold">Refrigerated</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    {container.features?.refrigerated ? (
                                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                                    ) : (
                                        <Minus className="h-5 w-5 text-muted-foreground mx-auto" />
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>

                        <TableRow>
                            <TableCell className="font-semibold">Hazmat Approved</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    {container.features?.hazmat_approved ? (
                                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                                    ) : (
                                        <Minus className="h-5 w-5 text-muted-foreground mx-auto" />
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>

                        <TableRow>
                            <TableCell className="font-semibold">Real-time Tracking</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    {container.features?.tracking ? (
                                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                                    ) : (
                                        <Minus className="h-5 w-5 text-muted-foreground mx-auto" />
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>

                        <TableRow>
                            <TableCell className="font-semibold">Insurance Included</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    {container.features?.insurance ? (
                                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                                    ) : (
                                        <Minus className="h-5 w-5 text-muted-foreground mx-auto" />
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Actions */}
                        <TableRow>
                            <TableCell className="font-semibold">Action</TableCell>
                            {containers.map((container) => (
                                <TableCell key={container.id} className="text-center">
                                    <Button
                                        onClick={() => onBook(container.id)}
                                        className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                                    >
                                        Book Now
                                    </Button>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            {/* Price per kg comparison */}
            <Card className="p-4 bg-primary/5 border-primary/20">
                <h3 className="font-semibold mb-2">Value Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {containers.map((container) => {
                        const pricePerKg = (container.price_usd / container.capacity_kg).toFixed(2);
                        return (
                            <div key={container.id} className="text-center">
                                <p className="text-sm text-muted-foreground">{container.providers?.company_name}</p>
                                <p className="text-lg font-bold">${pricePerKg}/kg</p>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}
