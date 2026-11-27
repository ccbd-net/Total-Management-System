import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.ts';
import type { AnalyticsSummary, WeeklyTrendsSummary } from '../types/index.ts';
import { useDataSync } from '../hooks/useDataSync.ts';
import { formatTaka, toBengaliDigits, getTodayDhakaDate } from '../utils/formatters.ts';
import { WeeklyTrendsChart } from '../components/WeeklyTrendsChart.tsx';
import { DateInput } from '../components/DateInput.tsx';
import { getWeekStartSaturday, addDaysToDateStr } from '../components/WeeklyScheduleTimeline.tsx';
import {
  Ticket,
  Armchair,
  Bus,
  BadgeDollarSign,
  AlertCircle,
  Calendar,
  TrendingUp,
  RefreshCw,
  ArrowUpRight,
  TableProperties,
} from 'lucide-react';

export const DashboardPage: React.FC<{ onNavigateTo: (tab: any) => void }> = ({ onNavigateTo }) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDhakaDate());
  const [weekStartDate, setWeekStartDate] = useState<string>(() =>
    getWeekStartSaturday(getTodayDhakaDate())
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [weeklyLoading, setWeeklyLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyTrendsSummary | null>(null);

  const fetchAnalytics = useCallback(async (dateStr: string) => {
    setLoading(true);
    try {
      const data = await api.getAnalyticsSummary(dateStr);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeeklyTrends = useCallback(async (wStart: string) => {
    setWeeklyLoading(true);
    try {
      const wEnd = addDaysToDateStr(wStart, 6);
      const data = await api.getWeeklyTrends({ startDate: wStart, endDate: wEnd });
      setWeeklyTrends(data);
    } catch (err) {
      console.error('Failed to load weekly trends:', err);
    } finally {
      setWeeklyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(selectedDate);
  }, [selectedDate, fetchAnalytics]);

  useEffect(() => {
    fetchWeeklyTrends(weekStartDate);
  }, [weekStartDate, fetchWeeklyTrends]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setWeekStartDate(getWeekStartSaturday(newDate));
  };

  useDataSync(
    useCallback(() => {
      fetchAnalytics(selectedDate);
      fetchWeeklyTrends(weekStartDate);
    }, [selectedDate, weekStartDate, fetchAnalytics, fetchWeeklyTrends])
  );

  const currentWeekStart = getWeekStartSaturday(getTodayDhakaDate());
  const isCurrentWeek = weekStartDate === currentWeekStart;

  const vehicleRows = summary?.vehicleWiseCollections || [];
  const totalVehicleUp = vehicleRows.reduce((acc, v) => acc + (v.upCollection || 0), 0);
  const totalVehicleDown = vehicleRows.reduce((acc, v) => acc + (v.downCollection || 0), 0);
  const totalVehicleAll = vehicleRows.reduce((acc, v) => acc + (v.total || 0), 0);

  const counterRows = summary?.counterWiseSales || [];
  const totalCounterSeats = counterRows.reduce((acc, c) => acc + (c.seatsSold || 0), 0);
  const totalCounterRev = counterRows.reduce((acc, c) => acc + (c.totalRevenue || 0), 0);

  return (
    <div className="space-y-3">
      {/* Compact Excel Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#1d4ed8] text-white flex items-center justify-center shrink-0">
            <TableProperties className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-slate-950 truncate">
              অপারেশন ড্যাশবোর্ড ও হিসাব শীট
            </h2>
            <p className="hidden sm:block text-[10px] text-slate-600 leading-tight">
              দৈনিক বুকিং, আসন বিক্রয়, রাজস্ব ও গাড়ির ট্রিপ সামারি
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 bg-[#f8fafc] px-2.5 py-1 rounded-lg border border-slate-200 text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-[#1d4ed8] shrink-0" />
            <DateInput
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent font-bold text-slate-950 outline-none cursor-pointer text-[11px]"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              fetchAnalytics(selectedDate);
              fetchWeeklyTrends(weekStartDate);
            }}
            className="p-1.5 bg-[#eff6ff] hover:bg-[#dbeafe] border border-[#bfdbfe] text-[#1d4ed8] rounded-lg transition-colors cursor-pointer"
            title="রিফ্রেশ করুন"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || weeklyLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Excel-Sheet KPI Matrix with Royal Cobalt Blue Headers */}
      <div className="bg-slate-200 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px">
          {/* 1. Total Bookings */}
          <div className="bg-white flex flex-col">
            <div className="bg-[#1d4ed8] px-2.5 py-1 flex items-center justify-between gap-1 text-white">
              <span className="text-[10px] font-bold truncate">মোট বুকিং</span>
              <Ticket className="w-3 h-3 shrink-0 text-[#dbeafe]" />
            </div>
            <div className="px-2.5 py-1.5 flex items-baseline justify-between gap-1">
              <span className="text-sm sm:text-base font-black text-slate-950 tabular-nums">
                {toBengaliDigits(summary?.totalBookings || 0)}
              </span>
              <span className="text-[10px] text-slate-600 truncate">টি অর্ডার</span>
            </div>
          </div>

          {/* 2. Seats Sold */}
          <div className="bg-white flex flex-col">
            <div className="bg-[#1e40af] px-2.5 py-1 flex items-center justify-between gap-1 text-white">
              <span className="text-[10px] font-bold truncate">বিক্রিত আসন</span>
              <Armchair className="w-3 h-3 shrink-0 text-[#dbeafe]" />
            </div>
            <div className="px-2.5 py-1.5 flex items-baseline justify-between gap-1">
              <span className="text-sm sm:text-base font-black text-slate-950 tabular-nums">
                {toBengaliDigits(summary?.seatsSold || 0)}
              </span>
              <span className="text-[10px] text-slate-600 truncate">টি আসন</span>
            </div>
          </div>

          {/* 3. Total Collections */}
          <div className="bg-white flex flex-col">
            <div className="bg-[#1d4ed8] px-2.5 py-1 flex items-center justify-between gap-1 text-white">
              <span className="text-[10px] font-bold truncate">মোট রাজস্ব</span>
              <BadgeDollarSign className="w-3 h-3 shrink-0 text-[#dbeafe]" />
            </div>
            <div className="px-2.5 py-1.5">
              <div className="text-sm sm:text-base font-black text-[#1d4ed8] tabular-nums leading-tight">
                {formatTaka(summary?.totalCollections || 0)}
              </div>
              <div className="text-[9.5px] text-slate-600 tabular-nums truncate">
                সিট: {formatTaka(summary?.totalSeatCollections || 0)} · মাল: {formatTaka(summary?.totalCargoCollections || 0)}
              </div>
            </div>
          </div>

          {/* 4. Active Trips */}
          <div className="bg-white flex flex-col">
            <div className="bg-[#1e40af] px-2.5 py-1 flex items-center justify-between gap-1 text-white">
              <span className="text-[10px] font-bold truncate">সক্রিয় ট্রিপ</span>
              <Bus className="w-3 h-3 shrink-0 text-[#dbeafe]" />
            </div>
            <div className="px-2.5 py-1.5 flex items-baseline justify-between gap-1">
              <span className="text-sm sm:text-base font-black text-slate-950 tabular-nums">
                {toBengaliDigits(summary?.activeTrips || 0)}
              </span>
              <span className="text-[10px] text-slate-600 truncate">টি শিডিউল</span>
            </div>
          </div>

          {/* 5. Ticket Sales */}
          <div className="bg-white flex flex-col">
            <div className="bg-[#1d4ed8] px-2.5 py-1 flex items-center justify-between gap-1 text-white">
              <span className="text-[10px] font-bold truncate">টিকিট সেলস</span>
              <TrendingUp className="w-3 h-3 shrink-0 text-[#dbeafe]" />
            </div>
            <div className="px-2.5 py-1.5 flex items-baseline justify-between gap-1">
              <span className="text-sm sm:text-base font-black text-slate-950 tabular-nums">
                {toBengaliDigits(summary?.ticketSales || 0)}
              </span>
              <span className="text-[10px] text-slate-600 truncate">টি ভাউচার</span>
            </div>
          </div>

          {/* 6. Unreconciled Trips */}
          <div className="bg-white flex flex-col">
            <div className={`${(summary?.unreconciledTrips || 0) > 0 ? 'bg-[#1e3a8a]' : 'bg-[#1e40af]'} px-2.5 py-1 flex items-center justify-between gap-1 text-white`}>
              <span className="text-[10px] font-bold truncate">অসমন্বিত ট্রিপ</span>
              <AlertCircle className={`w-3 h-3 shrink-0 ${(summary?.unreconciledTrips || 0) > 0 ? 'text-[#93c5fd]' : 'opacity-90'}`} />
            </div>
            <div className="px-2.5 py-1.5 flex items-baseline justify-between gap-1">
              <span className={`text-sm sm:text-base font-black tabular-nums ${(summary?.unreconciledTrips || 0) > 0 ? 'text-[#1e3a8a]' : 'text-slate-950'}`}>
                {toBengaliDigits(summary?.unreconciledTrips || 0)}
              </span>
              <span className="text-[10px] text-slate-600 truncate">সমন্বয় বাকি</span>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Action Bar */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onNavigateTo('seat_booking')}
          className="px-2.5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl shadow-2xs transition-colors flex items-center justify-between gap-1.5 cursor-pointer"
        >
          <div className="min-w-0 text-left">
            <div className="text-[9px] sm:text-[10px] text-[#dbeafe] leading-none truncate">সরাসরি বুকিং</div>
            <div className="text-[11px] sm:text-xs font-bold mt-0.5 truncate">সিট বুকিং</div>
          </div>
          <Armchair className="w-4 h-4 shrink-0 text-white" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTo('daily_schedules')}
          className="px-2.5 py-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-xl shadow-2xs transition-colors flex items-center justify-between gap-1.5 cursor-pointer"
        >
          <div className="min-w-0 text-left">
            <div className="text-[9px] sm:text-[10px] text-[#bfdbfe] leading-none truncate">শিডিউল তালিকা</div>
            <div className="text-[11px] sm:text-xs font-bold mt-0.5 truncate">ট্রিপ শিডিউল</div>
          </div>
          <Bus className="w-4 h-4 shrink-0 text-[#93c5fd]" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTo('ticket_print')}
          className="px-2.5 py-2 bg-white hover:bg-[#eff6ff] text-[#1e3a8a] border border-[#bfdbfe] rounded-xl shadow-2xs transition-colors flex items-center justify-between gap-1.5 cursor-pointer"
        >
          <div className="min-w-0 text-left">
            <div className="text-[9px] sm:text-[10px] text-[#1d4ed8] leading-none truncate">রিসিট ও প্রিন্ট</div>
            <div className="text-[11px] sm:text-xs font-bold mt-0.5 truncate">টিকিট প্রিন্ট</div>
          </div>
          <Ticket className="w-4 h-4 shrink-0 text-[#1d4ed8]" />
        </button>
      </div>

      {/* Excel-Sheet Analytics Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Table 1: Vehicle-Wise Up/Down Collections */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
          <div className="bg-[#1e3a8a] px-3 py-2 flex items-center justify-between gap-2 text-white">
            <div>
              <h3 className="font-bold text-xs">গাড়ি-ভিত্তিক আপ ও ডাউন রাজস্ব</h3>
              <p className="text-[10px] text-[#dbeafe] leading-tight">প্রতিটি গাড়ির আপ এবং ডাউন কালেকশন শীট</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTo('reconciliation')}
              className="text-[11px] font-bold text-[#1e3a8a] hover:bg-[#eff6ff] flex items-center gap-0.5 px-2.5 py-1 bg-white rounded-lg shrink-0 cursor-pointer shadow-2xs"
            >
              <span>সমন্বয়</span>
              <ArrowUpRight className="w-3 h-3 text-[#1d4ed8]" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-[11px] tabular-nums">
              <thead>
                <tr className="bg-[#1d4ed8] text-white border-b border-[#1e40af]">
                  <th className="py-1.5 px-2 text-center font-bold border-r border-blue-600/60 w-8">#</th>
                  <th className="py-1.5 px-2 text-left font-bold border-r border-blue-600/60">গাড়ির নম্বর</th>
                  <th className="py-1.5 px-2 text-right font-bold border-r border-blue-600/60">আপ (৳)</th>
                  <th className="py-1.5 px-2 text-right font-bold border-r border-blue-600/60">ডাউন (৳)</th>
                  <th className="py-1.5 px-2 text-right font-bold">মোট (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {vehicleRows.length > 0 ? (
                  vehicleRows.map((veh, idx) => (
                    <tr
                      key={`${veh.regNo}-${idx}`}
                      className="odd:bg-white even:bg-[#f1f5f9] hover:bg-[#eff6ff] transition-colors"
                    >
                      <td className="py-1.5 px-2 text-center text-slate-600 border-r border-slate-200">
                        {toBengaliDigits(idx + 1)}
                      </td>
                      <td className="py-1.5 px-2 font-bold text-slate-950 border-r border-slate-200 whitespace-nowrap">
                        {veh.regNo}
                      </td>
                      <td className="py-1.5 px-2 text-right font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {formatTaka(veh.upCollection)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-semibold text-[#1d4ed8] border-r border-slate-200 whitespace-nowrap">
                        {formatTaka(veh.downCollection)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-black text-slate-950 whitespace-nowrap">
                        {formatTaka(veh.total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-5 text-center text-[11px] text-slate-500">
                      এই তারিখে কোনো ট্রিপ তথ্য পাওয়া যায়নি
                    </td>
                  </tr>
                )}
              </tbody>
              {vehicleRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eff6ff] border-t-2 border-[#bfdbfe] font-bold text-[#1e3a8a]">
                    <td colSpan={2} className="py-1.5 px-2 text-right border-r border-[#bfdbfe]">
                      সর্বমোট ({toBengaliDigits(vehicleRows.length)} গাড়ি)
                    </td>
                    <td className="py-1.5 px-2 text-right text-[#1e3a8a] border-r border-[#bfdbfe] whitespace-nowrap">
                      {formatTaka(totalVehicleUp)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-[#1d4ed8] border-r border-[#bfdbfe] whitespace-nowrap">
                      {formatTaka(totalVehicleDown)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-black text-[#1e3a8a] whitespace-nowrap">
                      {formatTaka(totalVehicleAll)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Table 2: Counter-Wise Seat Sales & Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
          <div className="bg-[#1e3a8a] px-3 py-2 flex items-center justify-between gap-2 text-white">
            <div>
              <h3 className="font-bold text-xs">কাউন্টার-ভিত্তিক বিক্রয় ও রাজস্ব</h3>
              <p className="text-[10px] text-[#dbeafe] leading-tight">প্রতিটি কাউন্টারের আসন সংখ্যা ও মোট আদায়</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTo('counters')}
              className="text-[11px] font-bold text-[#1e3a8a] hover:bg-[#eff6ff] flex items-center gap-0.5 px-2.5 py-1 bg-white rounded-lg shrink-0 cursor-pointer shadow-2xs"
            >
              <span>কাউন্টার</span>
              <ArrowUpRight className="w-3 h-3 text-[#1d4ed8]" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-[11px] tabular-nums">
              <thead>
                <tr className="bg-[#1d4ed8] text-white border-b border-[#1e40af]">
                  <th className="py-1.5 px-2 text-center font-bold border-r border-blue-600/60 w-8">#</th>
                  <th className="py-1.5 px-2 text-left font-bold border-r border-blue-600/60">কাউন্টার</th>
                  <th className="py-1.5 px-2 text-center font-bold border-r border-blue-600/60">কোড</th>
                  <th className="py-1.5 px-2 text-right font-bold border-r border-blue-600/60">সিট</th>
                  <th className="py-1.5 px-2 text-right font-bold border-r border-blue-600/60">মোট টাকা</th>
                  <th className="py-1.5 px-2 text-right font-bold w-11">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {counterRows.length > 0 ? (
                  counterRows.map((cnt, idx) => {
                    const totalRev = summary?.totalCollections || 1;
                    const revShare = Math.round((cnt.totalRevenue / totalRev) * 100);
                    return (
                      <tr
                        key={cnt.counterId ? cnt.counterId : `${cnt.counterCode}-${cnt.counterName}-${idx}`}
                        className="odd:bg-white even:bg-[#f1f5f9] hover:bg-[#eff6ff] transition-colors"
                      >
                        <td className="py-1.5 px-2 text-center text-slate-600 border-r border-slate-200">
                          {toBengaliDigits(idx + 1)}
                        </td>
                        <td className="py-1.5 px-2 font-bold text-slate-950 border-r border-slate-200">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15"
                              style={{ backgroundColor: cnt.seatColor }}
                            />
                            <span className="truncate">{cnt.counterName}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {cnt.counterCode}
                        </td>
                        <td className="py-1.5 px-2 text-right font-semibold text-slate-950 border-r border-slate-200 whitespace-nowrap">
                          {toBengaliDigits(cnt.seatsSold)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-bold text-slate-950 border-r border-slate-200 whitespace-nowrap">
                          {formatTaka(cnt.totalRevenue)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-700 whitespace-nowrap">
                          {toBengaliDigits(revShare)}%
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-5 text-center text-[11px] text-slate-500">
                      এই তারিখে কোনো কাউন্টার বিক্রয় পাওয়া যায়নি
                    </td>
                  </tr>
                )}
              </tbody>
              {counterRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eff6ff] border-t-2 border-[#bfdbfe] font-bold text-[#1e3a8a]">
                    <td colSpan={3} className="py-1.5 px-2 text-right border-r border-[#bfdbfe]">
                      সর্বমোট ({toBengaliDigits(counterRows.length)} কাউন্টার)
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-[#bfdbfe] whitespace-nowrap">
                      {toBengaliDigits(totalCounterSeats)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-black border-r border-[#bfdbfe] whitespace-nowrap">
                      {formatTaka(totalCounterRev)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-[#1e3a8a]">১০০%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Weekly Ticket Sales & Fuel Expense Trends (Compact Excel Card) */}
      <WeeklyTrendsChart
        data={weeklyTrends}
        loading={weeklyLoading}
        selectedDate={selectedDate}
        onShiftWeek={(deltaDays) =>
          setWeekStartDate((prev) => addDaysToDateStr(prev, deltaDays))
        }
        onResetCurrentWeek={() => setWeekStartDate(currentWeekStart)}
        isCurrentWeek={isCurrentWeek}
        onNavigateTo={onNavigateTo}
      />
    </div>
  );
};
