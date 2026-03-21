import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Download, Trash2, Eye, Image, FileIcon, CheckCircle2, XCircle, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Document {
  id: string;
  document_type: string;
  title: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploader_id: string;
  created_at: string;
  status: string;
  file_name: string;
}

interface DocumentListProps {
  bookingId: string;
  currentUserId: string;
  userRole?: 'trader' | 'provider';
  refreshTrigger?: number;
}

export const DocumentList = ({ bookingId, currentUserId, userRole = 'trader', refreshTrigger }: DocumentListProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchDocuments = async () => {
    try {
      // Priority 1: Check my new master 'documents' table first
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback to old 'booking_documents' if table doesn't exist
        console.warn('Falling back to legacy documents table...');
        const { data: oldData, error: oldError } = await supabase
          .from('booking_documents')
          .select('*')
          .eq('booking_id', bookingId);
        
        if (oldError) throw oldError;
        setDocuments(oldData || []);
      } else {
        setDocuments(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    
    // Real-time subscription for verification updates
    const channel = supabase
      .channel('document-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `booking_id=eq.${bookingId}` }, () => fetchDocuments())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, refreshTrigger]);

  const handleStatusUpdate = async (docId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ status: newStatus })
        .eq('id', docId);

      if (error) throw error;
      toast.success(`Document marked as ${newStatus}`);
      fetchDocuments();
    } catch (error: any) {
      toast.error("Failed to update status");
    }
  };

  const handleDownload = (doc: Document) => {
    window.open(doc.file_url, '_blank');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('documents').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Document deleted');
      fetchDocuments();
    } catch (error: any) {
      toast.error('Failed to delete');
    } finally {
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified': return <Badge className="bg-green-500 hover:bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>;
      case 'rejected': return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default: return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">Pending Review</Badge>;
    }
  };

  if (loading) return <div className="p-12 text-center animate-pulse text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
        </Card>
      ) : (
        documents.map((doc) => (
          <Card key={doc.id} className="p-4 bg-card/50 backdrop-blur-sm border-border/30 hover:bg-card/80 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-4 flex-1">
              <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-sm tracking-tight">{doc.title || doc.file_name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground opacity-70">
                    {doc.document_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(doc.created_at), "MMM dd")}</span>
                  {getStatusBadge(doc.status)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Provider Actions */}
              {userRole === 'provider' && doc.status !== 'verified' && (
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 border-green-500/50 hover:bg-green-500/10 text-green-600 dark:text-green-400"
                    onClick={() => handleStatusUpdate(doc.id, 'verified')}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verify
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 border-red-500/50 hover:bg-red-500/10 text-red-600 dark:text-red-400"
                    onClick={() => handleStatusUpdate(doc.id, 'rejected')}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 gap-1"
                    onClick={() => navigate(`/dashboard/${userRole}/messages?bookingId=${bookingId}`)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Chat
                  </Button>
                </div>
              )}

              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(doc.file_url, '_blank')}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                <Download className="h-4 w-4" />
              </Button>
              {doc.uploader_id === currentUserId && (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(doc.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        ))
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};