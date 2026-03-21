import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TraderLayout from "@/components/layout/TraderLayout";
import { Card } from "@/components/ui/card";
import { FileText, Download, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { StripeCheckoutCard } from "@/components/payment/StripeCheckoutCard";
import { toast } from "sonner";
import { BookingProgress } from "@/components/trader/BookingProgress";
import { BookingUtilizationCard } from "@/components/trader/BookingUtilizationCard";
import { TransportLegsTracker } from "@/components/booking/TransportLegsTracker";
import { DocumentUpload } from "@/components/booking/DocumentUpload";
import { DocumentList } from "@/components/booking/DocumentList";
import { CancelBookingModal } from "@/components/booking/CancelBookingModal";
import { RefundInfoCard } from "@/components/booking/RefundInfoCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Bookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [documentRefresh, setDocumentRefresh] = useState(0);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [refundInfo, setRefundInfo] = useState<any>(null);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (role !== 'trader') {
        navigate('/dashboard');
        return;
      }
      setCurrentUserId(session.user.id);
      fetchBookings(session.user.id);

      // Set up realtime subscription
      const channel = supabase
        .channel('trader-bookings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            filter: `trader_id=eq.${session.user.id}`
          },
          () => fetchBookings(session.user.id)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };
    checkAuthAndFetch();
  }, [navigate]);

  const fetchBookings = async (traderId: string) => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *, 
          containers(*), 
          providers(*),
          payments(status, amount, created_at),
          transport_legs
        `)
        .eq("trader_id", traderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = async (bookingId: string) => {
    // Calculate refund info
    const { data: refundData, error } = await supabase.rpc('calculate_refund_amount', {
      p_booking_id: bookingId,
      p_cancelled_by: 'trader'
    });

    if (error) {
      console.error('Error calculating refund:', error);
      toast.error("Failed to calculate refund");
      return;
    }

    const refund = refundData[0];
    setRefundInfo({
      eligible: refund.refund_amount > 0,
      amount: refund.refund_amount,
      percentage: refund.refund_percentage
    });
    setSelectedBookingId(bookingId);
    setCancelModalOpen(true);
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!selectedBookingId) return;

    try {
      // Update booking status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_by: 'trader',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
          refund_status: refundInfo?.eligible ? (refundInfo.percentage === 100 ? 'refunded_full' : 'refunded_partial') : 'not_applicable',
          refund_amount: refundInfo?.amount || 0,
          refund_percentage: refundInfo?.percentage || 0,
          refund_processed_at: refundInfo?.eligible ? new Date().toISOString() : null,
          refund_reason: reason
        })
        .eq('id', selectedBookingId);

      if (updateError) throw updateError;

      // Create notification for provider
      const booking = bookings.find(b => b.id === selectedBookingId);
      if (booking) {
        // Trigger automated Stripe refund if payment exists
        const successfulPayment = booking.payments?.find((p: any) => p.status === 'succeeded');
        if (successfulPayment && refundInfo?.eligible) {
          console.log("Triggering automated Stripe refund...");
          try {
            await supabase.functions.invoke('process-refund', {
              body: {
                bookingId: selectedBookingId,
                refundAmount: refundInfo.amount,
                reason: reason
              }
            });
            toast.success(`Refund of $${refundInfo.amount.toFixed(2)} processed!`);
          } catch (refundErr) {
            console.error("Refund processing failed:", refundErr);
            toast.error("Booking cancelled but refund processing failed. Please contact support.");
          }
        }

        if (booking.providers) {
          await supabase.from('notifications').insert([{
            user_id: booking.providers.user_id,
            type: 'booking',
            title: 'Booking Cancelled',
            message: `Trader cancelled booking ${booking.booking_number}. ${refundInfo?.eligible ? `Refund: $${refundInfo.amount.toFixed(2)}` : 'No refund applicable.'}`,
            link: `/provider/bookings`
          }]);

          // Send email notification
          await supabase.functions.invoke('send-booking-notification', {
            body: {
              userId: booking.providers.user_id,
              type: 'booking_cancelled',
              bookingId: selectedBookingId,
              data: {
                bookingNumber: booking.booking_number,
                cancelledBy: 'Trader',
                reason: reason,
                refundAmount: refundInfo?.amount,
              }
            }
          });
        }
      }

      toast.success("Booking cancelled successfully");
      fetchBookings(currentUserId);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error("Failed to cancel booking");
    }
  };

  const getStatusBadge = (status: string, cancelledBy?: string | null) => {
    if (status === 'cancelled') {
      if (cancelledBy === 'trader') {
        return <Badge variant="destructive">Cancelled by You</Badge>;
      } else if (cancelledBy === 'provider') {
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Cancelled by Provider</Badge>;
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

  const handleDownloadInvoice = async (booking: any) => {
    toast.info("Generating professional PDF invoice...");
    
    try {
      const doc = new jsPDF() as any;
      
      // Add Brand Logo / Placeholder
      doc.setFillColor(14, 165, 233); // Primary Color
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("SHIP-LINK CONNECT", 15, 25);
      
      doc.setFontSize(10);
      doc.text("Premium Global Logistics Platform", 15, 32);
      
      // Invoice Details Header
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(20);
      doc.text("INVOICE", 15, 60);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Invoice Number: ${booking.booking_number}`, 150, 60);
      doc.text(`Date: ${format(new Date(), "MMM dd, yyyy")}`, 150, 65);
      doc.text(`Status: ${booking.status.toUpperCase()}`, 150, 70);

      // Trader & Provider Sections
      doc.setFont("helvetica", "bold");
      doc.text("BILL TO:", 15, 85);
      doc.setFont("helvetica", "normal");
      doc.text(booking.profiles?.full_name || "Valued Trader", 15, 90);
      doc.text(booking.profiles?.email || "N/A", 15, 95);
      
      doc.setFont("helvetica", "bold");
      doc.text("SHIPPER / PROVIDER:", 100, 85);
      doc.setFont("helvetica", "normal");
      doc.text(booking.providers?.company_name || "Logistics Partner", 100, 90);
      doc.text(booking.containers?.transport_mode.toUpperCase() || "CARGO", 100, 95);

      // Booking Details Table
      const tableData = [
        ["Container Type", booking.containers?.container_type.replace(/_/g, ' ').toUpperCase()],
        ["Origin", booking.containers?.origin],
        ["Destination", booking.containers?.destination],
        ["Cargo Description", booking.cargo_description],
        ["Cargo Category", booking.cargo_category?.replace(/_/g, ' ') || "General"],
        ["Weight", `${booking.cargo_weight_kg.toLocaleString()} kg`],
        ["Volume", `${booking.booked_volume_m3 || "N/A"} m³`]
      ];

      doc.autoTable({
        startY: 110,
        head: [['Description', 'Details']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [14, 165, 233] },
        alternateRowStyles: { fillColor: [240, 249, 255] }
      });

      // Summary
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, finalY, 195, finalY);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL AMOUNT PAID:", 15, finalY + 10);
      doc.setTextColor(14, 165, 233);
      doc.setFontSize(16);
      doc.text(`$${booking.price_usd.toLocaleString()} USD`, 140, finalY + 10);

      // Footer
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.text("This is a computer generated invoice and does not require a physical signature.", 105, 280, { align: "center" });
      doc.text("Ship-Link Connect © 2026. All Rights Reserved.", 105, 285, { align: "center" });

      doc.save(`invoice-${booking.booking_number}.pdf`);
      toast.success("Professional Invoice Downloaded!");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF invoice. Try again.");
    }
  };

  return (
    <TraderLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground mt-1">Track your bookings and shipments</p>
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
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Start by searching for available containers
            </p>
            <Button onClick={() => navigate('/dashboard/trader/search')}>
              Search Containers
            </Button>
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
                        Created {format(new Date(booking.created_at), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 h-8"
                        onClick={() => navigate(`/dashboard/trader/messages?bookingId=${booking.id}`)}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Message Provider
                      </Button>
                      {getStatusBadge(booking.status)}
                    </div>
                  </div>

                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="tracking">Tracking</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    {/* Booking Progress */}
                    <BookingProgress status={booking.status} />

                    {/* Space Utilization */}
                    {booking.booked_volume_m3 && (
                      <BookingUtilizationCard booking={booking} />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

                    {/* Cancel Button */}
                    {(booking.status === 'pending' || booking.status === 'confirmed') && (
                      <div className="border-t pt-4">
                        <Button
                          variant="destructive"
                          onClick={() => handleCancelClick(booking.id)}
                          className="w-full"
                        >
                          Cancel Booking
                        </Button>
                      </div>
                    )}

                    {/* Refund Info */}
                    {booking.refund_status && booking.refund_status !== 'not_applicable' && booking.refund_amount > 0 && (
                      <div className="mt-4">
                        <RefundInfoCard
                          refundStatus={booking.refund_status}
                          refundAmount={booking.refund_amount}
                          refundPercentage={booking.refund_percentage}
                          refundProcessedAt={booking.refund_processed_at}
                          refundReason={booking.refund_reason}
                        />
                      </div>
                    )}

                    {/* Cancellation Info */}
                    {booking.cancelled_at && (
                      <Card className="mt-4 border-red-200">
                        <div className="p-4">
                          <p className="text-sm text-muted-foreground">
                            Cancelled on: {new Date(booking.cancelled_at).toLocaleDateString()}
                          </p>
                          {booking.cancellation_reason && (
                            <p className="text-sm mt-2">
                              <strong>Reason:</strong> {booking.cancellation_reason}
                            </p>
                          )}
                        </div>
                      </Card>
                    )}

                    {booking.status === "delivered" && (
                      <div className="border-t pt-4 mt-4">
                        <Button onClick={() => handleDownloadInvoice(booking)} className="w-full">
                          <Download className="mr-2 h-4 w-4" />
                          Download Invoice
                        </Button>
                      </div>
                    )}

                    {booking.status === "confirmed" && (
                      <div className="border-t pt-4">
                        {booking.payments?.some((p: any) => p.status === "succeeded") ? (
                          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-center">
                            <p className="font-semibold text-green-800 dark:text-green-200">✅ Payment Successful</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Waiting for provider to start shipment
                            </p>
                          </div>
                        ) : (
                          <div>
                            <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
                              <p className="font-medium">🎉 Your booking has been approved!</p>
                              <p className="text-muted-foreground mt-1">Please proceed with payment to confirm your shipment.</p>
                            </div>
                            <StripeCheckoutCard
                              bookingId={booking.id}
                              amount={booking.price_usd}
                              currency="USD"
                              onSuccess={() => fetchBookings(currentUserId)}
                              onCancel={() => {}} 
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="tracking">
                    {/* Transport Legs Tracker */}
                    {booking.transport_legs && booking.transport_legs.length > 0 ? (
                      <TransportLegsTracker legs={booking.transport_legs} />
                    ) : (
                      <Card className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">No tracking information available</p>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-4">
                    <DocumentUpload
                      bookingId={booking.id}
                      userRole="trader"
                      onUploadSuccess={() => setDocumentRefresh(prev => prev + 1)}
                    />
                    <DocumentList
                      bookingId={booking.id}
                      currentUserId={currentUserId}
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
        userType="trader"
        refundInfo={refundInfo}
      />
    </TraderLayout>
  );
};

export default Bookings;
