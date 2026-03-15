import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChatWindow } from "./ChatWindow";
import { MessageSquare } from "lucide-react";

interface PreBookingChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: any;
  currentUserId: string;
  onBookingCreated?: (bookingId: string) => void;
}

export const PreBookingChatModal = ({ 
  open, 
  onOpenChange, 
  container, 
  currentUserId,
  onBookingCreated 
}: PreBookingChatModalProps) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && container) {
      fetchOrCreateConversation();
    }
  }, [open, container, currentUserId]);

  const fetchOrCreateConversation = async () => {
    try {
      setLoading(true);

      // First fetch provider user_id
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('id, user_id')
        .eq('id', container.provider_id)
        .single();

      if (providerError) throw providerError;
      if (!provider) {
        toast.error('Provider not found');
        return;
      }

      setProviderId(provider.user_id);

      // Then fetch provider profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, company_name')
        .eq('id', provider.user_id)
        .single();

      setProviderName(profile?.company_name || profile?.full_name || 'Provider');

      // Check if conversation already exists
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('trader_id', currentUserId)
        .eq('provider_id', provider.user_id)
        .eq('container_id', container.id)
        .maybeSingle();

      if (existingConversation) {
        setConversationId(existingConversation.id);
      }
    } catch (error: any) {
      console.error('Error fetching conversation:', error);
      toast.error('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const createConversation = async () => {
    if (!providerId) {
      toast.error('Provider information not loaded');
      return;
    }

    try {
      setLoading(true);

      // Create conversation
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .insert({
          trader_id: currentUserId,
          provider_id: providerId,
          container_id: container.id,
          status: 'open'
        })
        .select()
        .single();

      if (conversationError) throw conversationError;

      setConversationId(conversation.id);

      // Create notification for provider
      await supabase.from("notifications").insert({
        user_id: providerId,
        type: "chat",
        title: "New Inquiry",
        message: `You have a new inquiry about your ${container.container_type} container`,
        link: `/dashboard/messages`,
      });

      toast.success('Conversation started!');
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Ask About Container
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            {container?.container_type} • {container?.origin} → {container?.destination}
          </div>
        </DialogHeader>

        {conversationId && providerId ? (
          <div className="flex-1 overflow-hidden">
            <ChatWindow
              conversationId={conversationId}
              currentUserId={currentUserId}
              otherUserId={providerId}
              otherUserName={providerName}
              containerInfo={{
                type: container.container_type,
                origin: container.origin,
                destination: container.destination
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <MessageSquare className="h-16 w-16 mx-auto opacity-50" />
              <p className="text-lg font-medium">Start a conversation with the provider</p>
              <p className="text-sm text-muted-foreground">
                Ask questions about this container before making a booking decision
              </p>
              <Button onClick={createConversation} disabled={loading || !providerId}>
                {loading || !providerId ? 'Loading...' : 'Start Chat'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
