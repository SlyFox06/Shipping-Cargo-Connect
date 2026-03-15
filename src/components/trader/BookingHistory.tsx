import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Calendar, MapPin, Package, DollarSign, TrendingUp, Box } from 'lucide-react';
import { toast } from 'sonner';

interface BookingHistoryProps {
  traderId: string;
}

export const BookingHistory = ({ traderId }: BookingHistoryProps) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inTransit: 0,
    totalSpent: 0,
    totalWeight: 0,
  });

  useEffect(() => {
    fetchBookingHistory();
  }, [traderId]);

  const fetchBookingHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          containers (
            id,
            container_type,
            origin,
            destination,
            origin_city,
            origin_country,
            destination_city,
            destination_country
          ),
          providers (
            id,
            rating,
            verified
          )
        `)
        .eq('trader_id', traderId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBookings(data || []);

      // Calculate stats
      const completed = data?.filter(b => b.status === 'delivered').length || 0;
      const inTransit = data?.filter(b => b.status === 'in_transit').length || 0;
      const totalSpent = data?.reduce((sum, b) => sum + (b.price_usd || 0), 0) || 0;
      const totalWeight = data?.reduce((sum, b) => sum + (b.cargo_weight_kg || 0), 0) || 0;

      setStats({
        total: data?.length || 0,
        completed,
        inTransit,
        totalSpent,
        totalWeight,
      });
    } catch (error: any) {
      toast.error('Failed to fetch booking history');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      in_transit: 'bg-purple-500',
      delivered: 'bg-green-500',
      cancelled: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Box className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{stats.completed}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Transit</p>
              <p className="text-2xl font-bold">{stats.inTransit}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold">${stats.totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Booking List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Bookings</h3>
        <div className="space-y-4">
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No bookings yet</p>
            </div>
          ) : (
            bookings.map((booking) => (
              <div key={booking.id} className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{booking.booking_number}</h4>
                      <Badge variant="outline" className={getStatusColor(booking.status)}>
                        {getStatusLabel(booking.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {booking.containers?.container_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">${booking.price_usd.toLocaleString()}</p>
                    {booking.booked_volume_m3 && (
                      <p className="text-xs text-muted-foreground">
                        {booking.booked_volume_m3.toFixed(2)} m³
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">
                      {booking.containers?.origin_city}, {booking.containers?.origin_country}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">
                      {booking.containers?.destination_city}, {booking.containers?.destination_country}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(booking.created_at), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span>{booking.cargo_weight_kg.toLocaleString()} kg</span>
                  </div>
                </div>

                {booking.space_utilization_percent && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Space Utilization</span>
                      <span className="font-medium">{booking.space_utilization_percent.toFixed(1)}%</span>
                    </div>
                    <Progress value={booking.space_utilization_percent} className="h-1.5" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
