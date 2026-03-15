import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReviewFormProps {
    bookingId: string;
    revieweeId: string;
    revieweeName: string;
    revieweeType: "provider" | "trader";
    onSuccess?: () => void;
}

export function ReviewForm({ bookingId, revieweeId, revieweeName, revieweeType, onSuccess }: ReviewFormProps) {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [communicationRating, setCommunicationRating] = useState(0);
    const [reliabilityRating, setReliabilityRating] = useState(0);
    const [valueRating, setValueRating] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [photos, setPhotos] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (photos.length + files.length > 5) {
            toast.error("Maximum 5 photos allowed");
            return;
        }
        setPhotos([...photos, ...files]);
    };

    const removePhoto = (index: number) => {
        setPhotos(photos.filter((_, i) => i !== index));
    };

    const uploadPhotos = async (): Promise<string[]> => {
        const uploadedUrls: string[] = [];

        for (const photo of photos) {
            const fileExt = photo.name.split(".").pop();
            const fileName = `${bookingId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `reviews/${fileName}`;

            const { error: uploadError, data } = await supabase.storage
                .from("documents")
                .upload(filePath, photo);

            if (uploadError) {
                console.error("Error uploading photo:", uploadError);
                continue;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from("documents")
                .getPublicUrl(filePath);

            uploadedUrls.push(publicUrl);
        }

        return uploadedUrls;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (rating === 0) {
            toast.error("Please provide an overall rating");
            return;
        }

        if (!reviewText.trim()) {
            toast.error("Please write a review");
            return;
        }

        if (communicationRating === 0 || reliabilityRating === 0 || valueRating === 0) {
            toast.error("Please rate all categories");
            return;
        }

        setUploading(true);

        try {
            // Upload photos
            const photoUrls = photos.length > 0 ? await uploadPhotos() : [];

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast.error("You must be logged in to submit a review");
                return;
            }

            // Insert review
            const { error } = await supabase.from("reviews").insert({
                booking_id: bookingId,
                reviewer_id: user.id,
                reviewee_id: revieweeId,
                rating,
                review_text: reviewText.trim(),
                communication_rating: communicationRating,
                reliability_rating: reliabilityRating,
                value_rating: valueRating,
                photos: photoUrls,
                status: "published",
            });

            if (error) {
                console.error("Error submitting review:", error);
                toast.error("Failed to submit review");
                return;
            }

            toast.success("Review submitted successfully!");

            // Reset form
            setRating(0);
            setCommunicationRating(0);
            setReliabilityRating(0);
            setValueRating(0);
            setReviewText("");
            setPhotos([]);

            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error("Error submitting review:", error);
            toast.error("Failed to submit review");
        } finally {
            setUploading(false);
        }
    };

    const StarRating = ({
        value,
        onChange,
        size = 6
    }: {
        value: number;
        onChange: (value: number) => void;
        size?: number;
    }) => {
        const [hover, setHover] = useState(0);

        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`h-${size} w-${size} cursor-pointer transition-colors ${star <= (hover || value)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => onChange(star)}
                    />
                ))}
            </div>
        );
    };

    return (
        <Card className="p-6 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm border-border/50">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold mb-1">
                        Rate Your Experience
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        How was your experience with {revieweeName}?
                    </p>
                </div>

                {/* Overall Rating */}
                <div>
                    <Label className="text-lg mb-3 block">Overall Rating</Label>
                    <div className="flex items-center gap-4">
                        <StarRating value={rating} onChange={setRating} size={8} />
                        <span className="text-2xl font-bold text-primary">
                            {rating > 0 ? `${rating}/5` : "—"}
                        </span>
                    </div>
                </div>

                {/* Detailed Ratings */}
                <div className="grid md:grid-cols-3 gap-4">
                    <div>
                        <Label>Communication</Label>
                        <div className="mt-2">
                            <StarRating
                                value={communicationRating}
                                onChange={setCommunicationRating}
                                size={5}
                            />
                        </div>
                    </div>
                    <div>
                        <Label>Reliability</Label>
                        <div className="mt-2">
                            <StarRating
                                value={reliabilityRating}
                                onChange={setReliabilityRating}
                                size={5}
                            />
                        </div>
                    </div>
                    <div>
                        <Label>Value for Money</Label>
                        <div className="mt-2">
                            <StarRating
                                value={valueRating}
                                onChange={setValueRating}
                                size={5}
                            />
                        </div>
                    </div>
                </div>

                {/* Review Text */}
                <div>
                    <Label htmlFor="review">Your Review</Label>
                    <Textarea
                        id="review"
                        placeholder="Share details of your experience..."
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        className="mt-2 min-h-[150px] bg-background/50"
                        maxLength={1000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        {reviewText.length}/1000 characters
                    </p>
                </div>

                {/* Photo Upload */}
                <div>
                    <Label>Photos (Optional)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                        Add up to 5 photos to support your review
                    </p>

                    {photos.length < 5 && (
                        <div className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handlePhotoUpload}
                                className="hidden"
                                id="photo-upload"
                            />
                            <label htmlFor="photo-upload" className="cursor-pointer">
                                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Click to upload photos
                                </p>
                            </label>
                        </div>
                    )}

                    {photos.length > 0 && (
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3">
                            {photos.map((photo, index) => (
                                <div key={index} className="relative group">
                                    <img
                                        src={URL.createObjectURL(photo)}
                                        alt={`Upload ${index + 1}`}
                                        className="w-full h-24 object-cover rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(index)}
                                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <Button
                    type="submit"
                    disabled={uploading || rating === 0 || !reviewText.trim()}
                    className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg py-6"
                >
                    {uploading ? "Submitting Review..." : "Submit Review"}
                </Button>
            </form>
        </Card>
    );
}
