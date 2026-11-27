import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { Vehicle, SeatCapacity, Schedule, Driver } from '../types/index.ts';
import { toBengaliDigits, formatTaka, getTodayDhakaDate, formatBengaliDate, formatBengaliDateTime } from '../utils/formatters.ts';
import {
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
  buildOwnerWhatsAppMessage,
} from '../utils/whatsapp.ts';
import { SeatMap } from '../components/SeatMap.tsx';
import { DateInput } from '../components/DateInput.tsx';
import {
  Bus,
  Plus,
  Edit,
  Eye,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  X,
  User,
  Phone,
  FileSpreadsheet,
  Printer,
  Layers,
  Trash2,
  MessageCircle,
  Truck,
  ChevronDown,
  Search,
  Check,
} from 'lucide-react';

export const VehiclesPage: React.FC = () => {
  const { isMasterAdmin, isModerator, activeCompanyId, user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // View Mode: 'fleet' (Vehicle list) or 'owners' (Owner fleet & trip report)
  const [viewTab, setViewTab] = useState<'fleet' | 'owners'>('fleet');
  const [fleetLayout, setFleetLayout] = useState<'table' | 'grid'>('table');
  const [reportDate, setReportDate] = useState<string>(getTodayDhakaDate());
  const [reportMonth, setReportMonth] = useState<string>(getTodayDhakaDate().substring(0, 7)); // YYYY-MM

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [regNo, setRegNo] = useState<string>('');
  const [seatCapacity, setSeatCapacity] = useState<SeatCapacity>(42);
  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerPhone, setOwnerPhone] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [isDriverPopupOpen, setIsDriverPopupOpen] = useState<boolean>(false);
  const [driverSearch, setDriverSearch] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'maintenance' | 'inactive'>('active');
  const [notes, setNotes] = useState<string>('');

  // Seat Layout Preview Modal
  const [previewVehicle, setPreviewVehicle] = useState<Vehicle | null>(null);

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fetchVehiclesAndSchedules = async () => {
    setLoading(true);
    try {
      const [vRes, sRes, dRes] = await Promise.all([
        api.getVehicles(),
        api.getSchedules(), // fetch all recent schedules to calculate owner trip counts
        api.getDrivers().catch(() => ({ drivers: [] as Driver[] })),
      ]);
      setVehicles(vRes.vehicles);
      setSchedules(sRes.schedules);
      setDrivers(dRes.drivers || []);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehiclesAndSchedules();
  }, []);

  const refreshDriversList = async () => {
    try {
      const dRes = await api.getDrivers();
      setDrivers(dRes.drivers || []);
    } catch {}
  };

  const filteredPopupDrivers = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => d.name.toLowerCase().includes(q));
  }, [drivers, driverSearch]);

  const openAddModal = () => {
    setEditingVehicle(null);
    setRegNo('');
    setSeatCapacity(42);
    setOwnerName('');
    setOwnerPhone('');
    setDriverName('');
    setDriverSearch('');
    setIsDriverPopupOpen(false);
    setStatus('active');
    setNotes('');
    setErrorMsg('');
    setIsModalOpen(true);
    refreshDriversList();
  };

  const openEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setRegNo(v.regNo || '');
    setSeatCapacity(v.seatCapacity || 42);
    setOwnerName(v.ownerName || '');
    setOwnerPhone(v.ownerPhone || '');
    setDriverName(v.driverName || '');
    setDriverSearch('');
    setIsDriverPopupOpen(false);
    setStatus(v.status || 'active');
    setNotes(v.notes || '');
    setErrorMsg('');
    setIsModalOpen(true);
    refreshDriversList();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!regNo.trim()) {
      setErrorMsg('গাড়ির রেজিস্ট্রেশন নম্বর আবশ্যক!');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMsg('গাড়ির মালিকের নাম আবশ্যক!');
      return;
    }

    try {
      if (editingVehicle) {
        await api.updateVehicle(editingVehicle.id, {
          regNo: regNo.trim(),
          seatCapacity,
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim(),
          driverName: driverName.trim(),
        });
        setSuccessMsg(`গাড়ি "${regNo}" এর তথ্য সফলভাবে আপডেট হয়েছে!`);
      } else {
        await api.createVehicle({
          regNo: regNo.trim(),
          seatCapacity,
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim(),
          driverName: driverName.trim(),
          companyId: activeCompanyId || user?.companyId,
        });
        setSuccessMsg(`নতুন গাড়ি "${regNo}" (মালিক: ${ownerName}) সফলভাবে যুক্ত হয়েছে!`);
      }
      setIsModalOpen(false);
      setIsDriverPopupOpen(false);
      await fetchVehiclesAndSchedules();
    } catch (err: any) {
      setErrorMsg(err.message || 'গাড়ি সংরক্ষণ ব্যর্থ হয়েছে।');
    }
  };

  const handleDeleteVehicle = async (v: Vehicle) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${v.regNo}" (মালিক: ${v.ownerName}) গাড়িটি মুছে ফেলতে চান?`)) {
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.deleteVehicle(v.id);
      setSuccessMsg(`গাড়ি "${v.regNo}" সফলভাবে মুছে ফেলা হয়েছে!`);
      await fetchVehiclesAndSchedules();
    } catch (err: any) {
      setErrorMsg(err.message || 'গাড়ি ডিলিট ব্যর্থ হয়েছে।');
    }
  };

  // Owner-wise Analytics Calculation
  const ownerStats = useMemo(() => {
    const map = new Map<
      string,
      {
        ownerName: string;
        ownerPhone: string;
        vehicles: Vehicle[];
        dailyTrips: Schedule[];
        monthlyTrips: Schedule[];
        allTrips: Schedule[];
      }
    >();

    // Index vehicles by owner
    for (const v of vehicles) {
      const oName = v.ownerName?.trim() || 'অনির্দিষ্ট মালিক';
      if (!map.has(oName)) {
        map.set(oName, {
          ownerName: oName,
          ownerPhone: v.ownerPhone || '',
          vehicles: [],
          dailyTrips: [],
          monthlyTrips: [],
          allTrips: [],
        });
      }
      const entry = map.get(oName)!;
      entry.vehicles.push(v);
      if (!entry.ownerPhone && v.ownerPhone) {
        entry.ownerPhone = v.ownerPhone;
      }
    }

    // Index schedules to owner's vehicles
    const vehicleToOwner = new Map<string, string>();
    for (const v of vehicles) {
      vehicleToOwner.set(v.id, v.ownerName?.trim() || 'অনির্দিষ্ট মালিক');
      vehicleToOwner.set(v.regNo, v.ownerName?.trim() || 'অনির্দিষ্ট মালিক');
    }

    for (const s of schedules) {
      if (s.status === 'cancelled') continue;
      const oName =
        s.vehicleOwnerName?.trim() ||
        vehicleToOwner.get(s.vehicleId) ||
        vehicleToOwner.get(s.vehicleRegNo);
      if (oName && map.has(oName)) {
        const entry = map.get(oName)!;
        entry.allTrips.push(s);
        if (s.date === reportDate) {
          entry.dailyTrips.push(s);
        }
        if (s.date && s.date.startsWith(reportMonth)) {
          entry.monthlyTrips.push(s);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.vehicles.length - a.vehicles.length);
  }, [vehicles, schedules, reportDate, reportMonth]);

  // Export Owner Trip Report to Excel/CSV
  const exportOwnerReportToExcel = () => {
    if (ownerStats.length === 0) {
      setErrorMsg('এক্সপোর্ট করার মতো মালিক তথ্য নেই!');
      return;
    }

    const headers = [
      'ক্রমিক',
      'মালিকের নাম',
      'মালিকের মোবাইল',
      'মালিকানাধীন গাড়ির সংখ্যা',
      'গাড়ির নম্বরসমূহ',
      `নির্বাচিত দিনে ট্রিপ সংখ্যা (${reportDate})`,
      `চলতি মাসে মোট ট্রিপ (${reportMonth})`,
      'চলতি মাসে সর্বমোট বিক্রিত আসন',
      'সিট ভাড়া আদায় (৳)',
      'মালের ভাড়া (৳)',
      'সর্বমোট টাকা (সিট+মাল) (৳)',
    ];

    const rows = ownerStats.map((o, idx) => {
      const monthlySeats = o.monthlyTrips.reduce((acc, t) => acc + (t.totalBookedSeats || 0), 0);
      const monthlyCargo = o.monthlyTrips.reduce((acc, t) => acc + (Number(t.totalCargoCollection) || 0), 0);
      const monthlyAmount = o.monthlyTrips.reduce((acc, t) => acc + (t.totalCollection || 0), 0);
      const monthlySeatFare = o.monthlyTrips.reduce((acc, t) => {
        const cargo = Math.max(0, Number(t.totalCargoCollection) || 0);
        const total = Math.max(0, Number(t.totalCollection) || 0);
        return acc + (t.totalSeatCollection !== undefined ? Number(t.totalSeatCollection) : Math.max(0, total - cargo));
      }, 0);
      return [
        idx + 1,
        `"${o.ownerName}"`,
        `"${o.ownerPhone || '-'}"`,
        o.vehicles.length,
        `"${o.vehicles.map((v) => v.regNo).join(', ')}"`,
        o.dailyTrips.length,
        o.monthlyTrips.length,
        monthlySeats,
        monthlySeatFare,
        monthlyCargo,
        monthlyAmount,
      ].join(',');
    });

    const csvContent =
      '\uFEFF' +
      [
        `"Vehicles Management System — গাড়ির মালিকভিত্তিক বহর ও ট্রিপ অডিট রিপোর্ট"`,
        `"তারিখ: ${formatBengaliDate(reportDate)} | মাস: ${reportMonth} | প্রিন্ট সময়: ${formatBengaliDateTime(new Date().toISOString())}"`,
        headers.join(','),
        ...rows,
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Vehicle-Owner-Report-${reportMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#1d4ed8] px-3 py-2 text-white flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bus className="w-4 h-4 shrink-0 text-[#bfdbfe]" />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold leading-tight truncate text-white">
                গাড়ি ও মালিক ব্যবস্থাপনা (Vehicle & Fleet Owners)
              </h2>
              <p className="hidden sm:block text-[10px] text-[#dbeafe] leading-tight truncate">
                মালিকের নাম, ড্রাইভার, গাড়ির বহর ও দৈনিক/মাসিক ট্রিপ হিসাব
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {/* View Tab Toggle */}
            <div className="flex bg-[#1e3a8a] p-0.5 rounded-lg text-[11px] font-bold border border-[#1e40af]">
              <button
                type="button"
                onClick={() => setViewTab('fleet')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewTab === 'fleet'
                    ? 'bg-white/15 text-white border border-white/25 shadow-2xs'
                    : 'text-[#dbeafe] hover:bg-white/10 border border-transparent'
                }`}
              >
                গাড়ির বহর ({toBengaliDigits(vehicles.length)})
              </button>
              <button
                type="button"
                onClick={() => setViewTab('owners')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewTab === 'owners'
                    ? 'bg-white/15 text-white border border-white/25 shadow-2xs'
                    : 'text-[#dbeafe] hover:bg-white/10 border border-transparent'
                }`}
              >
                মালিকভিত্তিক ({toBengaliDigits(ownerStats.length)})
              </button>
            </div>

            <button
              type="button"
              onClick={fetchVehiclesAndSchedules}
              className="p-1.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white rounded-lg transition-colors cursor-pointer"
              title="রিফ্রেশ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {(isMasterAdmin || isModerator) && (
              <button
                type="button"
                onClick={openAddModal}
                className="px-2.5 py-1 bg-white hover:bg-[#eff6ff] text-[#1d4ed8] text-[11px] font-extrabold rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer border border-white/80"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>নতুন গাড়ি যুক্ত</span>
              </button>
            )}
          </div>
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
        <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tab 1: Standard Vehicles List View with Owner Names */}
      {viewTab === 'fleet' && (
        <div className="space-y-2.5">
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-800">
              মোট নিবন্ধিত গাড়ি: <strong className="text-[#1d4ed8]">{toBengaliDigits(vehicles.length)}</strong> টি
            </span>
            <div className="flex items-center gap-1 bg-[#1e3a8a] p-0.5 rounded-lg border border-[#1e40af] text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setFleetLayout('table')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  fleetLayout === 'table'
                    ? 'bg-white/15 text-white border border-white/25 shadow-2xs'
                    : 'text-[#dbeafe] hover:bg-white/10 border border-transparent'
                }`}
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>এক্সেল শীট</span>
              </button>
              <button
                type="button"
                onClick={() => setFleetLayout('grid')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  fleetLayout === 'grid'
                    ? 'bg-white/15 text-white border border-white/25 shadow-2xs'
                    : 'text-[#dbeafe] hover:bg-white/10 border border-transparent'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>কার্ড ভিউ</span>
              </button>
            </div>
          </div>

          {fleetLayout === 'table' ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                  <thead>
                    <tr className="bg-[#1d4ed8] text-white font-bold text-[11px] border-b border-[#1e40af]">
                      <th className="py-2 px-3 border-r border-blue-600/60 text-center w-12">নং</th>
                      <th className="py-2 px-3 border-r border-blue-600/60">গাড়ির নম্বর (Reg No)</th>
                      <th className="py-2 px-3 border-r border-blue-600/60">মালিকের নাম</th>
                      <th className="py-2 px-3 border-r border-blue-600/60">ড্রাইভারের নাম</th>
                      <th className="py-2 px-3 border-r border-blue-600/60">মালিকের মোবাইল</th>
                      <th className="py-2 px-3 border-r border-blue-600/60 text-center">আসন সংখ্যা</th>
                      <th className="py-2 px-3 border-r border-blue-600/60 text-center">আজকের ট্রিপ</th>
                      <th className="py-2 px-3 border-r border-blue-600/60 text-center">চলতি মাসের ট্রিপ</th>
                      <th className="py-2 px-3 border-r border-blue-600/60 text-center w-24">স্ট্যাটাস</th>
                      <th className="py-2 px-3 text-right">একশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {vehicles.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 border border-slate-200">
                          কোনো গাড়ি নিবন্ধিত নেই। "+ নতুন গাড়ি ও মালিক যুক্ত করুন" বাটনে ক্লিক করে যুক্ত করুন।
                        </td>
                      </tr>
                    ) : (
                      vehicles.map((v, idx) => {
                        const todayCount = schedules.filter(
                          (s) => s.vehicleId === v.id && s.date === reportDate && s.status !== 'cancelled'
                        ).length;
                        const monthCount = schedules.filter(
                          (s) => s.vehicleId === v.id && s.date && s.date.startsWith(reportMonth) && s.status !== 'cancelled'
                        ).length;

                        return (
                          <tr key={v.id} className="odd:bg-white even:bg-[#f1f5f9] hover:bg-[#eff6ff] transition-colors">
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-500">
                              {toBengaliDigits(idx + 1)}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900 font-mono">
                              <div className="flex items-center gap-1.5">
                                <Bus className="w-3.5 h-3.5 text-[#1d4ed8] shrink-0" />
                                <span>{v.regNo}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-800">
                              {v.ownerName || 'সাধারণ'}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-[#1e3a8a]">
                              {v.driverName ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#eff6ff] border border-[#bfdbfe] text-[11px]">
                                  <Truck className="w-3 h-3 text-[#1d4ed8] shrink-0" />
                                  <span>{v.driverName}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal italic">নির্ধারিত নয়</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-700">
                              {v.ownerPhone ? (
                                <div className="flex items-center gap-2">
                                  <a href={`tel:${v.ownerPhone}`} className="hover:text-[#1d4ed8] flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    <span>{v.ownerPhone}</span>
                                  </a>
                                  {normalizeWhatsAppPhone(v.ownerPhone) && (
                                    <a
                                      href={buildWhatsAppUrl(
                                        v.ownerPhone,
                                        `*${user?.company?.name || 'কাউন্টার টিকেটিং'}*\nমালিক: ${v.ownerName || 'সাধারণ'}\nগাড়ি: ${v.regNo}\nআজ (${reportDate}) ট্রিপ: ${toBengaliDigits(todayCount)} টি\nচলতি মাস (${reportMonth}) ট্রিপ: ${toBengaliDigits(monthCount)} টি`
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] rounded text-[10px] font-sans font-bold"
                                      title="হোয়াটসঅ্যাপে বার্তা পাঠান"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                      <span>WA</span>
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">প্রযোজ্য নয়</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f8fafc] text-[#1e3a8a] border border-slate-200">
                                {toBengaliDigits(v.seatCapacity)} আসন ({v.seatCapacity === 42 ? '৪২ সিট' : '৪৬ সিট'})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-[#1e3a8a]">
                              {toBengaliDigits(todayCount)} টি
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center bg-[#eff6ff]/60 font-bold text-[#1d4ed8]">
                              {toBengaliDigits(monthCount)} টি
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  v.status === 'active'
                                    ? 'bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]'
                                    : v.status === 'maintenance'
                                    ? 'bg-[#1e3a8a] text-white border border-[#1e40af]'
                                    : 'bg-[#f8fafc] text-slate-600 border border-slate-200'
                                }`}
                              >
                                {v.status === 'active' ? 'সক্রিয়' : v.status === 'maintenance' ? 'সার্ভিসিং' : 'নিষ্ক্রিয়'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setPreviewVehicle(v)}
                                  className="px-2 py-1 bg-[#f8fafc] hover:bg-[#eff6ff] text-[#1e3a8a] border border-slate-200 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="সিট ম্যাপ"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>সিট ম্যাপ</span>
                                </button>
                                {(isMasterAdmin || isModerator) && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(v)}
                                      className="p-1 text-[#1d4ed8] hover:bg-[#eff6ff] rounded transition-colors cursor-pointer"
                                      title="সম্পাদনা"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVehicle(v)}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                      title="মুছে ফেলুন"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {vehicles.map((v) => {
                const todayCount = schedules.filter(
                  (s) => s.vehicleId === v.id && s.date === reportDate && s.status !== 'cancelled'
                ).length;
                const monthCount = schedules.filter(
                  (s) => s.vehicleId === v.id && s.date && s.date.startsWith(reportMonth) && s.status !== 'cancelled'
                ).length;

                return (
                  <div
                    key={v.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between"
                  >
                    <div className={`${v.status === 'active' ? 'bg-[#1d4ed8]' : v.status === 'maintenance' ? 'bg-[#1e3a8a]' : 'bg-[#1e40af]'} px-3 py-1.5 text-white flex items-center justify-between gap-2`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Bus className="w-3.5 h-3.5 shrink-0 text-[#bfdbfe]" />
                        <h3 className="font-bold text-xs truncate font-mono">{v.regNo}</h3>
                      </div>
                      <span className="px-1.5 py-0.2 rounded bg-white/15 border border-white/25 text-[10px] font-bold shrink-0">
                        {v.status === 'active' ? 'সক্রিয়' : v.status === 'maintenance' ? 'সার্ভিসিং' : 'নিষ্ক্রিয়'}
                      </span>
                    </div>

                    <div className="p-3 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] pb-1.5 border-b border-slate-200">
                        <span className="font-bold text-[#1e3a8a] flex items-center gap-1">
                          <User className="w-3 h-3 text-[#1d4ed8]" />
                          <span>মালিক: {v.ownerName || 'সাধারণ'}</span>
                        </span>
                        {v.driverName && (
                          <span className="font-bold text-[#1d4ed8] flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            <span>{v.driverName}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">আসন সংখ্যা:</span>
                        <span className="font-bold text-[#1e3a8a] bg-[#eff6ff] px-2.5 py-0.5 rounded-lg border border-[#bfdbfe]">
                          {toBengaliDigits(v.seatCapacity)} আসন ({v.seatCapacity === 42 ? '৪২ সিট' : '৪৬ সিট'})
                        </span>
                      </div>

                      {v.ownerPhone && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-600 font-medium">মালিকের মোবাইল:</span>
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${v.ownerPhone}`}
                              className="font-mono text-[#1d4ed8] font-semibold hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{v.ownerPhone}</span>
                            </a>
                            {normalizeWhatsAppPhone(v.ownerPhone) && (
                              <a
                                href={buildWhatsAppUrl(
                                  v.ownerPhone,
                                  `*${user?.company?.name || 'কাউন্টার টিকেটিং'}*\nমালিক: ${v.ownerName || 'সাধারণ'}\nগাড়ি: ${v.regNo}\nআজ (${reportDate}) ট্রিপ: ${toBengaliDigits(todayCount)} টি\nচলতি মাস (${reportMonth}) ট্রিপ: ${toBengaliDigits(monthCount)} টি`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-md text-[10px] font-bold"
                                title="হোয়াটসঅ্যাপে বার্তা পাঠান"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>হোয়াটসঅ্যাপ</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Trip Counts Today & Monthly */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                        <div className="p-2 bg-[#f8fafc] rounded-xl border border-slate-200 text-center">
                          <div className="text-[10px] text-slate-600">আজকের ট্রিপ</div>
                          <div className="text-sm font-black text-[#1e3a8a] mt-0.5">
                            {toBengaliDigits(todayCount)} টি
                          </div>
                        </div>

                        <div className="p-2 bg-[#eff6ff] rounded-xl border border-[#bfdbfe] text-center">
                          <div className="text-[10px] text-slate-600">চলতি মাসে ট্রিপ</div>
                          <div className="text-sm font-black text-[#1d4ed8] mt-0.5">
                            {toBengaliDigits(monthCount)} টি
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 text-slate-500 text-[11px] truncate">
                        {v.notes ? `নোট: ${v.notes}` : 'কোনো অতিরিক্ত নোট নেই'}
                      </div>
                    </div>

                    <div className="px-3 py-2 bg-[#f8fafc] border-t border-slate-200 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewVehicle(v)}
                        className="px-3 py-1.5 bg-white hover:bg-[#eff6ff] text-[#1e3a8a] border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>সিট ম্যাপ</span>
                      </button>

                      {(isMasterAdmin || isModerator) && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(v)}
                            className="px-2.5 py-1.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="সম্পাদনা"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>এডিট</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVehicle(v)}
                            className="px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ডিলিট</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Owner-wise Fleet & Trip Audit View */}
      {viewTab === 'owners' && (
        <div className="space-y-3">
          {/* Filter Bar for Owner Report */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Daily Filter */}
              <div className="flex items-center gap-1.5 bg-[#f8fafc] px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold">
                <span className="text-slate-600">দিন:</span>
                <DateInput
                  value={reportDate ?? ''}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer font-bold text-[#1e3a8a]"
                />
              </div>

              {/* Month Filter */}
              <div className="flex items-center gap-1.5 bg-[#f8fafc] px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold">
                <span className="text-slate-600">মাস:</span>
                <input
                  type="month"
                  value={reportMonth ?? ''}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer font-bold text-[#1e3a8a]"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={exportOwnerReportToExcel}
                className="px-2.5 py-1 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>এক্সেল (.CSV)</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-2.5 py-1 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>প্রিন্ট</span>
              </button>
            </div>
          </div>

          {/* Owner Sheet Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ownerStats.map((o) => {
              const monthlySeats = o.monthlyTrips.reduce((acc, t) => acc + (t.totalBookedSeats || 0), 0);
              const monthlyCargo = o.monthlyTrips.reduce((acc, t) => acc + (Number(t.totalCargoCollection) || 0), 0);
              const monthlySeatFare = o.monthlyTrips.reduce((acc, t) => {
                const cargo = Math.max(0, Number(t.totalCargoCollection) || 0);
                const total = Math.max(0, Number(t.totalCollection) || 0);
                return acc + (t.totalSeatCollection !== undefined ? Number(t.totalSeatCollection) : Math.max(0, total - cargo));
              }, 0);
              const monthlyAmount = monthlySeatFare + monthlyCargo;
              const dailySeats = o.dailyTrips.reduce((acc, t) => acc + (t.totalBookedSeats || 0), 0);
              const dailyCargo = o.dailyTrips.reduce((acc, t) => acc + (Number(t.totalCargoCollection) || 0), 0);
              const dailySeatFare = o.dailyTrips.reduce((acc, t) => {
                const cargo = Math.max(0, Number(t.totalCargoCollection) || 0);
                const total = Math.max(0, Number(t.totalCollection) || 0);
                return acc + (t.totalSeatCollection !== undefined ? Number(t.totalSeatCollection) : Math.max(0, total - cargo));
              }, 0);
              const dailyAmount = dailySeatFare + dailyCargo;

              return (
                <div
                  key={o.ownerName}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between"
                >
                  {/* Owner Header */}
                  <div className="bg-[#1d4ed8] px-3 py-1.5 text-white flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-4 h-4 shrink-0 text-[#bfdbfe]" />
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs truncate">{o.ownerName}</h3>
                        <div className="text-[10px] text-[#dbeafe] font-mono truncate">
                          {o.ownerPhone || 'মোবাইল নেই'}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/15 border border-white/25 text-[10px] font-bold shrink-0">
                      {toBengaliDigits(o.vehicles.length)} টি গাড়ি
                    </span>
                  </div>
                  <div className="p-3 space-y-2.5">

                  {/* Owned Vehicles Chips */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                      মালিকানাধীন গাড়িসমূহ:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {o.vehicles.map((v) => (
                        <span
                          key={v.id}
                          className="px-2.5 py-1 rounded-xl bg-[#f8fafc] text-slate-800 text-xs font-bold border border-slate-200 flex items-center gap-1"
                        >
                          <Bus className="w-3 h-3 text-[#1d4ed8]" />
                          <span>{v.regNo}</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({toBengaliDigits(v.seatCapacity)} সিট)
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Trip Statistics: Daily vs Monthly */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    {/* Selected Day Stats */}
                    <div className="p-3 bg-[#f8fafc] rounded-2xl border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-600 mb-1">
                        আজকের দিনে ({reportDate})
                      </div>
                      <div className="text-xl font-black text-[#1e3a8a]">
                        {toBengaliDigits(o.dailyTrips.length)} <span className="text-xs font-semibold">টি ট্রিপ</span>
                      </div>
                      <div className="text-[11px] text-slate-700 mt-1">
                        যাত্রী: {toBengaliDigits(dailySeats)} | মোট: <strong>{formatTaka(dailyAmount)}</strong>
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        সিট: {formatTaka(dailySeatFare)} | মাল: {formatTaka(dailyCargo)}
                      </div>
                    </div>

                    {/* Monthly Stats */}
                    <div className="p-3 bg-[#eff6ff] rounded-2xl border border-[#bfdbfe]">
                      <div className="text-[10px] font-bold text-[#1e3a8a] mb-1">
                        চলতি মাসে ({reportMonth})
                      </div>
                      <div className="text-xl font-black text-[#1d4ed8]">
                        {toBengaliDigits(o.monthlyTrips.length)} <span className="text-xs font-semibold">টি ট্রিপ</span>
                      </div>
                      <div className="text-[11px] text-[#1e3a8a] mt-1">
                        যাত্রী: {toBengaliDigits(monthlySeats)} | মোট: <strong>{formatTaka(monthlyAmount)}</strong>
                      </div>
                      <div className="text-[10px] text-[#1d4ed8] mt-0.5">
                        সিট: {formatTaka(monthlySeatFare)} | মাল: {formatTaka(monthlyCargo)}
                      </div>
                    </div>
                  </div>

                  {/* Direct WhatsApp Owner Report Action */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    {normalizeWhatsAppPhone(o.ownerPhone) ? (
                      <a
                        href={buildWhatsAppUrl(
                          o.ownerPhone,
                          buildOwnerWhatsAppMessage(
                            user?.company?.name || 'কাউন্টার টিকেটিং',
                            'মালিকভিত্তিক গাড়ির ট্রিপ ও আয় রিপোর্ট',
                            formatBengaliDate(reportDate),
                            {
                              ownerName: o.ownerName,
                              ownerPhone: o.ownerPhone,
                              vehicles: o.vehicles.map((v) => v.regNo),
                              tripCount: o.dailyTrips.length,
                              bookedSeats: dailySeats,
                              seatFare: dailySeatFare,
                              cargoFare: dailyCargo,
                              totalFare: dailyAmount,
                              customLines: [
                                `চলতি মাস (${reportMonth}) মোট ট্রিপ: ${toBengaliDigits(o.monthlyTrips.length)} টি`,
                                `মাসিক যাত্রী: ${toBengaliDigits(monthlySeats)} জন | মাসিক আয়: ${formatTaka(monthlyAmount)}`,
                              ],
                            }
                          )
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>হোয়াটসঅ্যাপে হিসাব পাঠান ({o.ownerPhone})</span>
                      </a>
                    ) : (
                      <div className="w-full py-1.5 px-3 bg-[#f8fafc] text-slate-600 border border-slate-200 rounded-lg text-[10.5px] font-semibold text-center">
                        হোয়াটসঅ্যাপে পাঠাতে মালিকের সঠিক ১১ সংখ্যার মোবাইল নম্বর যুক্ত করুন
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Vehicle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#1d4ed8] text-white flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white">
                {editingVehicle ? 'গাড়ি ও মালিক তথ্য সম্পাদনা' : 'নতুন গাড়ি ও মালিক সংযোজন'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-[#dbeafe] hover:text-white hover:bg-white/15 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 text-slate-900">
                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    গাড়ির রেজিস্ট্রেশন নম্বর *
                  </label>
                  <input
                    type="text"
                    value={regNo ?? ''}
                    onChange={(e) => setRegNo(e.target.value)}
                    placeholder="ঢাকা মেট্রো-ব-১৫-৪২০১"
                    className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
                    required
                  />
                </div>

                {/* Owner Name Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    গাড়ির মালিকের নাম *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={ownerName ?? ''}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="মালিকের পূর্ণ নাম"
                      className="w-full pl-9 pr-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
                      required
                    />
                  </div>
                </div>

                {/* Owner Mobile Number Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    মালিকের মোবাইল নম্বর (হোয়াটসঅ্যাপ রিপোর্টের জন্য)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      value={ownerPhone ?? ''}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="যেমন: 01711-000000"
                      className="w-full pl-9 pr-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs text-slate-900 font-bold font-mono outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">
                    ১১ সংখ্যার নম্বর দিলে গাড়ি ও মালিকের হিসাব সরাসরি হোয়াটসঅ্যাপে পাঠানো যাবে।
                  </p>
                </div>

                {/* Driver Name Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ড্রাইভারের নাম (ইউজার ও সুপারভাইজার তালিকা থেকে)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDriverSearch('');
                        setIsDriverPopupOpen(true);
                      }}
                      className="flex-1 px-3 py-2.5 bg-[#f8fafc] hover:bg-white border border-slate-200 hover:border-[#1d4ed8] rounded-xl text-xs font-bold flex items-center justify-between gap-2 text-left transition-all cursor-pointer focus:ring-2 focus:ring-[#1d4ed8] outline-none"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Truck className="w-4 h-4 text-[#1d4ed8] shrink-0" />
                        <span className={`truncate ${driverName ? 'text-slate-900' : 'text-slate-400 font-medium'}`}>
                          {driverName || 'পপআপ লিস্ট থেকে ড্রাইভার নির্বাচন করুন'}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                    {driverName && (
                      <button
                        type="button"
                        onClick={() => setDriverName('')}
                        className="p-2.5 bg-[#f8fafc] hover:bg-red-50 text-red-600 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                        title="ড্রাইভারের নাম মুছুন"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    সিট প্ল্যান কনফিগারেশন (Seat Capacity) *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSeatCapacity(42)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        seatCapacity === 42
                          ? 'bg-[#eff6ff] border-[#1d4ed8] text-slate-900 ring-2 ring-[#1d4ed8]/20'
                          : 'bg-[#f8fafc] border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs">৪২ সিট বাস</div>
                      <div className="text-[10px] text-slate-600">A-I (৩৬) + J (৫) + EX-1 (১)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSeatCapacity(46)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        seatCapacity === 46
                          ? 'bg-[#eff6ff] border-[#1d4ed8] text-slate-900 ring-2 ring-[#1d4ed8]/20'
                          : 'bg-[#f8fafc] border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs">৪৬ সিট বাস</div>
                      <div className="text-[10px] text-slate-600">A-J (৪০) + K (৫) + EX-1 (১)</div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-4 py-3 bg-[#eff6ff] border-t border-[#bfdbfe] flex items-center justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-[#f8fafc] border border-slate-200 text-[#1e3a8a] rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none px-5 py-2.5 min-h-[44px] bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
                >
                  {editingVehicle ? 'গাড়ির তথ্য আপডেট করুন' : 'নতুন গাড়ি সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Popup List Modal */}
      {isModalOpen && isDriverPopupOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsDriverPopupOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 flex flex-col max-h-[85dvh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-4 py-3 bg-[#1d4ed8] text-white flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Truck className="w-4 h-4 text-[#bfdbfe] shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">ড্রাইভারের তালিকা</h4>
                  <p className="text-[10px] text-[#dbeafe] truncate">
                    মোট {toBengaliDigits(drivers.length)} জন ড্রাইভার
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDriverPopupOpen(false)}
                className="p-1.5 text-[#dbeafe] hover:text-white hover:bg-white/15 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="shrink-0 p-3 border-b border-slate-200 bg-[#f8fafc]">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  placeholder="ড্রাইভারের নাম খুঁজুন..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 p-3 space-y-1.5">
              {filteredPopupDrivers.length === 0 ? (
                <div className="py-6 px-3 text-center space-y-2.5 bg-[#f8fafc] rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">
                    {drivers.length === 0
                      ? 'ইউজার ও সুপারভাইজার পেইজের ড্রাইভার তালিকায় কোনো নাম পাওয়া যায়নি।'
                      : 'খুঁজে পাওয়া যায়নি।'}
                  </p>
                  {driverSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setDriverName(driverSearch.trim());
                        setIsDriverPopupOpen(false);
                      }}
                      className="px-3 py-2 min-h-[40px] bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      "{driverSearch.trim()}" ব্যবহার করুন
                    </button>
                  )}
                </div>
              ) : (
                filteredPopupDrivers.map((d) => {
                  const isSelected = driverName.trim().toLowerCase() === d.name.trim().toLowerCase();
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setDriverName(d.name);
                        setIsDriverPopupOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#eff6ff] border-[#1d4ed8] text-slate-900 ring-1 ring-[#1d4ed8]/30'
                          : 'bg-white border-slate-200 hover:bg-[#f8fafc] hover:border-[#1d4ed8] text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-[#1d4ed8] text-white' : 'bg-[#f8fafc] text-[#1d4ed8]'
                          }`}
                        >
                          <Truck className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{d.name}</div>
                          {typeof d.totalTrips === 'number' && d.totalTrips > 0 && (
                            <div className="text-[10px] text-slate-500">
                              মোট ট্রিপ: {toBengaliDigits(d.totalTrips)} টি
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#1d4ed8] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {driverName && (
              <div className="shrink-0 px-4 py-2.5 bg-[#eff6ff] border-t border-[#bfdbfe] flex justify-between items-center pb-[max(0.625rem,env(safe-area-inset-bottom))]">
                <span className="text-[11px] text-slate-600 truncate">
                  নির্বাচিত: <strong className="text-slate-900">{driverName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDriverName('');
                    setIsDriverPopupOpen(false);
                  }}
                  className="px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer shrink-0 transition-colors"
                >
                  নির্বাচন মুছুন
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seat Map Preview Modal */}
      {previewVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#1d4ed8] text-white flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-white truncate">{previewVehicle.regNo}</h3>
                <p className="text-[11px] text-[#dbeafe] truncate">
                  মালিক: {previewVehicle.ownerName || 'সাধারণ'} | আসন সংখ্যা: {toBengaliDigits(previewVehicle.seatCapacity)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVehicle(null)}
                className="p-1.5 text-[#dbeafe] hover:text-white hover:bg-white/15 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-4">
              <SeatMap
                seatCapacity={previewVehicle.seatCapacity}
                bookedSeats={[]}
                selectedSeats={[]}
                onSeatToggle={() => {}}
                counters={[]}
                readOnly={true}
              />
            </div>

            <div className="shrink-0 px-4 py-2.5 bg-[#eff6ff] border-t border-[#bfdbfe] flex justify-end pb-[max(0.625rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setPreviewVehicle(null)}
                className="px-5 py-2 min-h-[44px] bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
