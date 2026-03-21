import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Upload, FileText, CheckCircle2, Loader2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  initialBookingId?: string;
}

const documentTypes = [
  { id: 'bill_of_lading', name: 'Bill of Lading' },
  { id: 'commercial_invoice', name: 'Commercial Invoice' },
  { id: 'packing_list', name: 'Packing List' },
  { id: 'customs_declaration', name: 'Customs Declaration' },
  { id: 'certificate_of_origin', name: 'Certificate of Origin' },
  { id: 'insurance_certificate', name: 'Insurance Certificate' },
  { id: 'other', name: 'Other' },
];

export const DocumentUploadModal = ({ open, onClose, onSuccess, userId, initialBookingId }: DocumentUploadModalProps) => {
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<string>("");
  const [docType, setDocType] = useState<string>("bill_of_lading");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadQueue, setUploadQueue] = useState<{file: File, type: string, title: string}[]>([]);

  useEffect(() => {
    if (open && userId) {
      fetchBookings();
    }
  }, [open, userId]);

  const fetchBookings = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('id, booking_number, container_id, containers(origin, destination)')
      .eq('trader_id', userId)
      .order('created_at', { ascending: false });
    
    setBookings(data || []);
    if (initialBookingId) {
      setSelectedBooking(initialBookingId);
    } else if (data && data.length > 0) {
      setSelectedBooking(data[0].id);
    }
  };

  const addToQueue = () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }
    setUploadQueue([...uploadQueue, { file, type: docType, title: title || file.name }]);
    setFile(null);
    setTitle("");
    // Automatically select next type if possible or stay on same
  };

  const removeFromQueue = (index: number) => {
    setUploadQueue(uploadQueue.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (uploadQueue.length === 0 && !file) {
      toast.error("Please add at least one document");
      return;
    }

    // Include the current file selections if not already in queue
    const finalQueue = [...uploadQueue];
    if (file) {
      finalQueue.push({ file, type: docType, title: title || file.name });
    }

    if (!selectedBooking) {
      toast.error("Please select a booking");
      return;
    }

    setLoading(true);
    let successCount = 0;

    try {
      for (const item of finalQueue) {
        // 1. Upload to Supabase Storage
        const fileExt = item.file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('booking-documents')
          .upload(filePath, item.file);

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('booking-documents')
          .getPublicUrl(filePath);

        // 3. Create Database Record
        // @ts-ignore
        const { error: dbError } = await supabase
          .from('documents')
          .insert({
            booking_id: selectedBooking,
            uploader_id: userId,
            title: item.title,
            document_type: item.type,
            file_url: publicUrl,
            file_name: item.file.name,
            file_size: item.file.size,
            mime_type: item.file.type,
            status: 'uploaded'
          });

        if (dbError) throw dbError;
        successCount++;
      }

      toast.success(`Successfully uploaded ${successCount} documents!`);
      setUploadQueue([]);
      setFile(null);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload documents");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Upload className="h-6 w-6 text-primary" />
            Upload Document
          </DialogTitle>
          <DialogDescription>
            Attach cargo documents to your active bookings for provider verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label>Select Booking</Label>
            <Select value={selectedBooking} onValueChange={setSelectedBooking}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a booking" />
              </SelectTrigger>
              <SelectContent>
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.booking_number} ({b.containers?.origin} → {b.containers?.destination})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Document Title (Optional)</Label>
            <Input 
              placeholder="e.g. Export Invoice V2" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>File Selection</Label>
            <div className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-all cursor-pointer bg-muted/5 group">
              <input
                type="file"
                className="hidden"
                id="file-upload"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-sm font-medium">
                  {file ? file.name : "Click to browse or drag and drop"}
                </p>
                <p className="text-xs text-muted-foreground">PDF, JPEG, or PNG (Max 10MB)</p>
              </label>
            </div>
            {file && (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full mt-2 border-primary/30 text-primary gap-2"
                onClick={addToQueue}
              >
                <Plus className="h-4 w-4" />
                Add to Upload List
              </Button>
            )}
          </div>

          {/* Upload Queue Section */}
          {uploadQueue.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Ready to Upload ({uploadQueue.length})
              </Label>
              <div className="space-y-2">
                {uploadQueue.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10 group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {item.type.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFromQueue(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-primary hover:opacity-90 gap-2 min-w-[140px]" 
            onClick={handleUpload}
            disabled={loading || (uploadQueue.length === 0 && !file)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadQueue.length > 1 ? `Upload ${uploadQueue.length} Files` : 'Upload and Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
