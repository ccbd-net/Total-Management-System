import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { Vehicle, RouteItem, Schedule, Driver } from '../types/index.ts';
import { useDataSync } from '../hooks/useDataSync.ts';
import { getTodayDhakaDate, toBengaliDigits, formatBengaliDate, formatTime12Hour } from '../utils/formatters.ts';
import { sortRoutesByNumber } from '../utils/routeSort.ts';
import { DigitalClockPicker } from '../components/DigitalClockPicker.tsx';
import { ForwardUpTripsModal } from '../components/ForwardUpTripsModal.tsx';
import { DateInput } from '../components/DateInput.tsx';
import {
  CalendarPlus,
  Bus,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  User,
  Moon,
  MapPin,
  Forward,
} from 'lucide-react';

export const ScheduleMakerPage: React.FC<{ onScheduleCreated?: () => void }> = ({
  onScheduleCreated,
}) => {
  const { user } = useAuth();

  // Requested fields:
  // ১. ট্রিপ ধরন (আপ ট্রিপ / ডাউন ট্রিপ)
  // ২. তারিখ (Date)
  // ৩. নাইট হোল্ড চেকবক্স (Night Hold)
  // ৪. সময় (Departure Time)
  // ৫. গাড়ি নাম্বার (Vehicle Number)
  // ৬. রুট (Route - direction-specific)
  // ৭. সুপারভাইজার (Supervisor - name directory)
  // ৮. ড্রাইভার (Driver - name directory)
  const [direction, setDirection] = useState<'UP' | 'DOWN'>('UP');
  const [date, setDate] = useState<string>(getTodayDhakaDate());
  const [isNightHold, setIsNightHold] = useState<boolean>(false);
  const [departureTime, setDepartureTime] = useState<string>('07:00 AM');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [routeId, setRouteId] = useState<string>('');
  const [supervisor, setSupervisor] = useState<string>('');
  const [driver, setDriver] = useState<string>('');

  // Lists
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [supervisorsList, setSupervisorsList] = useState<{ id: string; name: string }[]>([]);
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [existingDateSchedules, setExistingDateSchedules] = useState<Schedule[]>([]);

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [showConfirmDoubleTrip, setShowConfirmDoubleTrip] = useState<boolean>(false);
  const [showForwardModal, setShowForwardModal] = useState<boolean>(false);

  useEffect(() => {
    const loadPrerequisites = async () => {
      try {
        const [vRes, sRes, dRes, rRes] = await Promise.all([
          api.getVehicles(),
          api.getSupervisors(),
          api.getDrivers(),
          api.getRoutes(),
        ]);
        const activeVehicles = vRes.vehicles.filter((v) => v.status === 'active');
        setVehicles(activeVehicles);
        if (activeVehicles.length > 0) {
          setVehicleId(activeVehicles[0].id);
        }

        const activeSupervisors = sRes.supervisors || [];
        setSupervisorsList(activeSupervisors);
        if (activeSupervisors.length > 0) {
          setSupervisor(activeSupervisors[0].name);
        }

        const activeDrivers = dRes.drivers || [];
        setDriversList(activeDrivers);
        if (activeDrivers.length > 0) {
          setDriver(activeDrivers[0].name);
        }

        const activeRoutes = rRes.routes || [];
        setRoutes(activeRoutes);
      } catch (err) {
        console.error('Failed to load prerequisites:', err);
      }
    };
    loadPrerequisites();
  }, []);

  // Direction-specific routes sorted by route number (1, 2, 3...)
  const availableRoutes = sortRoutesByNumber(
    routes.filter((r) => r.status === 'active' && r.direction === direction)
  );

  useEffect(() => {
    if (availableRoutes.length > 0) {
      setRouteId(availableRoutes[0].id);
    } else {
      setRouteId('');
    }
  }, [direction, routes]);

  // Fetch existing schedules for selected date
  const loadDaySchedules = useCallback(async () => {
    try {
      const res = await api.getSchedules({ date });
      setExistingDateSchedules(res.schedules);
    } catch (err) {
      console.error('Failed to load date schedules:', err);
    }
  }, [date]);

  useEffect(() => {
    loadDaySchedules();
  }, [loadDaySchedules]);

  // Real-time synchronization
  useDataSync(loadDaySchedules);

  // Calculate this vehicle's UP trip count for selected date (২য়/৩য় ট্রিপ শুধুমাত্র আপ ট্রিপে প্রযোজ্য)
  const vehicleUpTripsToday = existingDateSchedules.filter(
    (s) => s.vehicleId === vehicleId && s.direction === 'UP' && s.status !== 'cancelled'
  );
  const nextTripSeqNumber = direction === 'UP' ? vehicleUpTripsToday.length + 1 : 1;
  const nextTripSeqLabel =
    direction === 'UP' && nextTripSeqNumber > 1
      ? nextTripSeqNumber === 2
        ? '২য় ট্রিপ'
        : nextTripSeqNumber === 3
        ? '৩য় ট্রিপ'
        : nextTripSeqNumber === 4
        ? '৪র্থ ট্রিপ'
        : `${toBengaliDigits(nextTripSeqNumber)}তম ট্রিপ`
      : undefined;

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  useEffect(() => {
    if (selectedVehicle?.driverName) {
      setDriver(selectedVehicle.driverName);
    }
  }, [selectedVehicle?.id, selectedVehicle?.driverName]);

  // Compute next day for night hold
  const calculateNextDay = (baseDate: string): string => {
    try {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const executeCreate = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setShowConfirmDoubleTrip(false);

    try {
      const res = await api.createSchedule({
        date,
        departureTime,
        vehicleId,
        direction,
        routeId: routeId || undefined,
        supervisor,
        driver: driver || undefined,
        isNightHold,
      });

      const tripLabel = res.schedule.tripSequenceLabel ? ` (${res.schedule.tripSequenceLabel})` : '';
      setSuccessMsg(
        `অভিনন্দন! ${direction === 'UP' ? 'আপ ট্রিপ' : 'ডাউন ট্রিপ'} (${res.schedule.tripNo}) শিডিউল সফলভাবে তৈরি হয়েছে। গাড়ি: ${res.schedule.vehicleRegNo}${tripLabel}, রুট: ${res.schedule.routeName}, সময়: ${formatTime12Hour(res.schedule.departureTime)}`
      );
      if (onScheduleCreated) onScheduleCreated();
    } catch (err: any) {
      setErrorMsg(err.message || 'শিডিউল তৈরিতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !departureTime || !vehicleId || !supervisor || !direction) {
      setErrorMsg('অনুগ্রহ করে তারিখ, সময়, গাড়ী নম্বর, দিক ও সুপারভাইজার নির্বাচন করুন।');
      return;
    }

    // If creating an UP trip and vehicle already has an UP trip today, show confirmation dialog first
    if (direction === 'UP' && vehicleUpTripsToday.length > 0) {
      setShowConfirmDoubleTrip(true);
      return;
    }

    executeCreate();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {/* Compact Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#1d4ed8] px-3 py-2 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarPlus className="w-4 h-4 shrink-0 text-[#bfdbfe]" />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold leading-tight truncate">
                শিডিউল মেকার — নতুন ট্রিপ সংযোজন
              </h2>
              <p className="hidden sm:block text-[10px] text-[#dbeafe] leading-tight truncate">
                তারিখ, সময়, গাড়ী নম্বর, রুট, সুপারভাইজার ও ড্রাইভার দিয়ে ট্রিপ শুরু করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowForwardModal(true)}
            className="px-2.5 py-1.5 bg-white hover:bg-[#eff6ff] text-[#1e3a8a] rounded-lg text-[11px] font-extrabold shadow-2xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Forward className="w-3.5 h-3.5 text-[#1d4ed8]" />
            <span>গতকালের আপ ট্রিপ ফরোয়ার্ড</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-2.5 bg-[#eff6ff] text-[#1e3a8a] rounded-xl text-xs font-semibold border border-[#bfdbfe] flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-[#1d4ed8]" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Compact Excel Sheet Form Card */}
      <form onSubmit={handleCreate} className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
        {/* 1. Trip Direction (আপ ট্রিপ / ডাউন ট্রিপ) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-900 mb-1.5">
            ১. ট্রিপ টাইপ (আপ ট্রিপ / ডাউন ট্রিপ) *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('UP')}
              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                direction === 'UP'
                  ? 'bg-[#1e3a8a] border-[#1e3a8a] text-white shadow-xs'
                  : 'bg-[#f8fafc] border-slate-200 text-slate-900 hover:bg-[#eff6ff]'
              }`}
            >
              <div className="font-black text-xs">১. আপ ট্রিপ (UP TRIP)</div>
              <div className={`text-[10px] mt-0.5 ${direction === 'UP' ? 'text-[#dbeafe]' : 'text-slate-600'}`}>
                প্রান্তিক পয়েন্ট ➔ ঢাকা অভিমুখী
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDirection('DOWN')}
              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                direction === 'DOWN'
                  ? 'bg-[#1d4ed8] border-[#1d4ed8] text-white shadow-xs'
                  : 'bg-[#f8fafc] border-slate-200 text-slate-900 hover:bg-[#eff6ff]'
              }`}
            >
              <div className="font-black text-xs">২. ডাউন ট্রিপ (DOWN TRIP)</div>
              <div className={`text-[10px] mt-0.5 ${direction === 'DOWN' ? 'text-[#dbeafe]' : 'text-slate-600'}`}>
                ঢাকা ➔ প্রান্তিক (ফিরতি ট্রিপ)
              </div>
            </button>
          </div>
        </div>

        {/* 2. Date & Night Hold */}
        <div className="bg-[#f8fafc] p-3.5 rounded-2xl border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#1d4ed8]" />
                <span>২. ট্রিপের তারিখ *</span>
              </label>
              <DateInput
                value={date ?? ''}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] outline-none"
                required
              />
            </div>

            {/* Night Hold Checkbox */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-[#1e3a8a]" />
                <span>নাইট হোল্ড (রাত্রিযাপন)</span>
              </label>
              <label className="flex items-center gap-2.5 px-3 py-2 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-[#eff6ff] transition-colors">
                <input
                  type="checkbox"
                  checked={isNightHold}
                  onChange={(e) => setIsNightHold(e.target.checked)}
                  className="w-4 h-4 accent-[#1d4ed8] rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-900">
                  নাইট হোল্ড ট্রিপ হিসেবে চিহ্নিত করুন
                </span>
              </label>
            </div>
          </div>

          {isNightHold && (
            <div className="p-2.5 bg-[#eff6ff] text-[#1e3a8a] border border-[#bfdbfe] rounded-xl text-xs flex items-start gap-2">
              <Moon className="w-4 h-4 shrink-0 text-[#1d4ed8] mt-0.5" />
              <div>
                <strong>নাইট হোল্ড সক্রিয়:</strong> এই গাড়িটি রাতে গন্তব্যে অবস্থান করবে। এর ফিরতি ডাউন ট্রিপ পরবর্তী দিন (<strong>{formatBengaliDate(calculateNextDay(date))}</strong>) কাউন্ট হবে এবং ট্রিপ সমন্বয়ে <strong>{formatBengaliDate(calculateNextDay(date))}</strong> তারিখের রিপোর্টে ২টি ট্রিপ মিলে ১টি পূর্ণাঙ্গ ট্রিপ হিসেবে প্রদর্শিত হবে।
              </div>
            </div>
          )}
        </div>

        {/* 3. Departure Time Picker */}
        <div>
          <DigitalClockPicker
            value={departureTime || '07:00 AM'}
            onChange={setDepartureTime}
            label="৩. টার্মিনাল থেকে ছাড়ার সময় (ঘড়ি নির্বাচন) *"
          />
        </div>

        {/* 4. Vehicle Selection */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Bus className="w-4 h-4 text-[#1d4ed8]" />
              <span>৪. গাড়ী নাম্বার (Vehicle Number) *</span>
            </label>
            {direction === 'UP' && vehicleUpTripsToday.length > 0 && nextTripSeqLabel && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-[#eff6ff] text-[#1e3a8a] rounded-md border border-[#bfdbfe]">
                আজকের {nextTripSeqLabel}
              </span>
            )}
          </div>
          <select
            value={vehicleId ?? ''}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1d4ed8] outline-none"
            required
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                গাড়ি: {v.regNo} ({toBengaliDigits(v.seatCapacity)} আসন)
              </option>
            ))}
          </select>

          {direction === 'UP' && vehicleUpTripsToday.length > 0 && nextTripSeqLabel && (
            <div className="mt-2 p-2.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-xs text-[#1e3a8a] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#1d4ed8]" />
              <span>
                এই গাড়িটির ({selectedVehicle?.regNo}) {formatBengaliDate(date)} তারিখে ইতিমধ্যে {toBengaliDigits(vehicleUpTripsToday.length)}টি আপ ট্রিপ নির্ধারিত আছে। নতুন ট্রিপ যুক্ত করলে এটি গাড়িটির <strong>{nextTripSeqLabel}</strong> হিসেবে যুক্ত হবে।
              </span>
            </div>
          )}
        </div>

        {/* 5. Route Selection (Filtered strictly by UP or DOWN) */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#1d4ed8]" />
            <span>৫. রুট নির্বাচন ({direction === 'UP' ? 'আপ রুট' : 'ডাউন রুট'}) *</span>
          </label>
          {availableRoutes.length > 0 ? (
            <select
              value={routeId ?? ''}
              onChange={(e) => setRouteId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1d4ed8] outline-none"
              required
            >
              {availableRoutes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.routeNumber ? `${toBengaliDigits(r.routeNumber)} নং রুট — ` : ''}{r.name} {r.baseFare ? `— ৳${r.baseFare}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-[#f8fafc] text-[#1e3a8a] border border-slate-200 rounded-xl text-xs">
              এই ট্রিপ টাইপের ({direction === 'UP' ? 'আপ' : 'ডাউন'}) জন্য কোনো সক্রিয় রুট পাওয়া যায়নি। রুট ব্যবস্থাপনা পেজ থেকে রুট তৈরি করতে পারেন।
            </div>
          )}
        </div>

        {/* 6 & 7. Supervisor & Driver */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#1d4ed8]" />
              <span>৬. সুপারভাইজার নির্বাচন (তালিকা থেকে) *</span>
            </label>
            {supervisorsList.length > 0 ? (
              <select
                value={supervisor ?? ''}
                onChange={(e) => setSupervisor(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1d4ed8] outline-none max-h-48 overflow-y-auto"
                required
              >
                <option value="">-- সুপারভাইজার নির্বাচন করুন --</option>
                {supervisorsList.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={supervisor ?? ''}
                onChange={(e) => setSupervisor(e.target.value)}
                placeholder="সুপারভাইজারের নাম লিখুন"
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1d4ed8] outline-none"
                required
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#1e3a8a]" />
              <span>৭. ড্রাইভার নির্বাচন (তালিকা থেকে)</span>
            </label>
            {driversList.length > 0 ? (
              <select
                value={driver ?? ''}
                onChange={(e) => setDriver(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1d4ed8] outline-none max-h-48 overflow-y-auto"
              >
                <option value="">-- ড্রাইভার নির্বাচন করুন (ঐচ্ছিক) --</option>
                {driversList.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={driver ?? ''}
                onChange={(e) => setDriver(e.target.value)}
                placeholder="ড্রাইভারের নাম লিখুন (ঐচ্ছিক)"
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1d4ed8] outline-none"
              />
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2 border-t border-slate-200">
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>{loading ? 'শিডিউল তৈরি হচ্ছে...' : 'নতুন ট্রিপ শিডিউল সংরক্ষণ করুন'}</span>
          </button>
        </div>
      </form>

      {/* Confirmation Modal for Vehicle Multi-Trip on same day */}
      {showConfirmDoubleTrip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90dvh] overflow-hidden">
            <div className="shrink-0 p-5 overflow-y-auto overscroll-contain space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#eff6ff] text-[#1d4ed8] flex items-center justify-center mx-auto border border-[#bfdbfe]">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center">
                <h3 className="text-base font-bold text-slate-950">
                  {nextTripSeqLabel} তৈরির সতর্কতা ও নিশ্চিতকরণ
                </h3>
                <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
                  গাড়ি নম্বর <strong className="text-slate-950">{selectedVehicle?.regNo}</strong> এর আজকের দিনে ({formatBengaliDate(date)}) ইতিমধ্যে <strong className="text-[#1d4ed8]">{toBengaliDigits(vehicleUpTripsToday.length)}টি আপ ট্রিপ</strong> বিদ্যমান রয়েছে।
                </p>
                <div className="mt-2 p-2.5 bg-[#eff6ff] rounded-xl border border-[#bfdbfe] text-[#1e3a8a] text-xs font-semibold">
                  আপনি কি নিশ্চিতভাবে এই গাড়ির জন্য <strong>&ldquo;{nextTripSeqLabel}&rdquo;</strong> তৈরি করতে চান?
                </div>
              </div>
            </div>

            <div className="shrink-0 px-4 py-3 bg-[#f8fafc] border-t border-slate-200 grid grid-cols-2 gap-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setShowConfirmDoubleTrip(false)}
                className="min-h-[44px] py-2 px-4 bg-white hover:bg-[#eff6ff] border border-slate-200 text-[#1e3a8a] rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={executeCreate}
                className="min-h-[44px] py-2 px-4 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                হ্যাঁ, {nextTripSeqLabel} নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      <ForwardUpTripsModal
        isOpen={showForwardModal}
        onClose={() => setShowForwardModal(false)}
        defaultTargetDate={date}
        onForwarded={(targetDate, createdCount, skippedCount) => {
          setDate(targetDate);
          setSuccessMsg(
            `সফল! ${toBengaliDigits(createdCount)}টি আপ ট্রিপ ${targetDate} তারিখে ফরোয়ার্ড করা হয়েছে${
              skippedCount > 0 ? ` (${toBengaliDigits(skippedCount)}টি ডুপ্লিকেট বাদ)` : ''
            }।`
          );
          loadDaySchedules();
          if (onScheduleCreated) onScheduleCreated();
        }}
      />
    </div>
  );
};
