"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChartIncreaseIcon, Calendar01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
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
}

const CHART_COLORS = {
  light: {
    bar: "#5d7048",
    barHover: "#4a5a3b",
    label: "#5d4a3b",
    grid: "#e8ebe3",
    tooltip: {
      bg: "#ffffff",
      border: "#d2d9c8",
      text: "#343f2c",
    },
  },
  dark: {
    bar: "#94a67a",
    barHover: "#b3c0a1",
    label: "#d5c6b1",
    grid: "#343f2c",
    tooltip: {
      bg: "#1a2115",
      border: "#3d4932",
      text: "#f3efe8",
    },
  },
};

export function ChartCard({
  data,
  title = "Revenue (Last 7 Days)",
}: ChartCardProps) {
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);

  const isDark = resolvedTheme === "dark";
  const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;

  const formatDateRange = (selectedDate: Date | undefined) => {
    if (!selectedDate) return "This Week";
    return selectedDate.toLocaleDateString("en-US", { month: "long" });
  };

  return (
    <div className="admin-surface flex h-[400px] flex-col p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon
            icon={ChartIncreaseIcon}
            className="size-4 shrink-0 text-muted-foreground"
          />
          <h2 className="truncate text-[15px] font-medium tracking-tight text-foreground">
            {title}
          </h2>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-2 px-2.5 py-1 text-xs"
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

      <div className="mb-4 flex items-center justify-center gap-5">
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

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
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
              formatter={(value) => {
                const revenueValue =
                  typeof value === "number" ? value : Number(value ?? 0);
                return [formatCurrency(revenueValue), "Revenue"];
              }}
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
