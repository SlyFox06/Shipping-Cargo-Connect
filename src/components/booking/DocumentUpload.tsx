import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface DocumentUploadProps {
  bookingId: string;
  userRole: 'trader' | 'provider' | 'admin';
  onUploadSuccess: () => void;
}

const DOCUMENT_TYPES = [
  { value: 'cargo_invoice', label: 'Cargo Invoice' },
  { value: 'packing_list', label: 'Packing List' },
  { value: 'gst_eway_bill', label: 'GST/E-Way Bill' },
  { value: 'cargo_photos', label: 'Cargo Photos' },
  { value: 'pod', label: 'Proof of Delivery (POD)' },
  { value: 'customs_docs', label: 'Customs Documents' },
  { value: 'other', label: 'Other' }
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export const DocumentUpload = ({ bookingId, userRole, onUploadSuccess }: DocumentUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [uploading, setUploading] = useState(false);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 20MB limit';
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only PDF, JPG, and PNG files are allowed';
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const error = validateFile(selectedFile);
    if (error) {
      toast.error(error);
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file || !documentType) {
      toast.error('Please select a file and document type');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${bookingId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('booking-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('booking-documents')
        .getPublicUrl(fileName);

      // Save document metadata to database
      const { error: dbError } = await supabase
        .from('booking_documents')
        .insert({
          booking_id: bookingId,
          uploaded_by: user.id,
          uploaded_role: userRole,
          document_type: documentType,
          document_name: file.name,
          file_url: fileName, // Store the path, not public URL
          file_size: file.size,
          mime_type: file.type
        });

      if (dbError) throw dbError;

      toast.success('Document uploaded successfully!');
      setFile(null);
      setDocumentType('');
      onUploadSuccess();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-4">
      <h4 className="font-semibold mb-4">📄 Upload Document</h4>
      <div className="space-y-4">
        <div>
          <Label htmlFor="documentType">Document Type *</Label>
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger>
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="file">Choose File *</Label>
          <Input
            id="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Max 20MB. Allowed: PDF, JPG, PNG
          </p>
          {file && (
            <p className="text-sm text-green-600 mt-1">
              ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={!file || !documentType || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};