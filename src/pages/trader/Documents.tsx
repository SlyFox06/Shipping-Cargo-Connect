import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TraderLayout from "@/components/layout/TraderLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, CheckCircle2, XCircle, Clock, Search, Filter, Eye, Download, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DocumentUploadModal } from "@/components/trader/DocumentUploadModal";

const TraderDocuments = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [preSelectedBooking, setPreSelectedBooking] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setUserId(session.user.id);
      fetchDocuments(session.user.id);
    };

    checkAuth();
  }, [navigate]);

  const fetchDocuments = async (id?: string) => {
    const activeId = id || userId;
    if (!activeId) return;

    setLoading(true);
    // @ts-ignore - Documents table generated in migration
    const { data, error } = await supabase
      .from('documents')
      .select('*, bookings(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching documents:", error);
    } else {
      setDocuments(data || []);
      
      // Now find bookings that HAVE NO documents
      const { data: allBookings, error: bError } = await supabase
        .from('bookings')
        .select('*, containers(id, origin, destination, departure_date)')
        .eq('trader_id', activeId);
      
      if (bError) {
        console.error("Error fetching pending bookings:", bError);
      } else if (allBookings) {
        const docBookingIds = new Set((data || []).map(d => d.booking_id));
        const pending = allBookings.filter(b => !docBookingIds.has(b.id));
        setPendingBookings(pending);
      }
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'uploaded': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'archived': return <FileText className="h-4 w-4 text-gray-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Verified</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      case 'uploaded': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Awaiting Review</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <TraderLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Document Center
            </h1>
            <p className="text-muted-foreground mt-1">Manage and verify cargo documentation for your shipments.</p>
          </div>
          <Button 
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 gap-2"
            onClick={() => setShowUploadModal(true)}
          >
            <Upload className="h-4 w-4" />
            Upload New Document
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by filename or booking ID..."
                className="pl-10 bg-background/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter by Status
            </Button>
          </div>
        </Card>

        {/* Pending Requirements Section */}
        {!loading && pendingBookings.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              Bookings Awaiting Documentation
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {pendingBookings.map((booking) => (
                <Card key={booking.id} className="p-4 border-amber-500/20 bg-amber-500/5 backdrop-blur-sm flex justify-between items-center group">
                  <div>
                    <p className="font-bold text-sm">Booking #{booking.booking_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {booking.containers?.origin} → {booking.containers?.destination}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-amber-500/50 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-2"
                    onClick={() => {
                      setPreSelectedBooking(booking.id);
                      setShowUploadModal(true);
                    }}
                  >
                    Upload Now
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Your Documents</h2>
          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-xl bg-muted/20 animate-pulse border border-border/50" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <Card className="p-12 text-center bg-muted/10 border-dashed">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-xl font-semibold mb-2">No Documents Yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Once you book a container, you'll need to upload the required documents here for provider verification.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => navigate('/dashboard/trader/bookings')}>
                Go to My Bookings
              </Button>
            </Card>
          ) : (
          <div className="grid gap-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-4 bg-card/50 hover:bg-card/80 transition-all border-border/30 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold flex items-center gap-2">
                      {doc.file_name}
                      {getStatusIcon(doc.status)}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="uppercase font-bold text-[10px] bg-muted px-2 py-0.5 rounded-full">
                        {doc.document_type.replace(/_/g, ' ')}
                      </span>
                      <span>Booking: {doc.bookings?.booking_number || 'N/A'}</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {getStatusBadge(doc.status)}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>

      <DocumentUploadModal
        open={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setPreSelectedBooking(null);
        }}
        onSuccess={fetchDocuments}
        userId={userId}
        initialBookingId={preSelectedBooking || undefined}
      />
    </TraderLayout>
  );
};

export default TraderDocuments;
