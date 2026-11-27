import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.ts';
import type { Schedule } from '../types/index.ts';
import {
  formatBengaliDate,
  getTodayDhakaDate,
  toBengaliDigits,
  formatTime12Hour,
} from '../utils/formatters.ts';
import { groupSchedulesByRouteNumber } from '../utils/routeSort.ts';
import { addDaysToDateStr } from './WeeklyScheduleTimeline.tsx';
import { DateInput } from './DateInput.tsx';
import {
  Calendar,
  Forward,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';

interface ForwardUpTripsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTargetDate?: string;
  onForwarded?: (targetDate: string, createdCount: number, skippedCount: number) => void;
}

export const ForwardUpTripsModal: React.FC<ForwardUpTripsModalProps> = ({
  isOpen,
  onClose,
  defaultTargetDate,
  onForwarded,
}) => {
  const todayStr = getTodayDhakaDate();
  const yesterdayStr = addDaysToDateStr(todayStr, -1);

  const [sourceDate, setSourceDate] = useState<string>(yesterdayStr);
  const [targetDate, setTargetDate] = useState<string>(defaultTargetDate || todayStr);
  const [sourceTrips, setSourceTrips] = useState<Schedule[]>([]);
  const [existingTargetTrips, setExistingTargetTrips] = useState<Schedule[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSourceDate(yesterdayStr);
      setTargetDate(defaultTargetDate || todayStr);
      setErrorMsg('');
    }
  }, [isOpen, defaultTargetDate, todayStr, yesterdayStr]);

  const loadTrips = useCallback(async () => {
    if (!isOpen || !sourceDate || !targetDate) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const [srcRes, tgtRes] = await Promise.all([
        api.getSchedules({ date: sourceDate, exactDateOnly: true, direction: 'UP' }),
        api.getSchedules({ date: targetDate, exactDateOnly: true, direction: 'UP' }),
      ]);
      const upList = (srcRes.schedules || []).filter(
        (s) => s.date === sourceDate && s.direction === 'UP' && s.status !== 'cancelled'
      );
      const tgtList = (tgtRes.schedules || []).filter(
        (s) => s.date === targetDate && s.direction === 'UP' && s.status !== 'cancelled'
      );
      const ordered = groupSchedulesByRouteNumber(upList).flatMap((g) => g.trips);
      setSourceTrips(ordered);
      setExistingTargetTrips(tgtList);

      // Default select all non-duplicate trips
      const nonDuplicateIds = ordered
        .filter(
          (src) =>
            !tgtList.some(
              (t) => t.vehicleId === src.vehicleId && t.departureTime === src.departureTime
            )
        )
        .map((s) => s.id);
      setSelectedIds(nonDuplicateIds);
    } catch (err: any) {
      setErrorMsg(err.message || 'শিডিউল তথ্য লোড করা সম্ভব হয়নি।');
    } finally {
      setLoading(false);
    }
  }, [isOpen, sourceDate, targetDate]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  if (!isOpen) return null;

  const isDuplicateOnTarget = (src: Schedule) =>
    existingTargetTrips.some(
      (t) => t.vehicleId === src.vehicleId && t.departureTime === src.departureTime
    );

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const nonDuplicateTrips = sourceTrips.filter((s) => !isDuplicateOnTarget(s));
  const allNonDuplicateSelected =
    nonDuplicateTrips.length > 0 &&
    nonDuplicateTrips.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allNonDuplicateSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(nonDuplicateTrips.map((s) => s.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setErrorMsg('ফরোয়ার্ড করার জন্য কমপক্ষে একটি আপ ট্রিপ নির্বাচন করুন।');
      return;
    }
    if (sourceDate === targetDate) {
      setErrorMsg('পূর্ববর্তী তারিখ এবং লক্ষ্য তারিখ ভিন্ন হতে হবে।');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.forwardUpSchedules({
        sourceDate,
        targetDate,
        scheduleIds: selectedIds,
      });
      if (onForwarded) {
        onForwarded(targetDate, res.createdCount, res.skippedCount);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'আপ ট্রিপ ফরোয়ার্ড ব্যর্থ হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const groupedPreview = groupSchedulesByRouteNumber(sourceTrips);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full max-h-[92dvh] sm:max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
        {/* Sticky Header */}
        <div className="shrink-0 px-4 py-3 bg-[#1d4ed8] text-white flex items-center justify-between gap-2 border-b border-[#1e40af]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#1e40af] text-white flex items-center justify-center shrink-0">
              <Forward className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black truncate">
                গতকালের আপ ট্রিপ ফরোয়ার্ড করুন
              </h3>
              <p className="text-[11px] text-[#dbeafe] truncate">
                পূর্ববর্তী দিনের সকল আপ ট্রিপ আজকের বা নির্দিষ্ট তারিখে নিয়ে এসে সহজেই এডিট/ডিলিট করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#dbeafe] hover:text-white rounded-lg hover:bg-white/15 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 text-slate-900">
            {/* Date Selection Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#f8fafc] p-4 rounded-2xl border border-slate-200">
              {/* Source Date */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#1d4ed8]" />
                    <span>কোন তারিখ থেকে নিবেন (উৎস):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSourceDate(yesterdayStr)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      sourceDate === yesterdayStr
                        ? 'bg-[#1d4ed8] text-white border-[#1d4ed8]'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    গতকাল
                  </button>
                </div>
                <DateInput
                  value={sourceDate}
                  onChange={(e) => setSourceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                  required
                />
              </div>

              {/* Target Date */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#1d4ed8]" />
                    <span>কোন তারিখে যুক্ত করবেন (লক্ষ্য):</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTargetDate(todayStr)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                        targetDate === todayStr
                          ? 'bg-[#1d4ed8] text-white border-[#1d4ed8]'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      আজকে
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetDate(addDaysToDateStr(todayStr, 1))}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                        targetDate === addDaysToDateStr(todayStr, 1)
                          ? 'bg-[#1d4ed8] text-white border-[#1d4ed8]'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      আগামীকাল
                    </button>
                  </div>
                </div>
                <DateInput
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                  required
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-[#eff6ff] border border-[#1d4ed8] text-[#1e3a8a] rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#1d4ed8]" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Preview Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="text-xs font-bold text-slate-800">
                পাওয়া গেছে: <span className="text-[#1e3a8a]">{toBengaliDigits(sourceTrips.length)} টি আপ ট্রিপ</span>{' '}
                (নির্বাচিত: <span className="text-[#1d4ed8]">{toBengaliDigits(selectedIds.length)} টি</span>)
              </div>

              <div className="flex items-center gap-2">
                {nonDuplicateTrips.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="px-3 py-1.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1e3a8a] border border-[#bfdbfe] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {allNonDuplicateSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[#1d4ed8]" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{allNonDuplicateSelected ? 'সব আনচেক করুন' : 'সব সিলেক্ট করুন'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadTrips}
                  className="p-1.5 bg-[#f8fafc] hover:bg-[#eff6ff] border border-slate-200 rounded-xl text-[#1e3a8a] cursor-pointer"
                  title="রিফ্রেশ"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Source UP Trips Table */}
            {loading ? (
              <div className="py-10 text-center text-xs text-slate-600">
                আপ ট্রিপের তালিকা লোড হচ্ছে...
              </div>
            ) : sourceTrips.length === 0 ? (
              <div className="py-10 text-center bg-[#f8fafc] rounded-2xl border border-slate-200 text-xs text-slate-600">
                {formatBengaliDate(sourceDate)} তারিখে কোনো আপ ট্রিপ পাওয়া যায়নি।
              </div>
            ) : (
              <div className="space-y-3">
                {groupedPreview.map((grp) => (
                  <div key={grp.routeName} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-[#eff6ff] border-b border-slate-200 flex items-center justify-between text-xs font-bold text-[#1e3a8a]">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#1d4ed8] text-white text-[10px] font-black tabular-nums">
                          {toBengaliDigits(grp.routeNumber)} নং রুট
                        </span>
                        <span>{grp.routeName}</span>
                      </div>
                      <span className="text-[11px] text-slate-700">
                        {toBengaliDigits(grp.trips.length)} টি ট্রিপ
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#1d4ed8] text-white font-bold text-[11px] border-b border-[#1e40af]">
                            <th className="py-2 px-2.5 text-center w-10">সিলেক্ট</th>
                            <th className="py-2 px-2.5">সময়</th>
                            <th className="py-2 px-2.5">গাড়ি নম্বর</th>
                            <th className="py-2 px-2.5">সুপারভাইজার</th>
                            <th className="py-2 px-2.5">ড্রাইভার</th>
                            <th className="py-2 px-2.5 text-center">স্ট্যাটাস</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {grp.trips.map((trip) => {
                            const duplicate = isDuplicateOnTarget(trip);
                            const checked = selectedIds.includes(trip.id);

                            return (
                              <tr
                                key={trip.id}
                                onClick={() => !duplicate && toggleId(trip.id)}
                                className={`${
                                  duplicate
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : checked
                                    ? 'bg-[#eff6ff] hover:bg-[#dbeafe] cursor-pointer'
                                    : 'odd:bg-white even:bg-[#f1f5f9] hover:bg-[#eff6ff] cursor-pointer'
                                }`}
                              >
                                <td className="py-2 px-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={duplicate}
                                    onChange={() => {}}
                                    className="w-4 h-4 accent-[#1d4ed8] cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 px-2.5 font-mono font-bold tabular-nums">
                                  {formatTime12Hour(trip.departureTime)}
                                </td>
                                <td className="py-2 px-2.5 font-bold">
                                  {trip.vehicleRegNo}
                                </td>
                                <td className="py-2 px-2.5">{trip.supervisor}</td>
                                <td className="py-2 px-2.5">{trip.driver || '-'}</td>
                                <td className="py-2 px-2.5 text-center">
                                  {duplicate ? (
                                    <span className="px-2 py-0.5 rounded bg-[#f8fafc] text-slate-700 border border-slate-200 text-[10px] font-bold">
                                      লক্ষ্য তারিখে আছে
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] text-[10px] font-bold">
                                      ফরোয়ার্ডযোগ্য
                                    </span>
                                  )}
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

          {/* Sticky Modal Footer */}
          <div className="shrink-0 px-4 py-3 bg-[#f8fafc] border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="text-[11px] text-slate-700 hidden sm:block">
              শুধুমাত্র <strong>আপ ট্রিপ (UP)</strong> ফরোয়ার্ড হবে; সিট বুকিং ও টাকা ০ থেকে শুরু হবে।
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 bg-white border border-slate-200 hover:bg-[#eff6ff] text-slate-900 rounded-xl text-xs font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={submitting || selectedIds.length === 0}
                className="min-h-[44px] px-5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'ফরোয়ার্ড হচ্ছে...'
                    : `${toBengaliDigits(selectedIds.length)}টি আপ ট্রিপ ফরোয়ার্ড`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
