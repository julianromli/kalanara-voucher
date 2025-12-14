"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, PencilEdit01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { createAdminUser, updateAdminUserRole, deactivateAdminUser } from "@/lib/actions/admin-users";
import type { Admin } from "@/lib/database.types";

interface AdminUsersClientProps {
  initialUsers: Admin[];
}

const ROLE_COLORS = {
  SUPER_ADMIN: "bg-red-100 text-red-800",
  MANAGER: "bg-blue-100 text-blue-800",
  STAFF: "bg-gray-100 text-gray-800"
} as const;

export function AdminUsersClient({ initialUsers }: AdminUsersClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: "",
    name: "",
    role: "STAFF" as const
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async () => {
    try {
      const result = await createAdminUser(newUserForm);
      if (result) {
        setUsers([result, ...users]);
        setIsCreateDialogOpen(false);
        setNewUserForm({ email: "", name: "", role: "STAFF" });
        showToast("Admin user created successfully", "success");
      }
    } catch (error) {
      showToast("Failed to create admin user", "error");
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    const previousUsers = [...users];
    setUsers(users.map(user => 
      user.id === userId ? { ...user, role: newRole as any } : user
    ));

    try {
      const result = await updateAdminUserRole(userId, newRole as any);
      if (!result) {
        setUsers(previousUsers);
        showToast("Failed to update user role", "error");
      }
    } catch {
      setUsers(previousUsers);
      showToast("Failed to update user role", "error");
    }
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <DashboardHeader title="User Management" showActions={false} />
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Manage admin users and permissions
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <HugeiconsIcon icon={PlusSignIcon} className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>

          <div className="bg-card rounded-2xl shadow-spa border border-border p-4">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg"
              >
                <option value="ALL">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="STAFF">Staff</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent/50">
                    <th className="text-left p-4">Name</th>
                    <th className="text-left p-4">Email</th>
                    <th className="text-left p-4">Role</th>
                    <th className="text-left p-4">Created</th>
                    <th className="text-right p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-accent/50">
                      <td className="p-4">
                        <div className="font-medium">{user.name}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="p-4">
                        <Badge className={ROLE_COLORS[user.role]}>
                          {user.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleUpdate(user.id, e.target.value)}
                            className="px-2 py-1 text-sm border border-border rounded"
                          >
                            <option value="SUPER_ADMIN">Super Admin</option>
                            <option value="MANAGER">Manager</option>
                            <option value="STAFF">Staff</option>
                          </select>
                          <Button size="sm" variant="outline">
                            <HugeiconsIcon icon={PencilEdit01Icon} className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No admin users found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Admin User</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({...newUserForm, name: e.target.value})}
                placeholder="Enter full name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                placeholder="Enter email address"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                value={newUserForm.role}
                onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value as any})}
                className="w-full px-3 py-2 border border-border rounded-lg"
              >
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="STAFF">Staff</option>
              </select>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateUser}>
                Create User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
