import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProviderLayout from "@/components/layout/ProviderLayout";
import { Card } from "@/components/ui/card";
import { FileText, Truck, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { TransportLegsTracker } from "@/components/booking/TransportLegsTracker";
import { DocumentUpload } from "@/components/booking/DocumentUpload";
import { DocumentList } from "@/components/booking/DocumentList";
import { CancelBookingModal } from "@/components/booking/CancelBookingModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare } from "lucide-react";

const Bookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerId, setProviderId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [documentRefresh, setDocumentRefresh] = useState(0);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (role !== 'provider') {
        navigate('/dashboard');
        return;
      }
      setCurrentUserId(session.user.id);

      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

      if (provider) {
        setProviderId(provider.id);
        fetchBookings(provider.id);

        // Set up realtime subscription
        const channel = supabase
          .channel('provider-bookings')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'bookings',
              filter: `provider_id=eq.${provider.id}`
            },
            () => fetchBookings(provider.id)
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };
    checkAuthAndFetch();
  }, [navigate]);

  const fetchBookings = async (provId: string) => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *, 
          containers(*, departure_date), 
          profiles!bookings_trader_id_fkey(*),
          payments(status, amount, created_at),
          delivery_deadline,
          transport_legs,
          pickup_address,
          drop_address
        `)
        .eq("provider_id", provId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (bookingId: string) => {
    try {
      const { data: booking } = await supabase
        .from("bookings")
        .select("trader_id, booking_number")
        .eq("id", bookingId)
        .single();

      const { error } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", bookingId);

      if (error) throw error;

      // Create notification for trader
      if (booking) {
        await supabase.from("notifications").insert([
          {
            user_id: booking.trader_id,
            type: "booking",
            title: "Booking Confirmed",
            message: `Your booking ${booking.booking_number} has been confirmed. Please proceed with payment.`,
            link: `/dashboard/trader/bookings`,
          },
        ]);
      }

      toast.success("Booking approved successfully!");
      fetchBookings(providerId);
    } catch (error: any) {
      toast.error(error.message || "Failed to approve booking");
    }
  };

  const handleCancelClick = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setCancelModalOpen(true);
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!selectedBookingId) return;

    try {
      // Calculate refund (provider cancellation = full refund)
      const { data: refundData, error: refundError } = await supabase.rpc('calculate_refund_amount', {
        p_booking_id: selectedBookingId,
        p_cancelled_by: 'provider'
      });

      if (refundError) throw refundError;

      const refund = refundData[0];

      // Update booking status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_by: 'provider',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
          refund_status: refund.refund_status,
          refund_amount: refund.refund_amount,
          refund_percentage: refund.refund_percentage,
          refund_processed_at: new Date().toISOString(),
          refund_reason: reason
        })
        .eq('id', selectedBookingId);

      if (updateError) throw updateError;

      // Create notification for trader
      const booking = bookings.find(b => b.id === selectedBookingId);
      if (booking) {
        await supabase.from('notifications').insert([{
          user_id: booking.profiles?.id || booking.trader_id,
          type: 'booking',
          title: 'Booking Cancelled',
          message: `Provider cancelled booking ${booking.booking_number}. Full refund of $${refund.refund_amount.toFixed(2)} processed.`,
          link: `/trader/bookings`
        }]);

        // Send email notification
        await supabase.functions.invoke('send-booking-notification', {
          body: {
            userId: booking.trader_id,
            type: 'booking_cancelled',
            bookingId: selectedBookingId,
            data: {
              bookingNumber: booking.booking_number,
              cancelledBy: 'Provider',
              reason: reason,
              refundAmount: refund.refund_amount,
            }
          }
        });
      }

      toast.success("Booking cancelled successfully");
      fetchBookings(providerId);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error("Failed to cancel booking");
    }
  };

  const handleReject = async (bookingId: string) => {
    try {
      const { data: booking } = await supabase
        .from("bookings")
        .select("trader_id, booking_number")
        .eq("id", bookingId)
        .single();

      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" as any })
        .eq("id", bookingId);

      if (error) throw error;

      // Create notification for trader
      if (booking) {
        await supabase.from("notifications").insert([
          {
            user_id: booking.trader_id,
            type: "booking",
            title: "Booking Rejected",
            message: `Your booking ${booking.booking_number} has been rejected by the provider.`,
            link: `/dashboard/trader/bookings`,
          },
        ]);
      }

      toast.success("Booking rejected");
      fetchBookings(providerId);
    } catch (error: any) {
      toast.error(error.message || "Failed to reject booking");
    }
  };

  const handleStartBooking = async (bookingId: string) => {
    try {
      // Check if payment is completed
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .select("status")
        .eq("booking_id", bookingId)
        .eq("status", "succeeded")
        .single();

      if (paymentError || !payment) {
        toast.error("Cannot start shipment - payment not received yet");
        return;
      }

      const { error } = await supabase
        .from("bookings")
        .update({ status: "in_transit" as any })
        .eq("id", bookingId);

      if (error) throw error;
      toast.success("Shipment started!");
      fetchBookings(providerId);
    } catch (error: any) {
      toast.error(error.message || "Failed to start shipment");
    }
  };

  const handleMarkDelivered = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "delivered" as any })
        .eq("id", bookingId);

      if (error) throw error;
      toast.success("Booking marked as delivered!");
      fetchBookings(providerId);
    } catch (error: any) {
      toast.error(error.message || "Failed to mark as delivered");
    }
  };

  const hasUnverifiedDocs = (booking: any) => {
    // This is a helper to check if the booking should show a warning
    // In a real app, you might fetch this count, for now we let the user view current docs
    return booking.status === 'pending';
  };

  const handleUpdateLegStatus = async (bookingId: string, legNumber: number, status: string) => {
    try {
      const { data, error } = await supabase.rpc('update_transport_leg_status', {
        p_booking_id: bookingId,
        p_leg_number: legNumber,
        p_status: status,
        p_completed_date: status === 'completed' ? new Date().toISOString() : null
      });

      if (error) throw error;
      
      toast.success(`Leg ${legNumber} updated to ${status}`);
      fetchBookings(providerId);
    } catch (error: any) {
      toast.error(error.message || "Failed to update leg status");
    }
  };

  const getStatusBadge = (status: string, cancelledBy?: string | null) => {
    if (status === 'cancelled') {
      if (cancelledBy === 'trader') {
        return <Badge variant="destructive">Cancelled by Trader</Badge>;
      } else if (cancelledBy === 'provider') {
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Cancelled by You</Badge>;
      }
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    
    const colors: any = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      in_transit: "bg-blue-100 text-blue-800",
      delivered: "bg-purple-100 text-purple-800",
    };
    const label = status.replace('_', ' ');
    return <Badge className={colors[status] || ""}>{label}</Badge>;
  };

  return (
    <ProviderLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground mt-1">Manage booking requests and active shipments</p>
        </div>

        {loading ? (
          <Card className="p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-50 animate-pulse" />
            <p className="text-muted-foreground">Loading bookings...</p>
          </Card>
        ) : bookings.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No bookings yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Add containers to start receiving booking requests
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="p-6">
                <Tabs defaultValue="details" className="w-full">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{booking.booking_number}</h3>
                      <p className="text-sm text-muted-foreground">
                        Requested {format(new Date(booking.created_at), "MMM dd, yyyy")}
                      </p>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>

                  {booking.status === 'pending' && (
                    <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 animate-pulse">
                      <FileText className="h-5 w-5 text-primary" />
                      <p className="text-sm font-bold text-primary">Compliance Review Recommended</p>
                      <p className="text-xs text-muted-foreground mr-auto">• Check 'Documents' tab before approving</p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="text-primary gap-1 h-auto p-0"
                        onClick={() => navigate(`/dashboard/provider/messages?bookingId=${booking.id}`)}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Message Trader
                      </Button>
                    </div>
                  )}

                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="tracking">Tracking</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">{/* ... keep existing code */}
                  <div>
                    <p className="text-sm text-muted-foreground">Trader</p>
                    <p className="font-medium">{booking.profiles?.full_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Container</p>
                    <p className="font-medium">{booking.containers?.container_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Route</p>
                    <p className="font-medium">
                      {booking.containers?.origin} → {booking.containers?.destination}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cargo</p>
                    <p className="font-medium">{booking.cargo_description}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Weight</p>
                    <p className="font-medium">{booking.cargo_weight_kg.toLocaleString()} kg</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-medium text-primary">${booking.price_usd.toLocaleString()}</p>
                  </div>
                  {booking.pickup_address && (
                    <div>
                      <p className="text-sm text-muted-foreground">Pickup Address</p>
                      <p className="font-medium text-sm">{booking.pickup_address}</p>
                    </div>
                  )}
                  {booking.drop_address && (
                    <div>
                      <p className="text-sm text-muted-foreground">Delivery Address</p>
                      <p className="font-medium text-sm">{booking.drop_address}</p>
                    </div>
                  )}
                    </div>

                    {booking.delivery_deadline && (
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-900 mb-4">
                        <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                          📦 Cargo Delivery Deadline: {format(new Date(booking.delivery_deadline), "MMM dd, yyyy")}
                        </p>
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                          Trader must deliver cargo by this date (2 days before container departure)
                        </p>
                        {new Date() > new Date(booking.delivery_deadline) && booking.status !== 'in_transit' && booking.status !== 'delivered' && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-2">
                            ⚠️ Delivery deadline has passed
                          </p>
                        )}
                      </div>
                    )}

                    <div className="border-t pt-4">{/* ... keep existing code */}
                  {booking.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(booking.id)}
                        className="flex-1"
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(booking.id)}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {booking.status === "confirmed" && (
                    <div className="space-y-2">
                      {booking.payments?.some((p: any) => p.status === "succeeded") ? (
                        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded text-center mb-2">
                          <p className="font-semibold text-green-800 dark:text-green-200">💰 Payment Received</p>
                          <p className="text-xs text-muted-foreground mt-1">Ready to start shipment</p>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded">
                          ⏳ Waiting for trader payment
                        </div>
                      )}
                      <Button
                        onClick={() => handleStartBooking(booking.id)}
                        className="w-full"
                        disabled={!booking.payments?.some((p: any) => p.status === "succeeded")}
                      >
                        <Truck className="mr-2 h-4 w-4" />
                        Start Shipment
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleCancelClick(booking.id)}
                        className="w-full"
                      >
                        Cancel Booking
                      </Button>
                    </div>
                  )}

                  {booking.status === "in_transit" && (
                    <Button
                      onClick={() => handleMarkDelivered(booking.id)}
                      className="w-full"
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Mark as Delivered
                    </Button>
                  )}
                    </div>

                  </TabsContent>

                  <TabsContent value="tracking">
                    {/* Transport Legs Tracker - Provider can update status */}
                    {booking.transport_legs && booking.transport_legs.length > 0 ? (
                      <TransportLegsTracker 
                        legs={booking.transport_legs}
                        showActions={booking.status === 'in_transit' || booking.status === 'confirmed'}
                        onUpdateLegStatus={(legNumber, status) => handleUpdateLegStatus(booking.id, legNumber, status)}
                      />
                    ) : (
                      <Card className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">No tracking information available</p>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Trader Verification Documents
                      </h4>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => navigate(`/dashboard/provider/messages?bookingId=${booking.id}`)}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Ask for Documents
                      </Button>
                    </div>

                    <DocumentList
                      bookingId={booking.id}
                      currentUserId={currentUserId}
                      userRole="provider"
                      refreshTrigger={documentRefresh}
                    />

                  </TabsContent>
                </Tabs>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CancelBookingModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        onConfirm={handleCancelConfirm}
        userType="provider"
      />
    </ProviderLayout>
  );
};

export default Bookings;
