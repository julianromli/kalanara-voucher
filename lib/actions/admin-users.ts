"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import type { Admin, AdminInsert, AdminRole } from "@/lib/database.types";

export async function createAdminUser(
  userData: {
    email: string;
    name: string;
    role: AdminRole;
  }
): Promise<Admin | null> {
  const supabase = getAdminClient();
  
  // Create auth user first, then admin record
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: userData.email,
    password: generateTempPassword(),
    email_confirm: true
  });

  if (authError || !authUser.user) {
    console.error("Error creating auth user:", authError);
    return null;
  }

  const { data, error } = await supabase
    .from("admins")
    .insert({
      id: authUser.user.id,
      email: userData.email,
      name: userData.name,
      role: userData.role
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating admin record:", error);
    return null;
  }

  return data;
}

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
}

export async function getAdminUsers(): Promise<Admin[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin users:", error);
    return [];
  }

  return data || [];
}

export async function updateAdminUserRole(
  id: string,
  role: AdminRole
): Promise<Admin | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("admins")
    .update({ role })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating admin user role:", error);
    return null;
  }

  return data;
}

export async function deactivateAdminUser(id: string): Promise<Admin | null> {
  const supabase = getAdminClient();
  
  // Soft delete by setting role to inactive (assuming STAFF is lowest permission)
  const { data, error } = await supabase
    .from("admins")
    .update({ role: 'STAFF' as AdminRole }) 
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error deactivating admin user:", error);
    return null;
  }

  return data;
}
