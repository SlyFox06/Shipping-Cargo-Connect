import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Trash2, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SavedSearch {
    id: string;
    name: string;
    search_criteria: any;
    email_alerts: boolean;
    alert_frequency: "instant" | "daily" | "weekly";
    last_run_at: string | null;
    results_count: number;
    created_at: string;
}

interface SavedSearchesProps {
    searches: SavedSearch[];
    onRunSearch: (search: SavedSearch) => void;
    onToggleAlerts: (searchId: string, enabled: boolean) => void;
    onDelete: (searchId: string) => void;
}

export function SavedSearches({ searches, onRunSearch, onToggleAlerts, onDelete }: SavedSearchesProps) {
    const getFilterSummary = (criteria: any) => {
        const parts: string[] = [];

        if (criteria.origin) parts.push(`From: ${criteria.origin}`);
        if (criteria.destination) parts.push(`To: ${criteria.destination}`);
        if (criteria.containerType?.length) parts.push(`${criteria.containerType.length} container types`);
        if (criteria.priceMin || criteria.priceMax) parts.push(`$${criteria.priceMin || 0}-$${criteria.priceMax || '∞'}`);

        return parts.join(" • ") || "All containers";
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Saved Searches</h2>
                <Badge variant="secondary">{searches.length} saved</Badge>
            </div>

            {searches.length === 0 ? (
                <Card className="p-8 text-center bg-card/50">
                    <p className="text-muted-foreground">No saved searches yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Use Advanced Filters and click "Save Search" to create alerts
                    </p>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {searches.map((search) => (
                        <Card
                            key={search.id}
                            className="p-4 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-semibold text-lg">{search.name}</h3>
                                        {search.email_alerts && (
                                            <Badge className="bg-primary/20 text-primary">
                                                <Bell className="h-3 w-3 mr-1" />
                                                {search.alert_frequency}
                                            </Badge>
                                        )}
                                    </div>

                                    <p className="text-sm text-muted-foreground mb-2">
                                        {getFilterSummary(search.search_criteria)}
                                    </p>

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>
                                            Created {formatDistanceToNow(new Date(search.created_at), { addSuffix: true })}
                                        </span>
                                        {search.last_run_at && (
                                            <span>
                                                Last run {formatDistanceToNow(new Date(search.last_run_at), { addSuffix: true })}
                                            </span>
                                        )}
                                        {search.results_count > 0 && (
                                            <Badge variant="outline" className="text-xs">
                                                {search.results_count} results
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => onRunSearch(search)}
                                        className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                                    >
                                        <Play className="h-4 w-4" />
                                        Run
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onToggleAlerts(search.id, !search.email_alerts)}
                                        className="gap-2"
                                    >
                                        {search.email_alerts ? (
                                            <>
                                                <BellOff className="h-4 w-4" />
                                                Mute
                                            </>
                                        ) : (
                                            <>
                                                <Bell className="h-4 w-4" />
                                                Alert
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onDelete(search.id)}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
