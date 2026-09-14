import { AuthProvider } from "@/context/AuthContext";

interface AdminLoginLayoutProps {
  children: React.ReactNode;
}

export default function AdminLoginLayout({
  children,
}: Readonly<AdminLoginLayoutProps>) {
  return <AuthProvider>{children}</AuthProvider>;
}
