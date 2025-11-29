import { create } from "zustand";

interface AdminState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
