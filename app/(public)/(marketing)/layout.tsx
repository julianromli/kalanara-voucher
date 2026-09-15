import { MetaPixel } from "@/components/meta-pixel";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({
  children,
}: MarketingLayoutProps) {
  return (
    <>
      <MetaPixel />
      {children}
    </>
  );
}
