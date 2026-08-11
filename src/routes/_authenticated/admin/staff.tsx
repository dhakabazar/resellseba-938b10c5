import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, ConfirmModal } from "@/components/ui-kit";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Key, 
  Trash2, 
  MoreHorizontal, 
  Loader2,
  Mail,
  User as UserIcon,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { 
  createAdminUser, 
  updateAdminUserPassword, 
  updateAdminUserRole 
} from "@/lib/user-management.functions";
import { deleteAuthUser, listResellerEmailStatus } from "@/lib/admin-users.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: StaffPage,
});

type AppRole = "super_admin" | "staff" | "reseller" | "leader";

interface SystemUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  created_at: string;
}

function StaffPage() {
  const createUserFn = useServerFn(createAdminUser);
  const updatePassFn = useServerFn(updateAdminUserPassword);
  const updateRoleFn = useServerFn(updateAdminUserRole);
  const deleteUserFn = useServerFn(deleteAuthUser);
  const listEmailStatusFn = useServerFn(listResellerEmailStatus);

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "staff" as AppRole,
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Get profiles and roles
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          created_at,
          user_roles(role)
        `);

      if (pError) throw pError;

      // Get emails from auth list (using existing server fn)
      const emailStatus = await listEmailStatusFn();
      const emailMap = Object.fromEntries(emailStatus.map(e => [e.user_id, e.email]));

      const mappedUsers: SystemUser[] = (profiles || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        created_at: p.created_at,
        role: p.user_roles?.[0]?.role || "reseller",
        email: emailMap[p.id] || "No email",
      }));

      setUsers(mappedUsers);
    } catch (err: any) {
      toast.error("Failed to load users: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await createUserFn({ data: formData });
      toast.success("User created successfully");
      setIsAddModalOpen(false);
      setFormData({ email: "", password: "", fullName: "", role: "staff" });
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      setLoading(true);
      await updatePassFn({ data: { userId: selectedUser.id, password: formData.password } });
      toast.success("Password updated successfully");
      setIsPassModalOpen(false);
      setFormData({ ...formData, password: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      setLoading(true);
      await deleteUserFn({ data: { userId: selectedUser.id } });
      toast.success("User deleted successfully");
      setIsDeleteModalOpen(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & User Management"
        description="Create and manage administrative users and their system roles."
      >
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-brand flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add New User
        </button>
      </PageHeader>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading && users.length === 0 ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredUsers.map(user => (
          <div key={user.id} className="surface-card p-5 group relative overflow-hidden transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {user.full_name?.[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{user.full_name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <Mail className="h-3.5 w-3.5" />
                    {user.email}
                  </div>
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger className="p-1 hover:bg-muted rounded-md transition-colors">
                  <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Manage User</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    setSelectedUser(user);
                    setIsPassModalOpen(true);
                  }}>
                    <Key className="mr-2 h-4 w-4" /> Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setSelectedUser(user);
                      setIsDeleteModalOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                user.role === 'super_admin' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                user.role === 'staff' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
              }`}>
                <Shield className="h-3 w-3" />
                {user.role.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Joined {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New System User</DialogTitle>
            <DialogDescription>
              Create a new user. They can login immediately with these credentials.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Admin Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v: any) => setFormData({ ...formData, role: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin (Full Access)</SelectItem>
                  <SelectItem value="staff">Staff (Limited Access)</SelectItem>
                  <SelectItem value="reseller">Reseller</SelectItem>
                  <SelectItem value="leader">Leader Reseller</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <button
                type="button"
                className="btn-outline px-4 py-2"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-brand px-6 py-2 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create User
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={isPassModalOpen} onOpenChange={setIsPassModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePassword} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min 6 characters"
              />
            </div>
            <DialogFooter className="pt-4">
              <button
                type="button"
                className="btn-outline px-4 py-2"
                onClick={() => setIsPassModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-brand px-6 py-2 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Update Password
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      {selectedUser && (
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteUser}
          isLoading={loading}
          title="Delete User Account"
          description={`Are you sure you want to delete ${selectedUser.full_name}? This action will permanently remove their access to the platform. This cannot be undone.`}
          confirmText="Delete Permanently"
          variant="danger"
        />
      )}
    </div>
  );
}
