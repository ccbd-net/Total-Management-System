import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { WeeklyTrendsSummary, WeeklyTrendDay } from '../types/index.ts';
import { formatTaka, toBengaliDigits, formatBengaliDate } from '../utils/formatters.ts';
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Fuel,
  ArrowUpRight,
  Armchair,
} from 'lucide-react';

interface WeeklyTrendsChartProps {
  data: WeeklyTrendsSummary | null;
  loading: boolean;
  selectedDate: string;
  onShiftWeek: (deltaDays: number) => void;
  onResetCurrentWeek: () => void;
  isCurrentWeek: boolean;
  onNavigateTo: (tab: any) => void;
}

type ChartMode = 'area' | 'bar';

function formatShortYAxisTaka(value: number): string {
  if (value === 0) return '৳০';
  if (Math.abs(value) >= 100000) {
    const lakh = Math.round((value / 100000) * 10) / 10;
    return `৳${toBengaliDigits(lakh)}লক্ষ`;
  }
  if (Math.abs(value) >= 1000) {
    const k = Math.round((value / 1000) * 10) / 10;
    return `৳${toBengaliDigits(k)}হাজার`;
  }
  return `৳${toBengaliDigits(Math.round(value))}`;
}

function formatDayMonthShort(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${toBengaliDigits(parts[2])}/${toBengaliDigits(parts[1])}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: WeeklyTrendDay;
  }>;
}

const WeeklyChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const day = payload[0]?.payload;
  if (!day) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-3 text-xs min-w-[210px]">
      <div className="font-bold text-slate-900 pb-2 mb-2 border-b border-slate-100 flex items-center justify-between gap-3">
        <span>{day.dayFullBn}</span>
        <span className="text-[11px] font-medium text-slate-500 tabular-nums">
          {formatBengaliDate(day.date)}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 shrink-0" />
            <span>টিকিট বিক্রয়</span>
          </div>
          <span className="font-bold text-emerald-700 tabular-nums">
            {formatTaka(day.ticketSalesAmount)}
          </span>
        </div>

        <div className="text-[11px] text-slate-400 pl-4 tabular-nums">
          {toBengaliDigits(day.ticketsCount)} টি টিকিট · {toBengaliDigits(day.seatsSold)} আসন
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 shrink-0" />
            <span>ফুয়েল খরচ</span>
          </div>
          <span className="font-bold text-amber-700 tabular-nums">
            {formatTaka(day.fuelExpenseAmount)}
          </span>
        </div>

        <div className="text-[11px] text-slate-400 pl-4 tabular-nums">
          ব্যবহৃত তেল: {toBengaliDigits(day.fuelLiters)} লিটার
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 mt-1.5 border-t border-slate-100 font-bold">
          <span className="text-slate-700">দৈনিক নীট ব্যালেন্স</span>
          <span
            className={`tabular-nums ${
              day.netBalance >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}
          >
            {formatTaka(day.netBalance)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const WeeklyTrendsChart: React.FC<WeeklyTrendsChartProps> = ({
  data,
  loading,
  selectedDate,
  onShiftWeek,
  onResetCurrentWeek,
  isCurrentWeek,
  onNavigateTo,
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>('area');

  const days = data?.days || [];
  const totals = data?.totals;

  const hasAnyActivity = days.some(
    (d) => d.ticketSalesAmount > 0 || d.fuelExpenseAmount > 0
  );

  const renderCustomTick = (props: any) => {
    const { x, y, payload } = props;
    const matched = days.find((d) => d.date === payload?.value);
    const isSelected = payload?.value === selectedDate;
    const dayLabel = matched?.dayShortBn || '';
    const dateLabel = formatDayMonthShort(payload?.value || '');

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={13}
          textAnchor="middle"
          fill={isSelected ? '#059669' : '#334155'}
          fontSize={11}
          fontWeight={isSelected ? 700 : 600}
        >
          {dayLabel}
        </text>
        <text
          x={0}
          y={0}
          dy={27}
          textAnchor="middle"
          fill={isSelected ? '#059669' : '#94a3b8'}
          fontSize={10}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {dateLabel}
        </text>
      </g>
    );
  };

  return (
    <section
      aria-label="সাপ্তাহিক টিকিট বিক্রয় ও ফুয়েল খরচ প্রবণতা"
      className="bg-white border border-[#a7d7c5] rounded-xl shadow-2xs overflow-hidden"
    >
      {/* Compact Spreadsheet Toolbar Header */}
      <div className="bg-[#0b2820] px-3 py-2 border-b border-[#071d17] flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-white">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="text-xs sm:text-sm font-bold text-white">
            সাপ্তাহিক টিকিট বিক্রয় ও ফুয়েল খরচ প্রবণতা
          </h3>
          <span className="text-[10px] sm:text-[11px] text-emerald-200 tabular-nums">
            ({data
              ? `${formatBengaliDate(data.startDate)} – ${formatBengaliDate(data.endDate)}`
              : 'চলতি সপ্তাহের হিসাব'})
          </span>
        </div>

        {/* Interactive Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Week Stepper */}
          <div className="flex items-center bg-white/95 border border-emerald-200 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => onShiftWeek(-7)}
              className="p-1 text-slate-700 hover:text-slate-950 hover:bg-emerald-50 rounded transition-colors shrink-0 cursor-pointer"
              title="পূর্বের সপ্তাহ"
              aria-label="পূর্বের সপ্তাহ"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onResetCurrentWeek}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isCurrentWeek
                  ? 'bg-[#0b2820] text-white'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              চলতি সপ্তাহ
            </button>
            <button
              type="button"
              onClick={() => onShiftWeek(7)}
              className="p-1 text-slate-700 hover:text-slate-950 hover:bg-emerald-50 rounded transition-colors shrink-0 cursor-pointer"
              title="পরের সপ্তাহ"
              aria-label="পরের সপ্তাহ"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chart Type Segmented Control */}
          <div className="flex items-center bg-white/95 border border-emerald-200 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setChartMode('area')}
              className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'area'
                  ? 'bg-[#0d9488] text-white'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>লাইন</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'bar'
                  ? 'bg-[#0f766e] text-white'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              <span>বার</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTo('fuel_management')}
            className="text-[11px] font-bold text-[#0b2820] hover:bg-emerald-50 flex items-center gap-0.5 px-2 py-1 bg-white rounded-lg whitespace-nowrap shrink-0 shadow-2xs cursor-pointer"
          >
            <span>ফুয়েল লগ</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Weekly Totals Excel Strip */}
      <div className="grid grid-cols-3 divide-x divide-[#d1e7de] border-b border-[#a7d7c5] bg-[#f4fbf8]">
        <div className="px-2.5 py-2 sm:px-3.5">
          <div className="text-[10px] font-bold text-slate-500">সাপ্তাহিক বিক্রয়</div>
          <div className="text-xs sm:text-base font-black text-emerald-700 mt-0.5 tabular-nums">
            {formatTaka(totals?.totalTicketSales || 0)}
          </div>
          <div className="text-[10px] text-slate-500 tabular-nums truncate">
            {toBengaliDigits(totals?.totalTicketsCount || 0)} টিকিট · {toBengaliDigits(totals?.totalSeatsSold || 0)} আসন
          </div>
        </div>

        <div className="px-2.5 py-2 sm:px-3.5">
          <div className="text-[10px] font-bold text-slate-500">সাপ্তাহিক ফুয়েল</div>
          <div className="text-xs sm:text-base font-black text-amber-700 mt-0.5 tabular-nums">
            {formatTaka(totals?.totalFuelExpense || 0)}
          </div>
          <div className="text-[10px] text-slate-500 tabular-nums truncate">
            {toBengaliDigits(totals?.totalFuelLiters || 0)} লিটার তেল
          </div>
        </div>

        <div className="px-2.5 py-2 sm:px-3.5">
          <div className="text-[10px] font-bold text-slate-500">নীট উদ্বৃত্ত</div>
          <div
            className={`text-xs sm:text-base font-black mt-0.5 tabular-nums ${
              (totals?.totalNetBalance || 0) >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}
          >
            {formatTaka(totals?.totalNetBalance || 0)}
          </div>
          <div className="text-[10px] text-slate-500 tabular-nums truncate">
            ফুয়েল ব্যয় {toBengaliDigits(totals?.fuelToSalesRatio || 0)}%
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="p-2.5 sm:p-3.5">
        {loading && !data ? (
          <div className="h-[210px] w-full rounded-lg bg-slate-100 animate-pulse" />
        ) : (
          <div className="space-y-2">
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                  <span className="font-semibold text-slate-700">টিকিট বিক্রয় (৳)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                  <span className="font-semibold text-slate-700">ফুয়েল খরচ (৳)</span>
                </div>
              </div>
              {!hasAnyActivity && !loading && (
                <span className="text-[10px] text-slate-400">
                  এই সপ্তাহে এখনো কোনো এন্ট্রি নেই
                </span>
              )}
            </div>

            <div className="relative h-[210px] sm:h-[235px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'area' ? (
                  <AreaChart
                    data={days}
                    margin={{ top: 8, right: 8, left: 0, bottom: 16 }}
                  >
                    <defs>
                      <linearGradient id="ticketSalesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="fuelExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#d97706" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#d97706" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      tick={renderCustomTick}
                      interval={0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tickFormatter={formatShortYAxisTaka}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                    />
                    <Tooltip
                      content={<WeeklyChartTooltip />}
                      cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ticketSalesAmount"
                      name="টিকিট বিক্রয়"
                      stroke="#059669"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#ticketSalesGrad)"
                      dot={{ r: 3, fill: '#059669', strokeWidth: 1.5, stroke: '#ffffff' }}
                      activeDot={{ r: 5, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="fuelExpenseAmount"
                      name="ফুয়েল খরচ"
                      stroke="#d97706"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#fuelExpenseGrad)"
                      dot={{ r: 3, fill: '#d97706', strokeWidth: 1.5, stroke: '#ffffff' }}
                      activeDot={{ r: 5, fill: '#d97706', strokeWidth: 2, stroke: '#ffffff' }}
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={days}
                    margin={{ top: 8, right: 8, left: 0, bottom: 16 }}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      tick={renderCustomTick}
                      interval={0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tickFormatter={formatShortYAxisTaka}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                    />
                    <Tooltip
                      content={<WeeklyChartTooltip />}
                      cursor={{ fill: 'rgba(241, 245, 249, 0.7)' }}
                    />
                    <Bar
                      dataKey="ticketSalesAmount"
                      name="টিকিট বিক্রয়"
                      fill="#059669"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="fuelExpenseAmount"
                      name="ফুয়েল খরচ"
                      fill="#d97706"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>

              {!hasAnyActivity && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[1px] rounded-lg text-center px-3">
                  <p className="text-xs font-bold text-slate-700">
                    এই সপ্তাহে এখনো কোনো টিকিট বিক্রয় বা ফুয়েল খরচ নেই
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={() => onNavigateTo('seat_booking')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0d9488] hover:bg-[#0f766e] text-white text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Armchair className="w-3 h-3" />
                      <span>সিট বুকিং</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTo('fuel_management')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0b2820] hover:bg-[#071d17] text-white text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Fuel className="w-3 h-3" />
                      <span>ফুয়েল এন্ট্রি</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
