"use client";

import { useState } from "react";
import { TrendingUp, Calendar as CalendarIcon, ChevronDown } from "lucide-react";
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

export function ChartCard({ data, title = "Revenue (Last 7 Days)" }: ChartCardProps) {
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);

  const isDark = resolvedTheme === "dark";
  const barColor = isDark ? "#94a67a" : "#5d7048";
  const labelColor = isDark ? "#B4B4B4" : "#95979d";
  const gridColor = isDark ? "#2A2A2A" : "#E8E9ED";

  const formatDateRange = (date: Date | undefined) => {
    if (!date) return "This Week";
    const month = date.toLocaleDateString("en-US", { month: "long" });
    return month;
  };

  return (
    <div className="relative rounded-xl border border-border bg-card p-6 max-h-[400px] overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
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
              <CalendarIcon className="size-4" />
              {formatDateRange(date)}
              <ChevronDown className="size-3" />
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
            style={{ backgroundColor: barColor }}
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
              stroke={gridColor}
              strokeWidth={1}
            />
            <XAxis
              dataKey="day"
              tick={{
                fill: labelColor,
                fontSize: 12,
                fontWeight: 400,
              }}
              axisLine={false}
              tickLine={false}
              tickMargin={13}
            />
            <YAxis
              tick={{
                fill: labelColor,
                fontSize: 12,
                fontWeight: 400,
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                return value.toString();
              }}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1a2115" : "#fff",
                border: `1px solid ${gridColor}`,
                borderRadius: 8,
              }}
              formatter={(value: number) => [formatCurrency(value), "Revenue"]}
              labelStyle={{ color: isDark ? "#fff" : "#000" }}
            />
            <Bar
              dataKey="revenue"
              fill={barColor}
              radius={[4, 4, 0, 0]}
              barSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
