import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Download } from "lucide-react";

type AuditLog = {
  id: string;
  table_name: string | null;
  action: string;
  user_id: string | null;
  record_id: string | null;
  created_at: string;
  details: any;
  user_profile?: {
    email: string;
    full_name: string | null;
  };
};

export const ActivityLogsTable = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch user profiles separately
      const logsWithProfiles = await Promise.all(
        (data || []).map(async (log) => {
          if (log.user_id) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("email, full_name")
              .eq("id", log.user_id)
              .single();

            return {
              ...log,
              user_profile: profileData || undefined,
            };
          }
          return { ...log, user_profile: undefined };
        })
      );

      setLogs(logsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleExportLogs = () => {
    const csv = [
      ["Timestamp", "User", "Action", "Table", "Details"],
      ...logs.map((log) => [
        new Date(log.created_at).toLocaleString(),
        log.user_profile?.email || "System",
        log.action,
        log.table_name || "N/A",
        JSON.stringify(log.details || {}),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString()}.csv`;
    a.click();
  };

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case "INSERT":
        return <Badge variant="default">Create</Badge>;
      case "UPDATE":
        return <Badge variant="secondary">Update</Badge>;
      case "DELETE":
        return <Badge variant="destructive">Delete</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleExportLogs}>
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Record ID</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  No activity logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {log.user_profile?.full_name || log.user_profile?.email || "System"}
                  </TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.table_name || "N/A"}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.record_id ? log.record_id.substring(0, 8) + "..." : "N/A"}
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                    {log.details ? JSON.stringify(log.details).substring(0, 100) : "N/A"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
