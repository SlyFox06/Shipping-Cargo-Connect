import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Download, Trash2, Eye, Image, FileIcon } from "lucide-react";
import { format } from "date-fns";
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
  document_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_role: string;
  created_at: string;
  uploaded_by: string;
}

interface DocumentListProps {
  bookingId: string;
  currentUserId: string;
  refreshTrigger?: number;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  cargo_invoice: 'Cargo Invoice',
  packing_list: 'Packing List',
  gst_eway_bill: 'GST/E-Way Bill',
  cargo_photos: 'Cargo Photos',
  pod: 'Proof of Delivery',
  customs_docs: 'Customs Documents',
  other: 'Other'
};

export const DocumentList = ({ bookingId, currentUserId, refreshTrigger }: DocumentListProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('booking_documents')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    // Real-time subscription
    const channel = supabase
      .channel('booking-documents')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_documents',
          filter: `booking_id=eq.${bookingId}`
        },
        () => fetchDocuments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, refreshTrigger]);

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('booking-documents')
        .download(doc.file_url);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.document_name;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Document downloaded!');
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  const handleView = async (doc: Document) => {
    try {
      const { data } = supabase.storage
        .from('booking-documents')
        .getPublicUrl(doc.file_url);

      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank');
      }
    } catch (error: any) {
      console.error('View error:', error);
      toast.error('Failed to view document');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const doc = documents.find(d => d.id === deleteId);
      if (!doc) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('booking-documents')
        .remove([doc.file_url]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('booking_documents')
        .delete()
        .eq('id', deleteId);

      if (dbError) throw dbError;

      toast.success('Document deleted successfully');
      fetchDocuments();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Failed to delete document');
    } finally {
      setDeleteId(null);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-5 w-5" />;
    } else if (mimeType === 'application/pdf') {
      return <FileText className="h-5 w-5" />;
    }
    return <FileIcon className="h-5 w-5" />;
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, any> = {
      trader: 'default',
      provider: 'secondary',
      admin: 'outline'
    };
    return <Badge variant={variants[role] || 'outline'}>{role}</Badge>;
  };

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Loading documents...</p>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {documents.map((doc) => (
          <Card key={doc.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-1">
                  {getFileIcon(doc.mime_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium truncate">{doc.document_name}</h4>
                    {getRoleBadge(doc.uploaded_role)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                    <span>•</span>
                    <span>{format(new Date(doc.created_at), "MMM dd, yyyy")}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleView(doc)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {doc.uploaded_by === currentUserId && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteId(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The document will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};