import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { MessageSquare } from "lucide-react";
import ProviderLayout from "@/components/layout/ProviderLayout";
import TraderLayout from "@/components/layout/TraderLayout";
import AdminLayout from "@/components/layout/AdminLayout";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Card } from "@/components/ui/card";

import { useSearchParams } from "react-router-dom";

const CommonMessages = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingIdParam = searchParams.get('bookingId');
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedOtherUserId, setSelectedOtherUserId] = useState<string | null>(null);
  const [selectedOtherUserName, setSelectedOtherUserName] = useState<string>("");
  const [containerInfo, setContainerInfo] = useState<any>(null);
  const [bookingNumber, setBookingNumber] = useState<string>("");
  const [showMobileChat, setShowMobileChat] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (!role) {
        navigate('/dashboard');
        return;
      }
      setUserRole(role);
      setUserId(session.user.id);

      // If bookingId is provided, try to find and select the conversation
      if (bookingIdParam) {
        console.log("Direct chat requested for booking:", bookingIdParam);
        
        const fetchExistingConversation = async () => {
          const { data: conversation, error } = await supabase
            .from('conversations')
            .select(`
              *,
              trader:profiles!conversations_trader_id_fkey(id, full_name, company_name),
              provider:profiles!conversations_provider_id_fkey(id, full_name, company_name)
            `)
            .eq('booking_id', bookingIdParam)
            .maybeSingle();

          if (error) {
            console.error("Error fetching existing conversation:", error);
            return null;
          }
          return conversation;
        };

        let conversation = await fetchExistingConversation();

        if (conversation) {
          console.log("Found existing conversation:", conversation.id);
          const isTrader = session.user.id === conversation.trader_id;
          const otherUser = (isTrader ? conversation.provider : conversation.trader) as any;
          handleSelectConversation(
            conversation.id, 
            otherUser.id, 
            otherUser.company_name || otherUser.full_name || 'Partner'
          );
        } else {
          console.log("No existing conversation found, creating one...");
          // We have bookingId but no conversation yet, create it
          const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select(`
              *,
              providers(user_id, company_name),
              profiles!bookings_trader_id_fkey(id, full_name, company_name)
            `)
            .eq('id', bookingIdParam)
            .maybeSingle();
          
          if (bookingError) {
            console.error("Error fetching booking details:", bookingError);
          }

          if (booking) {
            const traderId = booking.trader_id;
            const providerUserId = (booking.providers as any)?.user_id;

            if (traderId && providerUserId) {
              const { data: newConvo, error: createError } = await supabase
                .from('conversations')
                .insert({
                  booking_id: bookingIdParam,
                  trader_id: traderId,
                  provider_id: providerUserId,
                  container_id: booking.container_id || null,
                  status: 'open'
                })
                .select(`
                  *,
                  trader:profiles!conversations_trader_id_fkey(id, full_name, company_name),
                  provider:profiles!conversations_provider_id_fkey(id, full_name, company_name)
                `)
                .single();

              if (newConvo && !createError) {
                console.log("Created new conversation:", newConvo.id);
                const isTrader = session.user.id === newConvo.trader_id;
                const otherUser = (isTrader ? newConvo.provider : newConvo.trader) as any;
                handleSelectConversation(
                  newConvo.id, 
                  otherUser.id, 
                  otherUser.company_name || otherUser.full_name || 'Partner'
                );
              } else if (createError) {
                console.error("Error creating conversation:", createError);
              }
            } else {
              console.error("Could not determine traderId or providerUserId", { traderId, providerUserId });
            }
          } else {
            console.error("Booking not found for ID:", bookingIdParam);
          }
        }
      }
    };
    checkAuth();
  }, [navigate, bookingIdParam]);

  const handleSelectConversation = async (conversationId: string, otherUserId: string, otherUserName: string) => {
    // Fetch conversation details
    const { data: conversation } = await supabase
      .from('conversations')
      .select(`
        *,
        containers(container_type, origin, destination),
        bookings(booking_number)
      `)
      .eq('id', conversationId)
      .single();

    setSelectedConversationId(conversationId);
    setSelectedOtherUserId(otherUserId);
    setSelectedOtherUserName(otherUserName);
    
    if (conversation?.containers) {
      setContainerInfo({
        type: conversation.containers.container_type,
        origin: conversation.containers.origin,
        destination: conversation.containers.destination
      });
    } else {
      setContainerInfo(null);
    }
    
    setBookingNumber(conversation?.bookings?.booking_number || '');
    setShowMobileChat(true);
  };

  const handleBack = () => {
    setShowMobileChat(false);
  };

  if (!userId || !userRole) {
    return null;
  }

  const content = (
    <div className="space-y-6 h-full">
      <div>
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="text-muted-foreground mt-1">Real-time chat with booking partners</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
        {/* Chat List - Hidden on mobile when chat is open */}
        <div className={`${showMobileChat ? 'hidden md:block' : 'block'} md:col-span-1`}>
          <ChatList
            userId={userId}
            userRole={userRole}
            onSelectConversation={handleSelectConversation}
            selectedConversationId={selectedConversationId}
          />
        </div>

        {/* Chat Window - Full width on mobile */}
        <div className={`${showMobileChat ? 'block' : 'hidden md:block'} md:col-span-2`}>
          {selectedConversationId && selectedOtherUserId ? (
            <ChatWindow
              conversationId={selectedConversationId}
              currentUserId={userId}
              otherUserId={selectedOtherUserId}
              otherUserName={selectedOtherUserName}
              containerInfo={containerInfo}
              bookingNumber={bookingNumber}
              onBack={handleBack}
            />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center p-8">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Choose a conversation from the list to start chatting
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  if (userRole === 'admin') {
    return <AdminLayout>{content}</AdminLayout>;
  } else if (userRole === 'provider') {
    return <ProviderLayout>{content}</ProviderLayout>;
  } else if (userRole === 'trader') {
    return <TraderLayout>{content}</TraderLayout>;
  }
  
  return null;
};

export default CommonMessages;
