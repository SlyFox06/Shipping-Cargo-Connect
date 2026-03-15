import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Paperclip, ArrowLeft, Smile, X, Download, FileText, Image as ImageIcon, Search } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import EmojiPicker from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  attachment_url: string | null;
  attachment_type: string | null;
  read_at: string | null;
  created_at: string;
}

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  containerInfo?: {
    type: string;
    origin: string;
    destination: string;
  };
  bookingNumber?: string;
  onBack?: () => void;
}

export const ChatWindow = ({ 
  conversationId,
  currentUserId, 
  otherUserId, 
  otherUserName,
  containerInfo,
  bookingNumber,
  onBack 
}: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMessages();
    markMessagesAsRead();

    // Real-time subscription for new messages with immediate feedback
    const channel = supabase
      .channel(`chat-messages-${conversationId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('New message received:', payload);
          const newMsg = payload.new as Message;
          
          // Avoid duplicates
          setMessages((prev) => {
            const exists = prev.some(msg => msg.id === newMsg.id);
            if (exists) return prev;
            return [...prev, newMsg];
          });
          
          if (newMsg.sender_id !== currentUserId) {
            markMessagesAsRead();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('Message updated:', payload);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id ? (payload.new as Message) : msg
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Typing indicator using presence
    const typingChannel = supabase.channel(`typing-${conversationId}`, {
      config: { presence: { key: currentUserId } }
    });

    typingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannel.presenceState();
        const others = Object.keys(state).filter(key => key !== currentUserId);
        if (others.length > 0 && state[others[0]]?.[0]) {
          const otherState = state[others[0]][0] as any;
          setIsTyping(otherState?.typing || false);
        } else {
          setIsTyping(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await typingChannel.track({ typing: false });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, currentUserId, otherUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at');

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('receiver_id', currentUserId)
        .is('read_at', null);

      // Reset unread counter for current user
      const { data: conversation } = await supabase
        .from('conversations')
        .select('trader_id, provider_id')
        .eq('id', conversationId)
        .single();

      if (conversation) {
        const isTrader = conversation.trader_id === currentUserId;
        await supabase
          .from('conversations')
          .update(isTrader ? { unread_trader_count: 0 } : { unread_provider_count: 0 })
          .eq('id', conversationId);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleTyping = async () => {
    const typingChannel = supabase.channel(`typing-${conversationId}`);
    await typingChannel.track({ typing: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      await typingChannel.track({ typing: false });
    }, 2000);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('File type not supported. Allowed: JPG, PNG, GIF, PDF, DOC, DOCX');
      return;
    }

    try {
      setUploading(true);

      // Upload file to storage
      const fileName = `${currentUserId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      // Send message with attachment
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        receiver_id: otherUserId,
        message: `📎 ${file.name}`,
        attachment_url: publicUrl,
        attachment_type: file.type,
      });

      if (error) throw error;

      // Create notification
      await supabase.from("notifications").insert({
        user_id: otherUserId,
        type: "chat",
        title: "New File",
        message: `${file.name} shared in conversation`,
        link: `/dashboard/messages`,
      });

      toast.success('File uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || loading) return;

    try {
      setLoading(true);

      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        receiver_id: otherUserId,
        message: newMessage.trim(),
      });

      if (error) throw error;

      // Create notification for receiver
      await supabase.from("notifications").insert({
        user_id: otherUserId,
        type: "chat",
        title: "New Message",
        message: `You have a new message`,
        link: `/dashboard/messages`,
      });

      setNewMessage('');
      setShowEmojiPicker(false);
      
      // Stop typing indicator
      const typingChannel = supabase.channel(`typing-${conversationId}`);
      await typingChannel.track({ typing: false });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessageDate = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM d, HH:mm');
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(msg => {
      const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    
    return groups;
  };

  // Filter messages based on search query
  const filteredMessages = searchQuery.trim()
    ? messages.filter(msg => 
        msg.message.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const messageGroups = groupMessagesByDate(filteredMessages);

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3 mb-2">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Avatar>
            <AvatarFallback>
              {otherUserName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold">{otherUserName}</h3>
            {bookingNumber && (
              <p className="text-xs text-muted-foreground">Booking: {bookingNumber}</p>
            )}
            {containerInfo && (
              <p className="text-xs text-muted-foreground">
                {containerInfo.type}: {containerInfo.origin} → {containerInfo.destination}
              </p>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSearch(!showSearch)}
            title="Search messages"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-2">
              Found {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {Object.entries(messageGroups).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center justify-center my-4">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {isToday(new Date(date)) 
                    ? 'Today' 
                    : isYesterday(new Date(date))
                    ? 'Yesterday'
                    : format(new Date(date), 'MMMM d, yyyy')
                  }
                </span>
              </div>
              {msgs.map((msg) => {
                const isOwn = msg.sender_id === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isOwn && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {otherUserName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                       <div>
                        <div
                          className={`rounded-lg p-3 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {msg.attachment_url ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                {msg.attachment_type?.startsWith('image/') ? (
                                  <ImageIcon className="h-4 w-4" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                                <p className="text-sm">{msg.message}</p>
                              </div>
                              {msg.attachment_type?.startsWith('image/') ? (
                                <img 
                                  src={msg.attachment_url} 
                                  alt="Attachment" 
                                  className="max-w-full h-auto rounded-lg max-h-64 object-cover"
                                />
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className={isOwn ? "text-primary-foreground hover:text-primary-foreground/80" : ""}
                                >
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" download>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </a>
                                </Button>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <p className="text-xs text-muted-foreground">
                            {formatMessageDate(new Date(msg.created_at))}
                          </p>
                          {isOwn && msg.read_at && (
                            <span className="text-xs text-primary">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          
          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {otherUserName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{otherUserName.split(' ')[0]} is typing...</span>
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/jpeg,image/png,image/gif,application/pdf,.doc,.docx"
          />
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            title="Attach file (max 5MB)"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                disabled={loading}
              >
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 border-none" align="start">
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  setNewMessage(prev => prev + emojiData.emoji);
                  setShowEmojiPicker(false);
                }}
                searchDisabled
                skinTonesDisabled
                height={400}
                width={300}
              />
            </PopoverContent>
          </Popover>

          <Input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={loading || uploading}
            className="flex-1"
          />
          
          <Button 
            onClick={sendMessage} 
            disabled={loading || uploading || !newMessage.trim()}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {uploading && (
          <p className="text-xs text-muted-foreground mt-2">Uploading file...</p>
        )}
      </div>
    </Card>
  );
};
