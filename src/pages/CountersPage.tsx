import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { Counter } from '../types/index.ts';
import { toBengaliDigits, formatBengaliDateTime } from '../utils/formatters.ts';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Phone,
  MapPin,
  Users,
  Palette,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  X,
  Trash2,
} from 'lucide-react';

export const CountersPage: React.FC = () => {
  const { isMasterAdmin, activeCompanyId, user } = useAuth();
  const [counters, setCounters] = useState<(Counter & { assignedUsers?: any[] })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null);
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [seatColor, setSeatColor] = useState<string>('#2563EB');
  const [counterType, setCounterType] = useState<'master_booking' | 'road_booking'>('road_booking');
  const [tripDirection, setTripDirection] = useState<'UP' | 'DOWN'>('UP');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Popular distinct bus seat colors
  const presetColors = [
    '#2563EB', // Blue
    '#059669', // Emerald
    '#D97706', // Amber
    '#7C3AED', // Purple
    '#DB2777', // Pink
    '#DC2626', // Red
    '#0891B2', // Cyan
    '#4F46E5', // Indigo
    '#EA580C', // Orange
    '#0D9488', // Teal
  ];

  const fetchCounters = async () => {
    setLoading(true);
    try {
      const res = await api.getCounters();
      setCounters(res.counters);
    } catch (err) {
      console.error('Failed to load counters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounters();
  }, []);

  const openAddModal = () => {
    setEditingCounter(null);
    setName('');
    setCode('');
    setAddress('');
    setPhone('');
    setCounterType('road_booking');
    setTripDirection('UP');
    // Pick an unused preset color if available
    const usedColors = new Set(counters.filter((c) => c.status === 'active').map((c) => c.seatColor.toUpperCase()));
    const available = presetColors.find((c) => !usedColors.has(c.toUpperCase())) || '#2563EB';
    setSeatColor(available);
    setStatus('active');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Counter) => {
    setEditingCounter(c);
    setName(c.name || '');
    setCode(c.code || '');
    setAddress(c.address || '');
    setPhone(c.phone || '');
    setSeatColor(c.seatColor || '#2563EB');
    setCounterType(c.counterType || 'road_booking');
    setTripDirection(c.tripDirection === 'DOWN' ? 'DOWN' : 'UP');
    setStatus(c.status || 'active');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (editingCounter) {
        await api.updateCounter(editingCounter.id, {
          name,
          code,
          address,
          phone,
          seatColor,
          counterType,
          tripDirection,
          status,
        });
        setSuccessMsg(`কাউন্টার "${name}" এর তথ্য সফলভাবে আপডেট হয়েছে!`);
      } else {
        await api.createCounter({
          name,
          code,
          address,
          phone,
          seatColor,
          counterType,
          tripDirection,
          companyId: activeCompanyId || user?.companyId,
        });
        setSuccessMsg(`নতুন কাউন্টার "${name}" সফলভাবে যুক্ত হয়েছে!`);
      }
      setIsModalOpen(false);
      await fetchCounters();
    } catch (err: any) {
      setErrorMsg(err.message || 'কাউন্টার সংরক্ষণ ব্যর্থ হয়েছে।');
    }
  };

  const handleDeleteCounter = async (cnt: Counter) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${cnt.name}" (${cnt.code}) কাউন্টারটি মুছে ফেলতে চান?`)) {
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.deleteCounter(cnt.id);
      setSuccessMsg(`কাউন্টার "${cnt.name}" সফলভাবে মুছে ফেলা হয়েছে!`);
      await fetchCounters();
    } catch (err: any) {
      setErrorMsg(err.message || 'কাউন্টার মুছে ফেলা ব্যর্থ হয়েছে।');
    }
  };

  const filteredCounters = counters.filter((c) => {
    if (directionFilter === 'UP' && c.tripDirection !== 'UP') return false;
    if (directionFilter === 'DOWN' && c.tripDirection !== 'DOWN') return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.code.toLowerCase().includes(term) ||
      c.address.toLowerCase().includes(term) ||
      c.phone.includes(term)
    );
  });

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="bg-white rounded-xl border border-emerald-200 shadow-2xs overflow-hidden">
        <div className="bg-[#0b2820] px-3 py-2 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 shrink-0 text-emerald-300" />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold leading-tight truncate text-white">
                কাউন্টার ব্যবস্থাপনা ও আপ/ডাউন ট্রিপ নির্ধারণ
              </h2>
              <p className="hidden sm:block text-[10px] text-emerald-200/80 leading-tight truncate">
                আপ বা ডাউন ট্রিপ ক্যাটাগরি এবং স্বতন্ত্র সিট কালার প্যালেট পরিচালনা
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchCounters}
              className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors cursor-pointer"
              title="রিফ্রেশ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {isMasterAdmin && (
              <button
                type="button"
                onClick={openAddModal}
                className="px-2.5 py-1 bg-[#0d9488] hover:bg-[#0f766e] text-white text-[11px] font-extrabold rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer border border-emerald-400/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>নতুন কাউন্টার</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Compact Search Input and Direction Filter Tabs */}
      <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm ?? ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="কাউন্টারের নাম, কোড বা অবস্থান দিয়ে অনুসন্ধান করুন..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#f4fbf8] border border-emerald-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none"
          />
        </div>

        {/* Direction Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#e6f4ef] p-0.5 rounded-lg text-[11px] font-bold border border-emerald-200 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setDirectionFilter('ALL')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex-1 sm:flex-none text-center ${
              directionFilter === 'ALL'
                ? 'bg-[#0b2820] text-white shadow-2xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            সকল ({toBengaliDigits(counters.length)})
          </button>
          <button
            type="button"
            onClick={() => setDirectionFilter('UP')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex-1 sm:flex-none text-center ${
              directionFilter === 'UP'
                ? 'bg-[#0d9488] text-white shadow-2xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            আপ কাউন্টার
          </button>
          <button
            type="button"
            onClick={() => setDirectionFilter('DOWN')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex-1 sm:flex-none text-center ${
              directionFilter === 'DOWN'
                ? 'bg-[#0f766e] text-white shadow-2xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            ডাউন কাউন্টার
          </button>
        </div>
      </div>

      {/* Counter Excel Sheet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {filteredCounters.length === 0 ? (
          <div className="col-span-full py-10 text-center bg-white rounded-xl border border-emerald-200 text-xs text-slate-500">
            কোনো কাউন্টার পাওয়া যায়নি।
          </div>
        ) : (
          filteredCounters.map((cnt) => (
            <div
              key={cnt.id}
              className="bg-white rounded-xl border border-emerald-200 shadow-2xs overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Top Strip with Counter Seat Color Swatch */}
                <div
                  className={`${
                    cnt.tripDirection === 'UP'
                      ? 'bg-[#0b2820]'
                      : cnt.tripDirection === 'DOWN'
                      ? 'bg-[#0f766e]'
                      : 'bg-[#0d9488]'
                  } px-3 py-1.5 text-white flex items-center justify-between gap-2`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-4 h-4 rounded border border-white/80 shrink-0 shadow-2xs"
                      style={{ backgroundColor: cnt.seatColor }}
                    />
                    <h3 className="font-bold text-xs truncate">{cnt.name}</h3>
                  </div>
                  <span className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-mono font-bold shrink-0">
                    {cnt.code}
                  </span>
                </div>

                {/* Excel Sheet Rows */}
                <div className="divide-y divide-slate-200 text-[11px]">
                  <div className="px-3 py-1.5 flex items-center justify-between gap-2 bg-slate-50/70">
                    <span className="font-bold text-slate-600">
                      {cnt.tripDirection === 'UP'
                        ? 'আপ ট্রিপ'
                        : cnt.tripDirection === 'DOWN'
                        ? 'ডাউন ট্রিপ'
                        : 'উভয় ট্রিপ'}{' '}
                      · {cnt.counterType === 'master_booking' ? 'মাষ্টার' : 'রোড'}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        cnt.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {cnt.status === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </span>
                  </div>

                  <div className="px-3 py-1.5 flex items-start gap-1.5 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                    <span className="line-clamp-1">{cnt.address || 'ঠিকানা দেওয়া হয়নি'}</span>
                  </div>

                  <div className="px-3 py-1.5 flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{cnt.phone || 'ফোন নেই'}</span>
                    </span>
                    <span className="font-bold text-slate-700">
                      অপারেটর: {toBengaliDigits(cnt.assignedUsers?.length || 0)} জন
                    </span>
                  </div>

                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-slate-500">সিট রঙ:</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded border border-black/20"
                        style={{ backgroundColor: cnt.seatColor }}
                      />
                      <span className="font-mono font-bold text-slate-700">{cnt.seatColor}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {isMasterAdmin && (
                <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(cnt)}
                    className="px-2 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    title="সম্পাদনা"
                  >
                    <Edit className="w-3 h-3" />
                    <span>এডিট</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCounter(cnt)}
                    className="px-2 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>ডিলিট</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Counter Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-emerald-200 flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#0b2820] text-white flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white">
                {editingCounter ? 'কাউন্টার সম্পাদনা' : 'নতুন কাউন্টার তৈরি'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-emerald-100 hover:text-white hover:bg-white/15 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 text-slate-900">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    কাউন্টারের ধরণ (Counter Category) *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCounterType('master_booking')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        counterType === 'master_booking'
                          ? 'bg-emerald-50 border-[#0d9488] text-slate-900 ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0d9488] shrink-0" />
                        <span>মাষ্টার বুকিং কাউন্টার</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1 leading-snug">
                        ট্রিপ শিডিউল তৈরি, এডিট ও ডিলিট করতে পারবে + সিট বুকিং।
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCounterType('road_booking')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        counterType === 'road_booking'
                          ? 'bg-emerald-50 border-[#0b2820] text-slate-900 ring-2 ring-emerald-600/20'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0b2820] shrink-0" />
                        <span>রোড বুকিং কাউন্টার</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1 leading-snug">
                        সাধারণ কাউন্টার; শুধুমাত্র যাত্রী ও সিট বুকিং এবং টিকিট প্রিন্ট।
                      </div>
                    </button>
                  </div>
                </div>

                {/* Trip Direction: UP / DOWN */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    কাউন্টার ট্রিপ ধরন (১. আপ কাউন্টার / ২. ডাউন কাউন্টার) *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTripDirection('UP')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        tripDirection === 'UP'
                          ? 'bg-emerald-50 border-[#0d9488] text-slate-900 ring-2 ring-emerald-500/20 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">১. আপ কাউন্টার (UP)</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">মাদারীপুর / প্রান্তিক পয়েন্ট</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTripDirection('DOWN')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        tripDirection === 'DOWN'
                          ? 'bg-emerald-50 border-[#0f766e] text-slate-900 ring-2 ring-emerald-500/20 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">২. ডাউন কাউন্টার (DOWN)</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">ঢাকা / গন্তব্য পয়েন্ট</div>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    আপ কাউন্টার কেবল আপ ট্রিপে এবং ডাউন কাউন্টার কেবল ডাউন ট্রিপে বুকিং করতে পারবে — কোনো মিশ্রণ ঘটবে না।
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    কাউন্টারের নাম *
                  </label>
                  <input
                    type="text"
                    value={name ?? ''}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="যেমন: মাদারীপুর নতুন বাস টার্মিনাল কাউন্টার"
                    className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ইউনিক কাউন্টার কোড *
                  </label>
                  <input
                    type="text"
                    value={code ?? ''}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="যেমন: MDP-01, SYD-01"
                    className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-mono font-bold uppercase outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    কাউন্টার ঠিকানা
                  </label>
                  <input
                    type="text"
                    value={address ?? ''}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="ঠিকানা ও ল্যান্ডমার্ক"
                    className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    যোগাযোগ ফোন নম্বর
                  </label>
                  <input
                    type="tel"
                    value={phone ?? ''}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="০১৭xxxxxxxx"
                    className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* Unique Seat Color Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                    <span>অনন্য সিট কালার (Seat Color Picker) *</span>
                    <span className="text-[10px] text-slate-500">প্রতিটি সক্রিয় কাউন্টারের রঙ ভিন্ন হতে হবে</span>
                  </label>

                  {/* Preset circles */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {presetColors.map((color) => {
                      const isSelected = seatColor.toUpperCase() === color.toUpperCase();
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSeatColor(color)}
                          className={`w-6 h-6 rounded-full shadow-xs transition-transform cursor-pointer ${
                            isSelected ? 'scale-125 ring-2 ring-black' : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={seatColor ?? '#2563EB'}
                      onChange={(e) => setSeatColor(e.target.value.toUpperCase())}
                      className="w-10 h-9 p-0.5 border border-emerald-200 rounded-lg cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={seatColor ?? '#2563EB'}
                      onChange={(e) => setSeatColor(e.target.value.toUpperCase())}
                      className="px-3 py-1.5 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-mono font-bold uppercase outline-none"
                      required
                    />
                  </div>
                </div>

                {editingCounter && (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">স্ট্যাটাস</label>
                    <select
                      value={status ?? 'active'}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900"
                    >
                      <option value="active">সক্রিয় (Active)</option>
                      <option value="inactive">নিষ্ক্রিয় (Inactive)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="shrink-0 px-4 py-3 bg-[#f0f9f6] border-t border-emerald-200 flex items-center justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-700 font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 min-h-[44px] bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
