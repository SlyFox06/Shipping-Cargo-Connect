import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface EmailNotificationSettingsProps {
  userId: string;
  initialSettings: {
    email_notifications_enabled: boolean;
    email_booking_updates: boolean;
    email_container_updates: boolean;
    email_message_alerts: boolean;
    email_refund_updates: boolean;
    email_security_alerts: boolean;
    email_marketing: boolean;
  };
  userRole: "trader" | "provider";
}

export const EmailNotificationSettings = ({ 
  userId, 
  initialSettings,
  userRole 
}: EmailNotificationSettingsProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(initialSettings);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(settings)
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your email preferences have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>
          Control when you receive email notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="master-toggle" className="text-base">
              Enable Email Notifications
            </Label>
            <p className="text-sm text-muted-foreground">
              Receive email alerts for important updates
            </p>
          </div>
          <Switch
            id="master-toggle"
            checked={settings.email_notifications_enabled}
            onCheckedChange={() => handleToggle('email_notifications_enabled')}
          />
        </div>

        <div className="border-t pt-4 space-y-4">
          {/* Booking Updates */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="booking-updates">Booking Updates</Label>
              <p className="text-sm text-muted-foreground">
                {userRole === "trader" 
                  ? "Booking approvals, rejections, and status changes"
                  : "New booking requests and modifications"}
              </p>
            </div>
            <Switch
              id="booking-updates"
              checked={settings.email_booking_updates}
              onCheckedChange={() => handleToggle('email_booking_updates')}
              disabled={!settings.email_notifications_enabled}
            />
          </div>

          {/* Container Updates (Provider Only) */}
          {userRole === "provider" && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="container-updates">Container Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Container approval status and modifications
                </p>
              </div>
              <Switch
                id="container-updates"
                checked={settings.email_container_updates}
                onCheckedChange={() => handleToggle('email_container_updates')}
                disabled={!settings.email_notifications_enabled}
              />
            </div>
          )}

          {/* Message Alerts */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="message-alerts">New Message Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Notifications when you receive new messages
              </p>
            </div>
            <Switch
              id="message-alerts"
              checked={settings.email_message_alerts}
              onCheckedChange={() => handleToggle('email_message_alerts')}
              disabled={!settings.email_notifications_enabled}
            />
          </div>

          {/* Refund Updates */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="refund-updates">Refund Updates</Label>
              <p className="text-sm text-muted-foreground">
                Refund processing status and confirmations
              </p>
            </div>
            <Switch
              id="refund-updates"
              checked={settings.email_refund_updates}
              onCheckedChange={() => handleToggle('email_refund_updates')}
              disabled={!settings.email_notifications_enabled}
            />
          </div>

          {/* Security Alerts */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="security-alerts">Account & Security</Label>
              <p className="text-sm text-muted-foreground">
                Password changes and security alerts
              </p>
            </div>
            <Switch
              id="security-alerts"
              checked={settings.email_security_alerts}
              onCheckedChange={() => handleToggle('email_security_alerts')}
              disabled={!settings.email_notifications_enabled}
            />
          </div>

          {/* Marketing */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing">Marketing & Promotional</Label>
              <p className="text-sm text-muted-foreground">
                News, updates, and special offers
              </p>
            </div>
            <Switch
              id="marketing"
              checked={settings.email_marketing}
              onCheckedChange={() => handleToggle('email_marketing')}
              disabled={!settings.email_notifications_enabled}
            />
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
};
