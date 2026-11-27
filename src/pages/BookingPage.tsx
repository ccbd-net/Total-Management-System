import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { Schedule, Booking, Counter } from '../types/index.ts';
import { SeatMap } from '../components/SeatMap.tsx';
import { TripAlertBanner } from '../components/TripAlertBanner.tsx';
import { ThermalTicketModal } from '../components/ThermalTicketModal.tsx';
import { DateInput } from '../components/DateInput.tsx';
import { useDataSync } from '../hooks/useDataSync.ts';
import { formatTaka, toBengaliDigits, getTodayDhakaDate, formatBengaliDate, formatTime12Hour } from '../utils/formatters.ts';
import { groupSchedulesByRouteNumber, getBookingFareParts } from '../utils/routeSort.ts';
import {
  Armchair,
  Calendar,
  User,
  Phone,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Printer,
  RefreshCw,
  Check,
  FileSpreadsheet,
} from 'lucide-react';

export const BookingPage: React.FC = () => {
  const { user, isMasterAdmin, isModerator, isChecker, isFuelManager } = useAuth();
  const isReadOnlyViewer = isChecker || isFuelManager;

  const [date, setDate] = useState<string>(getTodayDhakaDate());
  const [direction, setDirection] = useState<'UP' | 'DOWN'>('UP');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [bookedSeats, setBookedSeats] = useState<Booking[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounterId, setSelectedCounterId] = useState<string>(user?.counterId || '');

  // Booking Form State
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [manualFare, setManualFare] = useState<string>('');
  const [cargoFare, setCargoFare] = useState<string>('');
  const [passengerName, setPassengerName] = useState<string>('');
  const [passengerPhone, setPassengerPhone] = useState<string>('');
  const [boardingPoint, setBoardingPoint] = useState<string>('');
  const [destination, setDestination] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [bookingInProgress, setBookingInProgress] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Thermal Print Modal State
  const [printedBooking, setPrintedBooking] = useState<Booking | null>(null);

  // Load active counters
  const fetchCounters = async () => {
    try {
      const res = await api.getCounters();
      setCounters(res.counters);
    } catch (err) {
      console.error('Failed to load counters:', err);
    }
  };

  const directionCounters = counters.filter((c) => c.status === 'active' && c.tripDirection === direction);

  useEffect(() => {
    if (directionCounters.length > 0) {
      const match = directionCounters.find((c) => c.id === selectedCounterId);
      if (!match) {
        setSelectedCounterId(directionCounters[0].id);
      }
    }
  }, [direction, counters]);

  // Load schedules strictly for selected calendar date and direction
  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await api.getSchedules({ date, direction, exactDateOnly: true });
      const exactMatches = (res.schedules || []).filter(
        (s) => s.date === date && s.status !== 'cancelled'
      );
      const grouped = groupSchedulesByRouteNumber(exactMatches);
      const orderedSchedules = grouped.flatMap((g) => g.trips);

      setSchedules(orderedSchedules);
      if (orderedSchedules.length > 0) {
        const exists = orderedSchedules.some((s) => s.id === selectedScheduleId);
        if (!exists) {
          setSelectedScheduleId(orderedSchedules[0].id);
        }
      } else {
        setSelectedScheduleId('');
        setCurrentSchedule(null);
        setBookedSeats([]);
      }
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load details for selected schedule
  const fetchScheduleDetails = async (id: string) => {
    if (!id) return;
    try {
      const res = await api.getScheduleDetails(id);
      setCurrentSchedule(res.schedule);
      setBookedSeats(res.bookings);
      // Clean selected seats that might have been booked by someone else
      const bookedSet = new Set(res.bookings.flatMap((b) => b.seatNumbers));
      setSelectedSeats((prev) => prev.filter((s) => !bookedSet.has(s)));
    } catch (err) {
      console.error('Failed to load schedule details:', err);
    }
  };

  useEffect(() => {
    fetchCounters();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [date, direction]);

  useEffect(() => {
    if (selectedScheduleId) {
      fetchScheduleDetails(selectedScheduleId);
      setSelectedSeats([]);
      setManualFare('');
      setCargoFare('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [selectedScheduleId]);

  // Real-time synchronization across pages and tabs
  useDataSync(
    useCallback(() => {
      fetchSchedules();
      if (selectedScheduleId) {
        fetchScheduleDetails(selectedScheduleId);
      }
    }, [selectedScheduleId, date, direction])
  );

  // Seat click toggle
  const handleSeatToggle = (seatId: string) => {
    setErrorMsg('');
    setSelectedSeats((prev) => {
      const next = prev.includes(seatId) ? prev.filter((s) => s !== seatId) : [...prev, seatId];
      // If user hasn't typed anything yet or wants a sensible starting suggestion
      return next;
    });
  };

  // Current counter color
  const activeCounter = counters.find((c) => c.id === selectedCounterId);
  const currentCounterColor = activeCounter?.seatColor || user?.counterColor || '#2563EB';

  const parsedSeatFare =
    selectedSeats.length > 0 && manualFare.trim() !== '' && !isNaN(Number(manualFare))
      ? Math.max(0, Number(manualFare))
      : 0;
  const parsedCargoFare =
    cargoFare.trim() !== '' && !isNaN(Number(cargoFare)) ? Math.max(0, Number(cargoFare)) : 0;
  const currentTotalFare = parsedSeatFare + parsedCargoFare;

  // Handle Submit Booking with Manual Seat Fare + Optional Cargo Fare
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSchedule) {
      setErrorMsg('অনুগ্রহ করে একটি ট্রিপ শিডিউল নির্বাচন করুন।');
      return;
    }

    if (selectedSeats.length === 0 && parsedCargoFare <= 0) {
      setErrorMsg('কমপক্ষে একটি আসন নির্বাচন করুন অথবা মালের ভাড়া প্রদান করুন!');
      return;
    }

    if (
      selectedSeats.length > 0 &&
      (manualFare.trim() === '' || isNaN(Number(manualFare)) || Number(manualFare) < 0)
    ) {
      setErrorMsg('অনুগ্রহ করে নির্বাচিত সিট বুকিংয়ের জন্য সিট ভাড়ার পরিমাণ ম্যানুয়ালী যুক্ত করুন!');
      return;
    }

    setBookingInProgress(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.createBooking({
        scheduleId: currentSchedule.id,
        counterId: selectedCounterId,
        passengerName,
        passengerPhone,
        boardingPoint: boardingPoint || activeCounter?.name || '',
        destination: destination || (currentSchedule.direction === 'UP' ? 'ঢাকা' : 'মাদারীপুর'),
        seatNumbers: selectedSeats,
        seatFare: selectedSeats.length > 0 ? parsedSeatFare : 0,
        cargoFare: parsedCargoFare,
        totalFare: currentTotalFare,
      });

      setSuccessMsg(
        selectedSeats.length > 0
          ? `সিট (${selectedSeats.join(', ')}) — সিট ভাড়া ${formatTaka(parsedSeatFare)}${
              parsedCargoFare > 0 ? ` + মালের ভাড়া ${formatTaka(parsedCargoFare)}` : ''
            } = মোট ${formatTaka(currentTotalFare)} সফলভাবে বুকিং সম্পন্ন হয়েছে!`
          : `মালামাল বুকিং — মালের ভাড়া ${formatTaka(parsedCargoFare)} সফলভাবে সংরক্ষণ করা হয়েছে!`
      );
      // Open thermal ticket modal immediately
      setPrintedBooking(res.booking);

      // Clear form
      setSelectedSeats([]);
      setManualFare('');
      setCargoFare('');
      setPassengerName('');
      setPassengerPhone('');

      // Refresh schedule
      await fetchScheduleDetails(currentSchedule.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'বুকিং সম্পন্ন করা সম্ভব হয়নি। সিটটি হয়তো অন্য কেউ নিয়ে নিয়েছে!');
      if (currentSchedule) {
        await fetchScheduleDetails(currentSchedule.id);
      }
    } finally {
      setBookingInProgress(false);
    }
  };

  const todayDhaka = getTodayDhakaDate();
  const routeGroups = groupSchedulesByRouteNumber(schedules);

  return (
    <div className="space-y-3">
      {/* Top Controls: Date, Direction & Schedule Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#1d4ed8] px-3 py-2 text-white flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Armchair className="w-4 h-4 shrink-0 text-[#93c5fd]" />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold leading-tight truncate">
                লাইভ বাস সিট বুকিং ও টিকিটিং শীট
              </h2>
              <p className="hidden sm:block text-[10px] text-[#dbeafe] leading-tight">
                ট্রিপ নির্বাচন করে ইন্টারঅ্যাক্টিভ ম্যাপ থেকে আসন বুকিং ও তাৎক্ষণিক প্রিন্ট করুন
              </p>
            </div>
          </div>

          {/* Up / Down Tabs & Date */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {/* Direction Tabs */}
            <div className="flex bg-[#1e40af] p-0.5 rounded-lg text-[11px] font-bold border border-white/20">
              <button
                type="button"
                onClick={() => setDirection('UP')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  direction === 'UP'
                    ? 'bg-white/15 text-white border border-white/25 shadow-2xs'
                    : 'text-[#dbeafe] hover:text-white'
                }`}
              >
                আপ (মাদারীপুর ➜ ঢাকা)
              </button>
              <button
                type="button"
                onClick={() => setDirection('DOWN')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  direction === 'DOWN'
                    ? 'bg-white/15 text-white border border-white/25 shadow-2xs'
                    : 'text-[#dbeafe] hover:text-white'
                }`}
              >
                ডাউন (ঢাকা ➜ মাদারীপুর)
              </button>
            </div>

            {/* Date Selector */}
            <div className="flex items-center gap-1 bg-white/95 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-900">
              <Calendar className="w-3.5 h-3.5 text-[#1d4ed8]" />
              <DateInput
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent outline-none cursor-pointer text-[11px]"
              />
            </div>

            {date !== todayDhaka && (
              <button
                type="button"
                onClick={() => setDate(todayDhaka)}
                className="px-2 py-1 bg-white hover:bg-[#eff6ff] text-[#1e3a8a] rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                আজ
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                fetchSchedules();
                if (selectedScheduleId) fetchScheduleDetails(selectedScheduleId);
              }}
              className="p-1.5 bg-[#1e40af] hover:bg-white/15 text-white border border-white/20 rounded-lg transition-colors cursor-pointer"
              title="রিফ্রেশ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Excel-Sheet Style Trip Schedule Table (Grouped by Route 1/2/3 & Sorted by Time) */}
        <div className="p-2.5 sm:p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#1d4ed8]" />
              <span>
                নির্ধারিত ট্রিপ তালিকা ({formatBengaliDate(date)} · {toBengaliDigits(schedules.length)} টি ট্রিপ)
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              রুট নং ও ছাড়ার সময় অনুযায়ী সাজানো · বুকিং করতে সারিতে ক্লিক করুন
            </span>
          </div>

          {schedules.length === 0 ? (
            <div className="p-4 bg-[#f8fafc] rounded-xl text-center text-xs text-slate-600 border border-slate-200">
              নির্বাচিত তারিখ ({formatBengaliDate(date)}) এ কোনো{' '}
              {direction === 'UP' ? 'আপ ট্রিপ' : 'ডাউন ট্রিপ'} শিডিউল পাওয়া যায়নি। শিডিউল মেকার থেকে ট্রিপ যোগ করুন।
            </div>
          ) : (
            <div className="space-y-2.5">
              {routeGroups.map((group) => (
                <div
                  key={`${direction}-${group.routeName}`}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white"
                >
                  {/* Route Header Strip */}
                  <div
                    className={`px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-white ${
                      direction === 'UP' ? 'bg-[#1e3a8a]' : 'bg-[#1e40af]'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <span className="px-2 py-0.5 rounded bg-white/15 text-white text-[10px] font-black tabular-nums">
                        {toBengaliDigits(group.routeNumber)} নং রুট
                      </span>
                      <span>{group.routeName}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-white/90 tabular-nums">
                      মোট {toBengaliDigits(group.trips.length)} টি ট্রিপ
                    </span>
                  </div>

                  {/* Excel Grid Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[11px]">
                      <thead>
                        <tr className="bg-[#1d4ed8] border-b border-[#1e40af] text-white font-bold text-[11px]">
                          <th className="py-2 px-2.5 border-r border-blue-600/60 text-center w-12">ক্রম</th>
                          <th className="py-2 px-2.5 border-r border-blue-600/60 whitespace-nowrap">তারিখ</th>
                          <th className="py-2 px-2.5 border-r border-blue-600/60 whitespace-nowrap">ট্রিপ নং</th>
                          <th className="py-2 px-2.5 border-r border-blue-600/60 whitespace-nowrap">ছাড়ার সময়</th>
                          <th className="py-2 px-2.5 border-r border-blue-600/60 whitespace-nowrap">গাড়ি নম্বর</th>
                          <th className="py-2 px-2.5 border-r border-blue-600/60 whitespace-nowrap">সুপারভাইজার</th>
                          <th className="py-2 px-2.5 border-r border-blue-600/60 text-center whitespace-nowrap">খালি আসন</th>
                          <th className="py-2 px-2.5 text-center whitespace-nowrap">বুকিং সিলেক্ট</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {group.trips.map((sch) => {
                          const isSelected = sch.id === selectedScheduleId;
                          const bookedCount = sch.totalBookedSeats || 0;
                          const availableCount = sch.seatCapacity - bookedCount;

                          return (
                            <tr
                              key={sch.id}
                              onClick={() => setSelectedScheduleId(sch.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-[#dbeafe] font-semibold'
                                  : 'odd:bg-white even:bg-[#f1f5f9] hover:bg-[#eff6ff]'
                              }`}
                            >
                              <td className="py-2 px-2.5 border-r border-slate-200 text-center font-bold text-slate-800 tabular-nums">
                                {toBengaliDigits(sch.serialInRoute)}
                              </td>
                              <td className="py-2 px-2.5 border-r border-slate-200 text-slate-700 whitespace-nowrap tabular-nums">
                                {formatBengaliDate(sch.date)}
                              </td>
                              <td className="py-2 px-2.5 border-r border-slate-200 font-mono font-bold text-slate-900 whitespace-nowrap">
                                <span>{sch.tripNo}</span>
                                {sch.tripSequenceLabel && (
                                  <span className="ml-1.5 text-[10px] font-sans font-bold text-[#1d4ed8]">
                                    ({sch.tripSequenceLabel})
                                  </span>
                                )}
                                {sch.isNightHold && (
                                  <span className="ml-1.5 text-[10px] font-sans font-bold text-[#1e3a8a]">
                                    · নাইট হোল্ড
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2.5 border-r border-slate-200 font-mono font-bold text-slate-900 whitespace-nowrap tabular-nums">
                                {formatTime12Hour(sch.departureTime)}
                              </td>
                              <td className="py-2 px-2.5 border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap tabular-nums">
                                {sch.vehicleRegNo}
                              </td>
                              <td className="py-2 px-2.5 border-r border-slate-200 text-slate-800 whitespace-nowrap">
                                {sch.supervisor || 'অনির্ধারিত'}
                              </td>
                              <td className="py-2 px-2.5 border-r border-slate-200 text-center whitespace-nowrap tabular-nums">
                                <span className="font-bold text-[#1d4ed8]">
                                  {toBengaliDigits(availableCount)}
                                </span>
                                <span className="text-slate-400">
                                  /{toBengaliDigits(sch.seatCapacity)}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedScheduleId(sch.id);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#1d4ed8] text-white'
                                      : 'bg-[#f8fafc] hover:bg-[#eff6ff] text-[#1e3a8a] border border-slate-200'
                                  }`}
                                >
                                  {isSelected ? 'নির্বাচিত' : 'নির্বাচন করুন'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Layout: Left Bus Seat Map, Right Booking Form */}
      {currentSchedule && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Left Column: Interactive Seat Plan */}
            <div className="md:col-span-6 xl:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col items-center">
              {/* Alert Banner if Trip Info Changed */}
              <div className="w-full">
                <TripAlertBanner schedule={currentSchedule} />
              </div>

              <div className="w-full flex items-center justify-between mb-4 pb-2 border-b border-slate-200 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{currentSchedule.vehicleRegNo}</h3>
                    {currentSchedule.tripSequenceLabel && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#eff6ff] text-[#1e3a8a] border border-[#bfdbfe]">
                        {currentSchedule.tripSequenceLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {currentSchedule.vehicleOwnerName ? `মালিক: ${currentSchedule.vehicleOwnerName} | ` : ''}
                    {currentSchedule.seatCapacity === 42 ? '৪২ সিট' : '৪৬ সিট'} | ছাড়ার সময়: {formatTime12Hour(currentSchedule.departureTime)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-[#1d4ed8] bg-[#eff6ff] px-2.5 py-1 rounded-lg border border-[#bfdbfe]">
                    ভাড়া: ম্যানুয়াল
                  </span>
                </div>
              </div>

              <SeatMap
                seatCapacity={currentSchedule.seatCapacity}
                bookedSeats={bookedSeats}
                selectedSeats={selectedSeats}
                currentCounterColor={currentCounterColor}
                onSeatToggle={handleSeatToggle}
                counters={counters}
              />
            </div>

            {/* Right Column: Booking Form */}
            <div className="md:col-span-6 xl:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 gap-2">
                <div>
                  <h3 className="font-bold text-base text-slate-900">যাত্রী তথ্য ও বুকিং কনফার্মেশন</h3>
                  <p className="text-xs text-slate-500">আসন ও মালের ভাড়া এন্ট্রি করে বুকিং সম্পন্ন করুন</p>
                </div>

                {/* Counter Selector */}
                <div className="text-right">
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    বুকিং কাউন্টার
                  </label>
                  {isMasterAdmin || isModerator ? (
                    <select
                      value={selectedCounterId}
                      onChange={(e) => setSelectedCounterId(e.target.value)}
                      className="text-xs font-bold p-1.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                    >
                      {counters
                        .filter((c) => c.status === 'active')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: currentCounterColor }}
                      />
                      <span>{activeCounter?.name || user?.counterName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error & Success Messages */}
              {errorMsg && (
                <div className="mb-4 p-3 bg-[#eff6ff] text-[#1e3a8a] text-xs font-bold rounded-xl border border-[#1d4ed8] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#1d4ed8]" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 p-3 bg-[#eff6ff] text-[#1e3a8a] text-xs font-semibold rounded-xl border border-[#bfdbfe] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 text-[#1d4ed8]" />
                    <span>{successMsg}</span>
                  </div>
                  {printedBooking && (
                    <button
                      type="button"
                      onClick={() => setPrintedBooking(printedBooking)}
                      className="px-2.5 py-1 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>প্রিন্ট ভিউ</span>
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleConfirmBooking} className="space-y-4">
                {/* Selected Seats Banner & Seat + Cargo Fare Inputs */}
                <div className="p-4 bg-[#f8fafc] rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-xs text-slate-600 font-semibold">নির্বাচিত আসন সমূহ:</span>
                      <div className="text-base font-black text-slate-900 mt-0.5">
                        {selectedSeats.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {selectedSeats.map((s) => (
                              <span
                                key={s}
                                className="px-2.5 py-0.5 rounded-lg text-white text-xs font-bold shadow-xs"
                                style={{ backgroundColor: currentCounterColor }}
                              >
                                {s}
                              </span>
                            ))}
                            <span className="text-xs text-slate-600 font-bold ml-1">
                              (মোট {toBengaliDigits(selectedSeats.length)} টি আসন)
                            </span>
                          </div>
                        ) : parsedCargoFare > 0 ? (
                          <span className="text-[#1d4ed8] text-xs font-bold">
                            মালামাল বুকিং (আসনবিহীন · শুধুমাত্র মালের ভাড়া)
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs font-normal">
                            বামপাশের বাস ম্যাপ থেকে আসন ক্লিক করুন অথবা মালের ভাড়া লিখুন
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-[11px] text-slate-600 font-semibold block">
                        সিট ({formatTaka(parsedSeatFare)}) + মাল ({formatTaka(parsedCargoFare)})
                      </span>
                      <div className="text-xl font-black text-[#1d4ed8] tabular-nums">
                        মোট: {formatTaka(currentTotalFare)}
                      </div>
                    </div>
                  </div>

                  {/* Manual Seat Fare + Manual Cargo Fare Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Seat Fare Box */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-xs font-black text-[#1e3a8a] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#1d4ed8]" />
                          <span>সিট ভাড়া (ম্যানুয়াল ৳) {selectedSeats.length > 0 ? '*' : ''}</span>
                        </label>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1d4ed8] font-bold text-sm">
                          ৳
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={manualFare}
                          onChange={(e) => setManualFare(e.target.value)}
                          disabled={selectedSeats.length === 0}
                          placeholder={
                            selectedSeats.length === 0
                              ? 'সিট নিলে চালু হবে'
                              : `যেমন: ${selectedSeats.length * (currentSchedule.fare || 550)}`
                          }
                          className="w-full pl-8 pr-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white outline-none disabled:opacity-60 disabled:cursor-not-allowed tabular-nums"
                        />
                      </div>

                      {currentSchedule.fare > 0 && selectedSeats.length > 0 && (
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              const refFare = currentSchedule.fare * selectedSeats.length;
                              setManualFare(String(refFare));
                            }}
                            className="px-2.5 py-1 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1e3a8a] border border-[#bfdbfe] rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                            title="রেফারেন্স বেস ভাড়া স্বয়ংক্রিয়ভাবে ইনপুট বক্সে বসান"
                          >
                            রেফারেন্স: {formatTaka(currentSchedule.fare * selectedSeats.length)}
                          </button>
                          {manualFare !== '' && (
                            <span className="text-[11px] text-slate-600 tabular-nums">
                              গড়: <strong className="text-[#1d4ed8]">{formatTaka(Math.round(parsedSeatFare / selectedSeats.length))}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cargo / Goods Fare Box */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-xs font-black text-[#1e3a8a] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#1e3a8a]" />
                          <span>মালের ভাড়া (ম্যানুয়াল ৳)</span>
                        </label>
                        <span className="text-[10px] font-bold text-[#1d4ed8] bg-[#eff6ff] px-1.5 py-0.5 rounded border border-[#bfdbfe]">
                          ঐচ্ছিক
                        </span>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1e3a8a] font-bold text-sm">
                          ৳
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={cargoFare}
                          onChange={(e) => setCargoFare(e.target.value)}
                          placeholder="মালের ভাড়া লিখুন (যেমন: ২০০)"
                          className="w-full pl-8 pr-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white outline-none tabular-nums"
                        />
                      </div>

                      <div className="text-[11px] text-slate-500">
                        সিট বুকিংয়ের সাথে বা শুধু মালের ভাড়া যোগ করা যাবে
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      যাত্রীর / প্রেরকের নাম
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1d4ed8]">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={passengerName}
                        onChange={(e) => setPassengerName(e.target.value)}
                        placeholder="যাত্রী বা মালামাল প্রেরকের নাম"
                        className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      মোবাইল নম্বর
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1d4ed8]">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        value={passengerPhone}
                        onChange={(e) => setPassengerPhone(e.target.value)}
                        placeholder="০১৭xxxxxxxx"
                        className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      বোর্ডিং পয়েন্ট (উঠা)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1d4ed8]">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={boardingPoint}
                        onChange={(e) => setBoardingPoint(e.target.value)}
                        placeholder={activeCounter?.name || 'কাউন্টার পয়েন্ট'}
                        className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      গন্তব্য (নামা)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1d4ed8]">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder={currentSchedule.direction === 'UP' ? 'ঢাকা' : 'মাদারীপুর'}
                        className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white outline-none"
                      />
                    </div>
                  </div>
                  {(isMasterAdmin || isModerator) && directionCounters.length > 1 && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        বুকিং ইস্যুকারী কাউন্টার ({direction === 'UP' ? 'আপ কাউন্টারসমূহ' : 'ডাউন কাউন্টারসমূহ'})
                      </label>
                      <select
                        value={selectedCounterId}
                        onChange={(e) => setSelectedCounterId(e.target.value)}
                        className="w-full px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1d4ed8] outline-none"
                      >
                        {directionCounters.map((cnt) => (
                          <option key={cnt.id} value={cnt.id}>
                            {cnt.name} ({cnt.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {isReadOnlyViewer ? (
                  <div className="p-3 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-xs font-bold text-[#1e3a8a] text-center">
                    চেকার পরিদর্শন মোড — আপনি লাইভ সিট প্ল্যান ও বুকিং তালিকা দেখতে পারবেন (বুকিং/বাতিল অনুমোদিত নয়)
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      bookingInProgress ||
                      (selectedSeats.length === 0 && parsedCargoFare <= 0) ||
                      (selectedSeats.length > 0 &&
                        (manualFare.trim() === '' ||
                          isNaN(Number(manualFare)) ||
                          Number(manualFare) < 0))
                    }
                    className="w-full py-3 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {bookingInProgress ? (
                      'ডাটাবেজে সুরক্ষিত বুকিং নিশ্চিত করা হচ্ছে...'
                    ) : selectedSeats.length === 0 && parsedCargoFare <= 0 ? (
                      <span>সিট নির্বাচন করুন অথবা মালের ভাড়া লিখুন</span>
                    ) : selectedSeats.length > 0 && manualFare.trim() === '' ? (
                      <span>সিট ভাড়ার পরিমাণ ম্যানুয়ালী যুক্ত করুন ({toBengaliDigits(selectedSeats.length)} আসন)</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>
                          {selectedSeats.length > 0
                            ? `বুকিং কনফার্ম ও টিকিট প্রিন্ট করুন (${toBengaliDigits(selectedSeats.length)} আসন — ${formatTaka(currentTotalFare)})`
                            : `মালামাল বুকিং কনফার্ম ও রসিদ প্রিন্ট করুন (${formatTaka(currentTotalFare)})`}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Full-width Booking Records Table Below */}
          {(() => {
            const totals = bookedSeats.reduce(
              (acc, b) => {
                const p = getBookingFareParts(b);
                acc.seat += p.seatFare;
                acc.cargo += p.cargoFare;
                acc.total += p.totalFare;
                return acc;
              },
              { seat: 0, cargo: 0, total: 0 }
            );
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="bg-[#1e3a8a] px-4 py-2.5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm">
                      এই ট্রিপের বুকিং রেকর্ড ({toBengaliDigits(bookedSeats.length)} টি টিকিট/রসিদ)
                    </h3>
                    <p className="text-[11px] text-[#dbeafe] mt-0.5 tabular-nums">
                      মোট বিক্রিত আসন: <strong className="text-white">{toBengaliDigits(currentSchedule.totalBookedSeats || 0)} টি</strong> ·{' '}
                      সিট ভাড়া: <strong className="text-[#dbeafe]">{formatTaka(totals.seat)}</strong> ·{' '}
                      মালের ভাড়া: <strong className="text-[#dbeafe]">{formatTaka(totals.cargo)}</strong> ·{' '}
                      সর্বমোট আদায়: <strong className="text-[#93c5fd]">{formatTaka(totals.total)}</strong>
                    </p>
                  </div>
                </div>

                {bookedSeats.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    এখনও কোনো আসন বা মালামাল বুকিং হয়নি।
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#1d4ed8] text-white border-b border-[#1e40af] font-bold">
                          <th className="py-2.5 px-3 border-r border-blue-600/60">টিকিট নং</th>
                          <th className="py-2.5 px-3 border-r border-blue-600/60">কাউন্টার</th>
                          <th className="py-2.5 px-3 border-r border-blue-600/60">যাত্রী ও ফোন</th>
                          <th className="py-2.5 px-3 border-r border-blue-600/60">সিট নম্বর / ধরন</th>
                          <th className="py-2.5 px-3 border-r border-blue-600/60 text-right">সিট ভাড়া</th>
                          <th className="py-2.5 px-3 border-r border-blue-600/60 text-right">মালের ভাড়া</th>
                          <th className="py-2.5 px-3 border-r border-blue-600/60 text-right">মোট টাকা</th>
                          <th className="py-2.5 px-3 text-right">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {bookedSeats.map((b) => {
                          const fp = getBookingFareParts(b);
                          return (
                            <tr key={b.id} className="odd:bg-white even:bg-[#f1f5f9] hover:bg-[#eff6ff] transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap border-r border-slate-200">
                                {b.ticketNo}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: b.counterColor }}
                                  />
                                  <span className="font-semibold text-slate-800">{b.counterName}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200">
                                <div className="font-medium text-slate-900">{b.passengerName}</div>
                                <div className="text-[10px] text-slate-500">{b.passengerPhone || 'নেই'}</div>
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200">
                                {b.seatNumbers.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {b.seatNumbers.map((s) => (
                                      <span
                                        key={s}
                                        className="px-1.5 py-0.5 rounded text-[11px] font-bold text-white"
                                        style={{ backgroundColor: b.counterColor }}
                                      >
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-[#eff6ff] text-[#1e3a8a] border border-[#bfdbfe] text-[10px] font-bold">
                                    মালামাল বুকিং
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap border-r border-slate-200">
                                {formatTaka(fp.seatFare)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-[#1e3a8a] tabular-nums whitespace-nowrap border-r border-slate-200">
                                {formatTaka(fp.cargoFare)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-[#1d4ed8] tabular-nums whitespace-nowrap border-r border-slate-200">
                                {formatTaka(fp.totalFare)}
                              </td>
                              <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setPrintedBooking(b)}
                                  className="p-1.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] rounded-lg transition-colors cursor-pointer"
                                  title="থার্মাল টিকিট প্রিন্ট করুন"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                {!isReadOnlyViewer && (isMasterAdmin || isModerator || b.counterId === user?.counterId) && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm(`আপনি কি নিশ্চিত যে টিকিট নং ${b.ticketNo} বাতিল করতে চান?`)) {
                                        try {
                                          await api.cancelBooking(b.id);
                                          await fetchScheduleDetails(currentSchedule.id);
                                        } catch (err: any) {
                                          alert(err.message);
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 bg-[#f8fafc] hover:bg-[#1e3a8a] text-[#1e3a8a] hover:text-white border border-slate-200 rounded-lg transition-colors text-[10px] font-bold cursor-pointer"
                                    title="বাতিল করুন"
                                  >
                                    বাতিল
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#eff6ff] border-t-2 border-[#bfdbfe] font-black text-[#1e3a8a]">
                          <td colSpan={4} className="py-2.5 px-3 text-right border-r border-[#bfdbfe]">
                            সর্বমোট আদায় হিসাব:
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#1e3a8a] tabular-nums whitespace-nowrap border-r border-[#bfdbfe]">
                            {formatTaka(totals.seat)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#1e3a8a] tabular-nums whitespace-nowrap border-r border-[#bfdbfe]">
                            {formatTaka(totals.cargo)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#1d4ed8] tabular-nums whitespace-nowrap border-r border-[#bfdbfe]">
                            {formatTaka(totals.total)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Thermal Ticket Print Modal */}
      {printedBooking && (
        <ThermalTicketModal
          booking={printedBooking}
          onClose={() => setPrintedBooking(null)}
          onPrinted={() => {
            if (currentSchedule) fetchScheduleDetails(currentSchedule.id);
          }}
        />
      )}
    </div>
  );
};
