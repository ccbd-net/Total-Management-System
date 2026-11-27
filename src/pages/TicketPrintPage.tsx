import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.ts';
import type { Booking } from '../types/index.ts';
import { ThermalTicketModal } from '../components/ThermalTicketModal.tsx';
import { PrinterSettingsModal } from '../components/PrinterSettingsModal.tsx';
import { DateInput } from '../components/DateInput.tsx';
import { useDataSync } from '../hooks/useDataSync.ts';
import { formatTaka, toBengaliDigits, formatBengaliDateTime, getTodayDhakaDate, formatTime12Hour } from '../utils/formatters.ts';
import { getBookingFareParts } from '../utils/routeSort.ts';
import {
  Printer,
  Search,
  Calendar,
  Ticket,
  Clock,
  User,
  CheckCircle,
  RefreshCw,
  Phone,
  Filter,
} from 'lucide-react';

export const TicketPrintPage: React.FC = () => {
  const [date, setDate] = useState<string>(getTodayDhakaDate());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBookingForPrint, setSelectedBookingForPrint] = useState<Booking | null>(null);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.getBookings({ date });
      setBookings(res.bookings);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [date]);

  // Real-time synchronization
  useDataSync(
    useCallback(() => {
      fetchBookings();
    }, [date])
  );

  // Filter bookings by search term (ticketNo, phone, passengerName, seatNumber)
  const filteredBookings = bookings.filter((b) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.ticketNo.toLowerCase().includes(term) ||
      b.passengerName.toLowerCase().includes(term) ||
      b.passengerPhone.includes(term) ||
      b.vehicleRegNo.toLowerCase().includes(term) ||
      b.seatNumbers.some((s) => s.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-3">
      {/* Compact Excel Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#1d4ed8] px-3 py-2 text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Printer className="w-4 h-4 shrink-0 text-[#93c5fd]" />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold leading-tight truncate">
                ৫৮ মিমি থার্মাল টিকিট প্রিন্ট ও রিপ্রিন্ট শীট
              </h2>
              <p className="hidden sm:block text-[10px] text-[#dbeafe] leading-tight">
                ইস্যুকৃত সকল টিকিটের তালিকা, যাত্রী কপি ও অফিস কপি পুনর্মুদ্রণ
              </p>
            </div>
          </div>

          {/* Date Selector, Printer Config & Refresh */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsPrinterModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#eff6ff] text-[#1e3a8a] rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#1d4ed8]" />
              <span>প্রিন্টার</span>
            </button>

            <div className="flex items-center gap-1 bg-white/95 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-900">
              <Calendar className="w-3.5 h-3.5 text-[#1d4ed8]" />
              <DateInput
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent outline-none cursor-pointer text-[11px]"
              />
            </div>

            <button
              type="button"
              onClick={fetchBookings}
              className="p-1.5 bg-[#1e40af] hover:bg-white/15 text-white border border-white/20 rounded-lg transition-colors cursor-pointer"
              title="রিফ্রেশ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Compact Search Strip */}
        <div className="p-2 bg-[#f8fafc] flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#1d4ed8]">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="টিকিট নম্বর, যাত্রীর নাম, মোবাইল নম্বর অথবা সিট নম্বর দিয়ে খুঁজুন..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-950 focus:ring-2 focus:ring-[#1d4ed8] outline-none"
            />
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-[11px] text-[#1e3a8a] hover:bg-[#eff6ff] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold cursor-pointer"
            >
              ক্লিয়ার
            </button>
          )}
        </div>
      </div>

      {/* Bookings Excel Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#1e3a8a] px-3 py-1.5 text-white flex items-center justify-between">
          <h3 className="font-bold text-xs">
            টিকিটের তালিকা ({toBengaliDigits(filteredBookings.length)} টি)
          </h3>
          <span className="text-[10px] text-[#dbeafe]">
            ৫৮ মিমি থার্মাল পিওএস
          </span>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            {searchTerm ? 'কোনো টিকিট খুঁজে পাওয়া যায়নি।' : 'এই তারিখে কোনো বুকিং নেই।'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-[#1d4ed8] text-white border-b border-[#1e40af]">
                  <th className="py-2 px-2.5 font-bold border-r border-blue-600/60">টিকিট নং</th>
                  <th className="py-2 px-2.5 font-bold border-r border-blue-600/60">কাউন্টার ও অপারেটর</th>
                  <th className="py-2 px-2.5 font-bold border-r border-blue-600/60">ট্রিপ ও সময়</th>
                  <th className="py-2 px-2.5 font-bold border-r border-blue-600/60">যাত্রী ও ফোন</th>
                  <th className="py-2 px-2.5 font-bold border-r border-blue-600/60">আসন</th>
                  <th className="py-2 px-2.5 font-bold text-right border-r border-blue-600/60">সিট ভাড়া</th>
                  <th className="py-2 px-2.5 font-bold text-right border-r border-blue-600/60">মালের ভাড়া</th>
                  <th className="py-2 px-2.5 font-bold text-right border-r border-blue-600/60">মোট টাকা</th>
                  <th className="py-2 px-2.5 font-bold text-center border-r border-blue-600/60">প্রিন্ট</th>
                  <th className="py-2 px-2.5 font-bold text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBookings.map((b) => {
                  const parts = getBookingFareParts(b);
                  return (
                    <tr key={b.id} className="odd:bg-white even:bg-[#f1f5f9] hover:bg-[#eff6ff] transition-colors">
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="font-mono font-bold text-slate-900">{b.ticketNo}</div>
                        <div className="text-[10px] text-slate-500">{formatBengaliDateTime(b.bookedAt)}</div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: b.counterColor }}
                          />
                          <span className="font-semibold text-slate-800">{b.counterName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{b.bookedByUserName}</div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-800">{b.tripNo} ({formatTime12Hour(b.tripTime)})</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{b.routeName}</div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-800">{b.passengerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{b.passengerPhone || 'নেই'}</div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200">
                        {b.seatNumbers.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-1">
                              {b.seatNumbers.map((s) => (
                                <span
                                  key={s}
                                  className="px-1.5 py-0.5 rounded text-[11px] font-bold text-white shadow-2xs"
                                  style={{ backgroundColor: b.counterColor }}
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              মোট: {toBengaliDigits(b.totalSeats)} সিট
                            </div>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-[#eff6ff] text-[#1e3a8a] border border-[#bfdbfe] text-[10px] font-bold">
                            মালামাল বুকিং
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-200 tabular-nums whitespace-nowrap">
                        {formatTaka(parts.seatFare)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-[#1e3a8a] border-r border-slate-200 tabular-nums whitespace-nowrap">
                        {formatTaka(parts.cargoFare)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-black text-[#1d4ed8] border-r border-slate-200 text-xs sm:text-sm tabular-nums whitespace-nowrap">
                        {formatTaka(parts.totalFare)}
                      </td>

                      <td className="py-2.5 px-3 text-center border-r border-slate-200">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            b.printedCount > 0
                              ? 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]'
                              : 'bg-[#f8fafc] text-slate-700 border-slate-200'
                          }`}
                        >
                          {toBengaliDigits(b.printedCount || 0)} বার
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedBookingForPrint(b)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>প্রিন্ট</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#eff6ff] border-t-2 border-[#bfdbfe] font-black text-xs text-[#1e3a8a]">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 text-right border-r border-[#bfdbfe]">
                    সর্বমোট ({toBengaliDigits(filteredBookings.length)} টি ভাউচার):
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#1e3a8a] border-r border-[#bfdbfe] tabular-nums whitespace-nowrap">
                    {formatTaka(filteredBookings.reduce((sum, b) => sum + getBookingFareParts(b).seatFare, 0))}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#1e3a8a] border-r border-[#bfdbfe] tabular-nums whitespace-nowrap">
                    {formatTaka(filteredBookings.reduce((sum, b) => sum + getBookingFareParts(b).cargoFare, 0))}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#1d4ed8] border-r border-[#bfdbfe] tabular-nums whitespace-nowrap">
                    {formatTaka(filteredBookings.reduce((sum, b) => sum + getBookingFareParts(b).totalFare, 0))}
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 text-center text-[10px] text-slate-600">
                    সিট + মাল = মোট
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Thermal Ticket Modal */}
      {selectedBookingForPrint && (
        <ThermalTicketModal
          booking={selectedBookingForPrint}
          onClose={() => setSelectedBookingForPrint(null)}
          onPrinted={fetchBookings}
        />
      )}

      {/* Printer Settings Modal */}
      <PrinterSettingsModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
      />
    </div>
  );
};
