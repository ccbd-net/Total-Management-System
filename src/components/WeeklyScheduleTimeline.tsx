import React, { useState } from 'react';
import type { Schedule, Vehicle } from '../types/index.ts';
import {
  toBengaliDigits,
  formatTaka,
  getTodayDhakaDate,
  formatBengaliDate,
  formatTime12Hour,
} from '../utils/formatters.ts';
import { DigitalClockPicker } from './DigitalClockPicker.tsx';
import { DateInput } from './DateInput.tsx';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Bus,
  GripVertical,
  ArrowRightLeft,
  Armchair,
  Clock,
  X,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

interface WeeklyScheduleTimelineProps {
  schedules: Schedule[];
  vehicles: Vehicle[];
  supervisorsList: { id: string; name: string }[];
  weekStartDate: string; // YYYY-MM-DD
  onChangeWeekStartDate: (newStart: string) => void;
  canManageTrips: boolean;
  loading?: boolean;
  onReassignTrip: (
    scheduleId: string,
    updates: {
      date?: string;
      vehicleId?: string;
      departureTime?: string;
      supervisor?: string;
      fare?: number;
      updateReason?: string;
    }
  ) => Promise<void>;
  onSelectTripForBooking?: (tripId: string) => void;
}

const BN_DAYS_SHORT = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

export function getWeekStartSaturday(anchorDateStr: string): string {
  const parts = anchorDateStr.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1));
  const dayOfWeek = d.getUTCDay(); // 0=Sun ... 6=Sat
  // Shift so Saturday (6) is offset 0: (dayOfWeek + 1) % 7
  const diffFromSat = (dayOfWeek + 1) % 7;
  d.setUTCDate(d.getUTCDate() - diffFromSat);
  return d.toISOString().split('T')[0];
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function parseTimeToMinutes(t: string): number {
  try {
    const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return 0;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  } catch {
    return 0;
  }
}

function formatDayColumnHeader(dateStr: string) {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1));
  const dayName = BN_DAYS_SHORT[d.getUTCDay()];
  return { dayName, shortDate: formatBengaliDate(dateStr) };
}

export const WeeklyScheduleTimeline: React.FC<WeeklyScheduleTimelineProps> = ({
  schedules,
  vehicles,
  supervisorsList,
  weekStartDate,
  onChangeWeekStartDate,
  canManageTrips,
  loading = false,
  onReassignTrip,
  onSelectTripForBooking,
}) => {
  const todayStr = getTodayDhakaDate();

  // Build 7 days starting from weekStartDate
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysToDateStr(weekStartDate, i));

  // Drag-and-drop state
  const [draggedTripId, setDraggedTripId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ vehicleId: string; date: string } | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  // Quick Reassignment Modal State
  const [modalTrip, setModalTrip] = useState<Schedule | null>(null);
  const [targetDate, setTargetDate] = useState<string>('');
  const [targetVehicleId, setTargetVehicleId] = useState<string>('');
  const [targetTime, setTargetTime] = useState<string>('07:00 AM');
  const [targetSupervisor, setTargetSupervisor] = useState<string>('');
  const [targetFare, setTargetFare] = useState<number>(550);
  const [updateReason, setUpdateReason] = useState<string>('');
  const [savingModal, setSavingModal] = useState<boolean>(false);

  const openReassignModal = (trip: Schedule) => {
    setModalTrip(trip);
    setTargetDate(trip.date);
    setTargetVehicleId(trip.vehicleId);
    setTargetTime(trip.departureTime || '07:00 AM');
    setTargetSupervisor(trip.supervisor || '');
    setTargetFare(trip.fare || 0);
    setUpdateReason('');
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTrip) return;
    setSavingModal(true);
    try {
      await onReassignTrip(modalTrip.id, {
        date: targetDate,
        vehicleId: targetVehicleId,
        departureTime: targetTime,
        supervisor: targetSupervisor,
        fare: targetFare,
        updateReason: updateReason || 'সাপ্তাহিক ক্যালেন্ডার থেকে পুনর্বিন্যাস',
      });
      setModalTrip(null);
    } finally {
      setSavingModal(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, sch: Schedule) => {
    if (!canManageTrips) return;
    setDraggedTripId(sch.id);
    e.dataTransfer.setData('text/plain', sch.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTripId(null);
    setDragOverCell(null);
  };

  const handleDragOver = (e: React.DragEvent, vehicleId: string, date: string) => {
    if (!canManageTrips) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCell?.vehicleId !== vehicleId || dragOverCell?.date !== date) {
      setDragOverCell({ vehicleId, date });
    }
  };

  const handleDrop = async (e: React.DragEvent, targetVehId: string, targetDateStr: string) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!canManageTrips) return;

    const tripId = e.dataTransfer.getData('text/plain') || draggedTripId;
    setDraggedTripId(null);
    if (!tripId) return;

    const trip = schedules.find((s) => s.id === tripId);
    if (!trip) return;

    // Only update if either vehicle or date changed
    if (trip.vehicleId === targetVehId && trip.date === targetDateStr) {
      return;
    }

    setReassigningId(trip.id);
    try {
      await onReassignTrip(trip.id, {
        date: targetDateStr,
        vehicleId: targetVehId,
        updateReason: 'সাপ্তাহিক ক্যালেন্ডারে ড্র্যাগ-এন্ড-ড্রপ পুনর্বিন্যাস',
      });
    } finally {
      setReassigningId(null);
    }
  };

  // Build swimlane rows: all registered vehicles + any unmatched vehicles from schedules
  const vehicleIdsSet = new Set(vehicles.map((v) => v.id));
  const extraVehiclesMap = new Map<string, Vehicle>();
  schedules.forEach((s) => {
    if (s.vehicleId && !vehicleIdsSet.has(s.vehicleId) && !extraVehiclesMap.has(s.vehicleId)) {
      extraVehiclesMap.set(s.vehicleId, {
        id: s.vehicleId,
        regNo: s.vehicleRegNo,
        seatCapacity: s.seatCapacity,
        ownerName: s.vehicleOwnerName || 'সাধারণ',
        status: 'active',
        createdAt: s.createdAt,
      });
    }
  });
  const swimlaneVehicles: Vehicle[] = [...vehicles, ...Array.from(extraVehiclesMap.values())];

  const startHeader = formatDayColumnHeader(weekDays[0]);
  const endHeader = formatDayColumnHeader(weekDays[6]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Timeline Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#f8fafc]">
        <div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#1d4ed8]" />
            <span>সাপ্তাহিক গাড়ি ও ট্রিপ টাইমলাইন ক্যালেন্ডার</span>
          </h3>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#1e3a8a]" />
              <span>আপ ট্রিপ (UP)</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#1d4ed8]" />
              <span>ডাউন ট্রিপ (DOWN)</span>
            </span>
            {canManageTrips && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#1d4ed8] font-medium">
                  ট্রিপ কার্ড টেনে অন্য দিন বা গাড়িতে পরিবর্তন করুন অথবা পুনর্বিন্যাস বোতামে ক্লিক করুন
                </span>
              </>
            )}
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onChangeWeekStartDate(addDaysToDateStr(weekStartDate, -7))}
            className="px-3 py-1.5 bg-white hover:bg-[#eff6ff] text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>পূর্ববর্তী সপ্তাহ</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeWeekStartDate(getWeekStartSaturday(todayStr))}
            className="px-3.5 py-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums"
          >
            {startHeader.shortDate} — {endHeader.shortDate}
          </button>

          <button
            type="button"
            onClick={() => onChangeWeekStartDate(addDaysToDateStr(weekStartDate, 7))}
            className="px-3 py-1.5 bg-white hover:bg-[#eff6ff] text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>পরবর্তী সপ্তাহ</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Timeline Grid */}
      {swimlaneVehicles.length === 0 ? (
        <div className="p-12 text-center">
          <Bus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-bold text-slate-800">সাপ্তাহিক টাইমলাইনে দেখানোর জন্য কোনো গাড়ি পাওয়া যায়নি</div>
          <p className="text-xs text-slate-600 mt-1">
            প্রথমে &quot;গাড়ি ব্যবস্থাপনা&quot; মেনু থেকে গাড়ি যুক্ত করুন, তারপর শিডিউল তৈরি ও পুনর্বিন্যাস করুন।
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto relative">
          {loading && (
            <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 bg-[#1d4ed8] text-white rounded-xl text-xs font-bold shadow-md">
                <RefreshCw className="w-4 h-4 animate-spin text-[#93c5fd]" />
                <span>সাপ্তাহিক শিডিউল লোড হচ্ছে...</span>
              </div>
            </div>
          )}

          <table className="w-full min-w-[1080px] border-collapse text-xs">
            <thead>
              <tr className="bg-[#1d4ed8] text-white border-b border-[#1e40af]">
                <th className="w-52 min-w-[208px] sticky left-0 z-10 bg-[#1d4ed8] border-r border-[#1e40af] px-4 py-3 text-left font-black text-white">
                  গাড়ি ও মালিক (সপ্তাহের লেন)
                </th>
                {weekDays.map((dayStr) => {
                  const { dayName, shortDate } = formatDayColumnHeader(dayStr);
                  const isToday = dayStr === todayStr;
                  const dayCount = schedules.filter((s) => s.date === dayStr && s.status !== 'cancelled').length;

                  return (
                    <th
                      key={dayStr}
                      className={`min-w-[130px] border-r last:border-r-0 border-[#1e40af] px-2.5 py-2.5 text-left align-top ${
                        isToday ? 'bg-[#1e40af]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-xs text-white">
                          {dayName} {isToday ? '· আজ' : ''}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-[#dbeafe] font-semibold">
                          {toBengaliDigits(dayCount)} ট্রিপ
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold mt-0.5 tabular-nums text-[#bfdbfe]">
                        {shortDate}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {swimlaneVehicles.map((veh) => {
                const vehWeekTrips = schedules.filter(
                  (s) => s.vehicleId === veh.id && weekDays.includes(s.date) && s.status !== 'cancelled'
                );

                return (
                  <tr key={veh.id} className="group odd:bg-white even:bg-[#f1f5f9]">
                    {/* Sticky Vehicle Swimlane Header */}
                    <td className="sticky left-0 z-10 bg-white group-even:bg-[#f1f5f9] group-hover:bg-[#eff6ff] border-r border-slate-200 px-4 py-3 align-top transition-colors">
                      <div className="font-mono tabular-nums font-black text-slate-900 text-xs">
                        {veh.regNo}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate max-w-[170px]">
                        {veh.ownerName || 'সাধারণ'} · {toBengaliDigits(veh.seatCapacity)} সিট
                      </div>
                      <div className="text-[11px] font-semibold text-[#1d4ed8] mt-1 tabular-nums">
                        সাপ্তাহিক: {toBengaliDigits(vehWeekTrips.length)} টি ট্রিপ
                      </div>
                    </td>

                    {/* 7 Day Cells */}
                    {weekDays.map((dayStr) => {
                      const isToday = dayStr === todayStr;
                      const isDragOver =
                        dragOverCell?.vehicleId === veh.id && dragOverCell?.date === dayStr;

                      const cellTrips = schedules
                        .filter((s) => s.vehicleId === veh.id && s.date === dayStr && s.status !== 'cancelled')
                        .sort((a, b) => parseTimeToMinutes(a.departureTime) - parseTimeToMinutes(b.departureTime));

                      return (
                        <td
                          key={`${veh.id}-${dayStr}`}
                          onDragOver={(e) => handleDragOver(e, veh.id, dayStr)}
                          onDragLeave={() => setDragOverCell(null)}
                          onDrop={(e) => handleDrop(e, veh.id, dayStr)}
                          className={`border-r last:border-r-0 border-slate-200 p-2 align-top min-h-[96px] transition-colors ${
                            isDragOver
                              ? 'bg-[#eff6ff] ring-2 ring-inset ring-[#1d4ed8]'
                              : isToday
                              ? 'bg-[#eff6ff]/70'
                              : ''
                          }`}
                        >
                          <div className="space-y-2 min-h-[76px]">
                            {cellTrips.length === 0 ? (
                              <div className="h-[72px] rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-500">
                                {isDragOver ? 'এখানে ছেড়ে দিন' : 'ফাঁকা স্লট'}
                              </div>
                            ) : (
                              cellTrips.map((sch) => {
                                const booked = sch.totalBookedSeats || 0;
                                const percent = Math.round((booked / (sch.seatCapacity || 42)) * 100);
                                const isBeingDragged = draggedTripId === sch.id;
                                const isUpdating = reassigningId === sch.id;

                                return (
                                  <div
                                    key={sch.id}
                                    draggable={canManageTrips && !isUpdating}
                                    onDragStart={(e) => handleDragStart(e, sch)}
                                    onDragEnd={handleDragEnd}
                                    className={`rounded-xl border bg-white p-2 shadow-2xs transition-all ${
                                      isBeingDragged
                                        ? 'opacity-40 scale-95 border-[#1d4ed8]'
                                        : 'border-slate-200 hover:border-[#1d4ed8]'
                                    } ${canManageTrips ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                  >
                                    {/* Top Accent Hairline Bar */}
                                    <div
                                      className={`h-1 w-full rounded-full mb-1.5 ${
                                        sch.direction === 'UP' ? 'bg-[#1e3a8a]' : 'bg-[#1d4ed8]'
                                      }`}
                                    />

                                    {/* Row 1: Time + Direction */}
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1 min-w-0">
                                        {canManageTrips && (
                                          <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                                        )}
                                        <span className="font-mono tabular-nums font-black text-[11px] text-slate-900 truncate">
                                          {formatTime12Hour(sch.departureTime)}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-[10px] font-black shrink-0 ${
                                          sch.direction === 'UP' ? 'text-[#1e3a8a]' : 'text-[#1d4ed8]'
                                        }`}
                                      >
                                        {sch.direction === 'UP' ? 'আপ' : 'ডাউন'}
                                      </span>
                                    </div>

                                    {/* Row 2: Route & Trip No */}
                                    <div className="text-[11px] font-semibold text-slate-700 truncate mt-0.5" title={sch.routeName}>
                                      {sch.routeName}
                                    </div>
                                    <div className="text-[10px] font-mono tabular-nums text-slate-600 flex items-center justify-between">
                                      <span>{sch.tripNo}</span>
                                      <span>{formatTaka(sch.fare)}</span>
                                    </div>

                                    {/* Row 3: Seat Occupancy Bar */}
                                    <div className="mt-1.5">
                                      <div className="flex items-center justify-between text-[10px] text-slate-600 tabular-nums mb-0.5">
                                        <span>
                                          সিট: <strong className="text-slate-900">{toBengaliDigits(booked)}/{toBengaliDigits(sch.seatCapacity)}</strong>
                                        </span>
                                        <span>{toBengaliDigits(percent)}%</span>
                                      </div>
                                      <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            percent > 80 ? 'bg-[#1e3a8a]' : 'bg-[#1d4ed8]'
                                          }`}
                                          style={{ width: `${Math.min(100, percent)}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* Row 4: Quick Actions */}
                                    <div className="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between gap-1">
                                      <button
                                        type="button"
                                        onClick={() => onSelectTripForBooking && onSelectTripForBooking(sch.id)}
                                        className="flex-1 py-1 px-1.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                        title="সিট বুকিং পেজে যান"
                                      >
                                        <Armchair className="w-3 h-3" />
                                        <span>বুকিং</span>
                                      </button>

                                      {canManageTrips && (
                                        <button
                                          type="button"
                                          onClick={() => openReassignModal(sch)}
                                          disabled={isUpdating}
                                          className="flex-1 py-1 px-1.5 bg-[#f8fafc] hover:bg-[#eff6ff] text-[#1e3a8a] rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors border border-slate-200"
                                          title="তারিখ, গাড়ি বা সময় পরিবর্তন করুন"
                                        >
                                          <ArrowRightLeft className="w-3 h-3" />
                                          <span>পুনর্বিন্যাস</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Reassignment Modal (Date, Vehicle, Time, Supervisor, Fare) */}
      {modalTrip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 max-h-[92dvh] sm:max-h-[88dvh] flex flex-col overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#1d4ed8] text-white flex items-center justify-between gap-2 border-b border-[#1e40af]">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black flex items-center gap-2 truncate">
                  <ArrowRightLeft className="w-4 h-4 text-[#93c5fd] shrink-0" />
                  <span className="truncate">ট্রিপ পুনর্বিন্যাস ({modalTrip.tripNo})</span>
                </h3>
                <p className="text-[11px] text-[#dbeafe] truncate">
                  ট্রিপের তারিখ, গাড়ি, ছাড়ার সময় অথবা সুপারভাইজার দ্রুত পরিবর্তন করুন
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalTrip(null)}
                className="p-1.5 text-[#dbeafe] hover:text-white hover:bg-white/15 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 text-slate-900">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    নতুন তারিখ *
                  </label>
                  <DateInput
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    বরাদ্দকৃত গাড়ি *
                  </label>
                  <select
                    value={targetVehicleId}
                    onChange={(e) => setTargetVehicleId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
                    required
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.regNo} ({toBengaliDigits(v.seatCapacity)} সিট · {v.ownerName || 'সাধারণ'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <DigitalClockPicker
                value={targetTime}
                onChange={setTargetTime}
                label="ছাড়ার সময় নির্ধারণ"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    সুপারভাইজার
                  </label>
                  {supervisorsList.length > 0 ? (
                    <select
                      value={targetSupervisor}
                      onChange={(e) => setTargetSupervisor(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
                    >
                      <option value="">সুপারভাইজার নির্বাচন করুন</option>
                      {supervisorsList.map((sup) => (
                        <option key={sup.id} value={sup.name}>
                          {sup.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={targetSupervisor}
                      onChange={(e) => setTargetSupervisor(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ভাড়া (৳)
                  </label>
                  <input
                    type="number"
                    value={targetFare}
                    onChange={(e) => setTargetFare(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8] tabular-nums"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  পুনর্বিন্যাসের কারণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={updateReason}
                  onChange={(e) => setUpdateReason(e.target.value)}
                  placeholder="যেমন: গাড়ির রুটিন মেরামত বা যাত্রী চাহিদার কারণে পরিবর্তন"
                  className="w-full px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
                />
              </div>

              </div>

              <div className="shrink-0 px-4 py-3 bg-[#f8fafc] border-t border-slate-200 flex items-center justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setModalTrip(null)}
                  className="min-h-[44px] px-4 py-2 bg-white border border-slate-200 hover:bg-[#eff6ff] text-slate-900 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingModal}
                  className="min-h-[44px] px-5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingModal ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>পুনর্বিন্যাস সংরক্ষণ করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
