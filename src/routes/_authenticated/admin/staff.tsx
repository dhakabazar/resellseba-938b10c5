import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Key, 
  Trash2, 
  MoreHorizontal, 
  Loader2,
  Mail,
  Search,
  Lock,
  Plus,
  Edit2,
  Check,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/use-auth";
import { createAdminUser, updateAdminUserPassword, updateAdminUserRole } from "@/lib/user-management.functions";
import { deleteAuthUser, listResellerEmailStatus } from "@/lib/admin-users.functions";
import { getRoles, getPermissions, saveRole, deleteRole } from "@/lib/roles-permissions.functions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: StaffAndRolesPage,
});

function StaffAndRolesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-tight text-foreground">Staff & Permissions</h1>
      <Tabs defaultValue="staff" className="w-full">
        <TabsList>
          <TabsTrigger value="staff">Staff Management</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="staff" className="pt-4">
          <StaffPage />
        </TabsContent>
        <TabsContent value="roles" className="pt-4">
          <RolesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- STAFF PAGE CONTENT ---
type AppRole = "super_admin" | "staff" | "reseller" | "leader";
interface SystemUser { id: string; email: string | null; full_name: string | null; role: AppRole; created_at: string; }

function StaffPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [formData, setFormData] = useState({ email: "", password: "", fullName: "", role: "staff" as string });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createUserMutation = useServerFn(createAdminUser);

  const loadUsers = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, customRolesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, created_at"),
      supabase.from("user_roles").select("user_id, role, custom_role_id"),
      supabase.from("roles").select("*")
    ]);
    const emailStatus = await listResellerEmailStatus();
    const emailMap = Object.fromEntries(emailStatus.map(e => [e.user_id, e.email]));
    const roleMap = (rolesRes.data || []).reduce((acc: any, curr) => { acc[curr.user_id] = { role: curr.role, custom_role_id: curr.custom_role_id }; return acc; }, {});
    const mappedUsers = (profilesRes.data || []).map((p: any) => ({
      id: p.id, full_name: p.full_name, created_at: p.created_at,
      role: roleMap[p.id]?.role || "reseller", email: emailMap[p.id] || "No email",
    }));
    setUsers(mappedUsers);
    setCustomRoles(customRolesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const { user: currentUser, roles: currentRoles } = useAuth();
  const isSuperAdmin = currentRoles.includes("super_admin");
  const filteredUsers = users.filter(u => (isSuperAdmin || u.id === currentUser?.id));

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createUserMutation({ data: formData });
      toast.success("User created successfully");
      setIsAddModalOpen(false);
      setFormData({ email: "", password: "", fullName: "", role: "staff" });
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <button onClick={() => setIsAddModalOpen(true)} className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium">
          <UserPlus className="h-4 w-4" /> Add New User
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? <div className="col-span-full flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : filteredUsers.map(user => (
          <div key={user.id} className="surface-card p-5 group relative overflow-hidden transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">{user.full_name?.[0]?.toUpperCase() || "U"}</div>
                <div>
                  <h3 className="font-bold text-foreground">{user.full_name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5"><Mail className="h-3.5 w-3.5" />{user.email}</div>
                </div>
              </div>
              {isSuperAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="p-1 hover:bg-muted rounded-md"><MoreHorizontal className="h-5 w-5 text-muted-foreground" /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setSelectedUser(user); setIsPassModalOpen(true); }}><Key className="mr-2 h-4 w-4" /> Change Password</DropdownMenuItem>
                    {user.id !== currentUser?.id && user.role !== 'super_admin' && (
                      <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedUser(user); setIsDeleteModalOpen(true); }}><Trash2 className="mr-2 h-4 w-4" /> Delete User</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddUser}>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new staff member or reseller. They will be able to log in with these credentials.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="John Doe" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground">System Roles</DropdownMenuLabel>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="reseller">Reseller</SelectItem>
                    <SelectItem value="leader">Leader</SelectItem>
                    {customRoles.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground">Custom Roles</DropdownMenuLabel>
                        {customRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <button type="submit" disabled={isSubmitting} className="btn-brand w-full py-2.5 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create User
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- ROLES PAGE CONTENT ---
function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", permissionIds: [] as string[] });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const saveRoleMutation = useServerFn(saveRole);

  const loadData = async () => {
    setLoading(true);
    const [rolesData, permsData] = await Promise.all([getRoles(), getPermissions()]);
    setRoles(rolesData);
    setPermissions(permsData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Role name is required");
    
    setIsSubmitting(true);
    try {
      await saveRoleMutation({ data: formData });
      toast.success("Role saved successfully");
      setIsModalOpen(false);
      setFormData({ name: "", description: "", permissionIds: [] });
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to save role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = (id: string) => {
    setFormData(prev => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(id) 
        ? prev.permissionIds.filter(pid => pid !== id)
        : [...prev.permissionIds, id]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
         <button onClick={() => setIsModalOpen(true)} className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"><Plus className="h-4 w-4" /> Create Role</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map(role => (
          <div key={role.id} className="surface-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><Shield className="h-5 w-5" /><h3 className="font-bold">{role.name}</h3></div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{role.description}</p>
          </div>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Create Custom Role</DialogTitle>
              <DialogDescription>Define a role and its associated permissions.</DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="roleName">Role Name</Label>
                <Input id="roleName" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Content Manager" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="What can this role do?" />
              </div>
              
              <div className="space-y-4">
                <Label className="text-base font-bold">Permissions</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {permissions.map((perm) => (
                    <div key={perm.id} className="flex items-start space-x-3 space-y-0 rounded-md border p-3 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => togglePermission(perm.id)}>
                      <Checkbox id={perm.id} checked={formData.permissionIds.includes(perm.id)} onCheckedChange={() => togglePermission(perm.id)} />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor={perm.id} className="text-sm font-medium leading-none cursor-pointer">{perm.name}</label>
                        {perm.description && <p className="text-xs text-muted-foreground line-clamp-1">{perm.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <DialogFooter className="p-6 pt-2 border-t bg-muted/20">
              <button type="submit" disabled={isSubmitting} className="btn-brand w-full py-2.5 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Save Role
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
