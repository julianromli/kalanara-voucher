"use client";

import { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChartIncreaseIcon, Calendar01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/constants";

interface ChartDataPoint {
  day: string;
  revenue: number;
  orders: number;
}

interface ChartCardProps {
  data: ChartDataPoint[];
  title?: string;
  animationDelay?: number;
}

// Theme-aware colors using Kalanara's sage palette
const CHART_COLORS = {
  light: {
    bar: "#5d7048",      // sage-600
    barHover: "#4a5a3b", // sage-700
    label: "#5d4a3b",    // sand-900
    grid: "#e8ebe3",     // sage-100
    tooltip: {
      bg: "#ffffff",
      border: "#d2d9c8", // sage-200
      text: "#343f2c",   // sage-900
    },
  },
  dark: {
    bar: "#94a67a",      // sage-400
    barHover: "#b3c0a1", // sage-300
    label: "#d5c6b1",    // sand-300
    grid: "#343f2c",     // sage-900
    tooltip: {
      bg: "#1a2115",     // sage-950
      border: "#3d4932", // sage-800
      text: "#f3efe8",   // sand-100
    },
  },
};

export function ChartCard({ data, title = "Revenue (Last 7 Days)", animationDelay = 0 }: ChartCardProps) {
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const isDark = resolvedTheme === "dark";
  const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;

  const formatDateRange = (date: Date | undefined) => {
    if (!date) return "This Week";
    const month = date.toLocaleDateString("en-US", { month: "long" });
    return month;
  };

  return (
    <div 
      className={cn(
        "relative rounded-xl border border-border bg-card p-6 max-h-[400px] overflow-y-auto",
        isMounted ? "animate-scale-in" : "opacity-0"
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={ChartIncreaseIcon} className="size-4 text-muted-foreground" />
          <h2 className="text-[15px] font-normal text-foreground tracking-tight">
            {title}
          </h2>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-2 text-xs px-[10px] py-[4px]"
            >
              <HugeiconsIcon icon={Calendar01Icon} className="size-4" />
              {formatDateRange(date)}
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(selectedDate) => {
                setDate(selectedDate);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="mb-4 flex items-center justify-center gap-[22px]">
        <div className="flex items-center gap-1.5">
          <div
            className="size-3 rounded-full"
            style={{ backgroundColor: colors.bar }}
          />
          <span className="text-xs font-medium text-muted-foreground">
            Revenue
          </span>
        </div>
      </div>

      <div className="relative">
        <ResponsiveContainer width="100%" height={237}>
          <BarChart
            data={data}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            barCategoryGap={8}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.grid}
              strokeWidth={1}
            />
            <XAxis
              dataKey="day"
              tick={{
                fill: colors.label,
                fontSize: 12,
                fontWeight: 500,
              }}
              axisLine={false}
              tickLine={false}
              tickMargin={13}
            />
            <YAxis
              tick={{
                fill: colors.label,
                fontSize: 12,
                fontWeight: 500,
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                return value.toString();
              }}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltip.bg,
                border: `1px solid ${colors.tooltip.border}`,
                borderRadius: 10,
                boxShadow: "0 4px 20px -2px rgba(93, 112, 72, 0.12)",
              }}
              formatter={(value: number) => [formatCurrency(value), "Revenue"]}
              labelStyle={{ color: colors.tooltip.text, fontWeight: 500 }}
            />
            <Bar
              dataKey="revenue"
              fill={colors.bar}
              radius={[6, 6, 0, 0]}
              barSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
