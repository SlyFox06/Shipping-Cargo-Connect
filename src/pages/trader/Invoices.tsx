import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TraderLayout from "@/components/layout/TraderLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Download, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Invoice = {
  id: string;
  invoice_number: string;
  total_amount: number;
  created_at: string;
  paid_date: string | null;
  booking?: {
    booking_number: string;
    container?: {
      origin: string;
      destination: string;
    };
  };
  payment?: {
    status: string;
  };
};

const Invoices = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
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
      await fetchInvoices(session.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    // Real-time subscription for invoices
    const channel = supabase
      .channel('invoice-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetchInvoices(session.user.id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInvoices = async (userId: string) => {
    try {
      setLoading(true);

      // Get all bookings for this trader
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('trader_id', userId);

      if (!bookings || bookings.length === 0) {
        setLoading(false);
        return;
      }

      const bookingIds = bookings.map(b => b.id);

      // Get invoices for these bookings
      const { data: invoicesData, error } = await supabase
        .from('invoices')
        .select('*')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch booking and payment details separately
      const invoicesWithDetails = await Promise.all(
        (invoicesData || []).map(async (invoice) => {
          const { data: bookingData } = await supabase
            .from('bookings')
            .select('booking_number, container_id')
            .eq('id', invoice.booking_id)
            .single();

          let containerData = null;
          if (bookingData) {
            const { data: container } = await supabase
              .from('containers')
              .select('origin, destination')
              .eq('id', bookingData.container_id)
              .single();
            containerData = container;
          }

          const { data: paymentData } = await supabase
            .from('payments')
            .select('status')
            .eq('id', invoice.payment_id)
            .single();

          return {
            ...invoice,
            booking: bookingData ? {
              booking_number: bookingData.booking_number,
              container: containerData || undefined,
            } : undefined,
            payment: paymentData || undefined,
          };
        })
      );

      setInvoices(invoicesWithDetails);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    // Generate simple text invoice
    const invoiceText = `
INVOICE: ${invoice.invoice_number}
Date: ${new Date(invoice.created_at).toLocaleDateString()}
${invoice.paid_date ? `Paid: ${new Date(invoice.paid_date).toLocaleDateString()}` : 'Status: Pending'}

Booking: ${invoice.booking?.booking_number || 'N/A'}
Route: ${invoice.booking?.container?.origin || 'N/A'} → ${invoice.booking?.container?.destination || 'N/A'}

Total Amount: $${Number(invoice.total_amount).toLocaleString()}

Thank you for your business!
    `;

    const blob = new Blob([invoiceText], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${invoice.invoice_number}.txt`;
    a.click();

    toast({
      title: "Success",
      description: "Invoice downloaded successfully",
    });
  };

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.booking?.booking_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <TraderLayout>
        <div className="flex items-center justify-center h-full">
          <p>Loading invoices...</p>
        </div>
      </TraderLayout>
    );
  }

  return (
    <TraderLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-muted-foreground mt-1">View and download your booking invoices</p>
          </div>
        </div>

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Invoices List */}
        <div className="grid gap-4">
          {filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{invoice.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Booking: {invoice.booking?.booking_number || "N/A"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {invoice.booking?.container?.origin || "N/A"} → {invoice.booking?.container?.destination || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      ${Number(invoice.total_amount).toLocaleString()}
                    </p>
                    <Badge variant={invoice.paid_date ? "default" : "secondary"}>
                      {invoice.paid_date ? "Paid" : invoice.payment?.status || "Pending"}
                    </Badge>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadInvoice(invoice)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {filteredInvoices.length === 0 && (
            <Card className="p-12">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No invoices found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Invoices will appear here after you complete bookings
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </TraderLayout>
  );
};

export default Invoices;
