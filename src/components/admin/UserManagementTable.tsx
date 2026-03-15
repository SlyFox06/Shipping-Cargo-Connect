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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { Search, UserCheck, UserX, Trash2, Download, Ban } from "lucide-react";
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

type UserWithRole = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
  role: string | null;
  verified?: boolean;
  suspended?: boolean;
};

export const UserManagementTable = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch all profiles with their roles in one optimized query
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          email,
          full_name,
          company_name,
          created_at,
          suspended
        `)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles at once
      const { data: allRoles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Fetch all providers at once
      const { data: allProviders } = await supabase
        .from("providers")
        .select("user_id, verified");

      // Create lookup maps for efficient matching
      const roleMap = new Map(allRoles?.map(r => [r.user_id, r.role]) || []);
      const providerMap = new Map(allProviders?.map(p => [p.user_id, p.verified]) || []);

      // Combine data efficiently
      const usersWithRoles = (profilesData || []).map((profile) => ({
        ...profile,
        role: roleMap.get(profile.id) || null,
        verified: providerMap.get(profile.id),
        suspended: profile.suspended || false,
      }));

      // Remove duplicates by ID
      const uniqueUsers = Array.from(
        new Map(usersWithRoles.map(user => [user.id, user])).values()
      );

      setUsers(uniqueUsers);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Real-time subscription
    const channel = supabase
      .channel('user-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        fetchUsers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'providers' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApproveProvider = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("providers")
        .update({ verified: true })
        .eq("user_id", userId);

      if (error) throw error;

      // Update local state immediately for instant UI feedback
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, verified: true } : user
        )
      );

      toast({
        title: "Success",
        description: "Provider approved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve provider",
        variant: "destructive",
      });
      // Refresh on error to ensure consistency
      fetchUsers();
    }
  };

  const handleRejectProvider = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("providers")
        .update({ verified: false })
        .eq("user_id", userId);

      if (error) throw error;

      // Update local state immediately for instant UI feedback
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, verified: false } : user
        )
      );

      toast({
        title: "Success",
        description: "Provider verification revoked",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke verification",
        variant: "destructive",
      });
      // Refresh on error to ensure consistency
      fetchUsers();
    }
  };

  const handleSuspendUser = async (userId: string, suspend: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ suspended: suspend })
        .eq("id", userId);

      if (error) throw error;

      // Update local state immediately for instant UI feedback
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, suspended: suspend } : user
        )
      );

      toast({
        title: "Success",
        description: suspend ? "User suspended successfully" : "User reactivated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user status",
        variant: "destructive",
      });
      // Refresh on error to ensure consistency
      fetchUsers();
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      const { error } = await supabase.auth.admin.deleteUser(deleteUserId);

      if (error) throw error;

      // Update local state immediately for instant UI feedback
      setUsers(prevUsers => prevUsers.filter(user => user.id !== deleteUserId));

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      setDeleteUserId(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
      // Refresh on error to ensure consistency
      fetchUsers();
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ["Name", "Email", "Company", "Role", "Status", "Joined"],
      ...filteredUsers.map((u) => [
        u.full_name || "N/A",
        u.email,
        u.company_name || "N/A",
        u.role || "N/A",
        u.role === "provider" ? (u.verified ? "Verified" : "Pending") : "Active",
        new Date(u.created_at).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString()}.csv`;
    a.click();
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.company_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="trader">Trader</SelectItem>
            <SelectItem value="provider">Provider</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name || "N/A"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.company_name || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role || "N/A"}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.suspended ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : user.role === "provider" ? (
                      <Badge variant={user.verified ? "default" : "secondary"}>
                        {user.verified ? "Verified" : "Pending"}
                      </Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {user.role === "provider" && !user.verified && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApproveProvider(user.id)}
                          title="Approve Provider"
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                      {user.role === "provider" && user.verified && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRejectProvider(user.id)}
                          title="Revoke Verification"
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                      {!user.suspended ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSuspendUser(user.id, true)}
                          title="Suspend User"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleSuspendUser(user.id, false)}
                          title="Reactivate User"
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteUserId(user.id)}
                        title="Delete User"
                      >
                        <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => setCurrentPage(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
