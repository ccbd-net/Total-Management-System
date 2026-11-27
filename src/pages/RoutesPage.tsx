import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { RouteItem } from '../types/index.ts';
import { formatTaka, toBengaliDigits } from '../utils/formatters.ts';
import { sortRoutesByNumber } from '../utils/routeSort.ts';
import {
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  X,
  Edit,
  Trash2,
  Navigation,
} from 'lucide-react';

export const RoutesPage: React.FC = () => {
  const { isMasterAdmin, isModerator, isMasterBookingCounter, canManageTrips, activeCompanyId, user } = useAuth();
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal State for Add & Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null);
  const [routeNumber, setRouteNumber] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [stopsText, setStopsText] = useState<string>('');
  const [direction, setDirection] = useState<'UP' | 'DOWN'>('UP');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');
  const [baseFare, setBaseFare] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await api.getRoutes();
      setRoutes(sortRoutesByNumber(res.routes || []));
    } catch (err) {
      console.error('Failed to load routes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const openAddModal = () => {
    setEditingRoute(null);
    const maxRouteNo = routes.reduce((mx, rt) => {
      const n = Number(rt.routeNumber) || 0;
      return n > mx ? n : mx;
    }, 0);
    setRouteNumber(String(maxRouteNo + 1));
    setName('');
    setOrigin('');
    setDestination('');
    setStopsText('');
    setDirection('UP');
    setBaseFare('');
    setDistanceKm('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (r: RouteItem) => {
    setEditingRoute(r);
    setRouteNumber(r.routeNumber ? String(r.routeNumber) : '');
    setName(r.name || '');
    setOrigin(r.origin || '');
    setDestination(r.destination || '');
    setStopsText(Array.isArray(r.intermediateStops) ? r.intermediateStops.join(', ') : '');
    setDirection(r.direction || 'UP');
    setBaseFare(r.baseFare ? String(r.baseFare) : '');
    setDistanceKm(r.distanceKm ? String(r.distanceKm) : '');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const intermediateStops = stopsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const routeNumVal = routeNumber.trim() && Number(routeNumber) > 0 ? Number(routeNumber) : undefined;
      const fareNum = baseFare.trim() ? Number(baseFare) : undefined;
      const distNum = distanceKm.trim() ? Number(distanceKm) : undefined;
      const finalName = name.trim() || `${origin} - ${destination}`;

      if (editingRoute) {
        await api.updateRoute(editingRoute.id, {
          routeNumber: routeNumVal,
          name: finalName,
          origin,
          destination,
          intermediateStops,
          direction,
          baseFare: fareNum,
          distanceKm: distNum,
        });
        setSuccessMsg(`রুট "${finalName}" এর তথ্য সফলভাবে আপডেট হয়েছে!`);
      } else {
        await api.createRoute({
          routeNumber: routeNumVal,
          name: finalName,
          origin,
          destination,
          intermediateStops,
          direction,
          baseFare: fareNum,
          distanceKm: distNum,
          companyId: activeCompanyId || user?.companyId,
        });
        setSuccessMsg(`নতুন রুট "${finalName}" সফলভাবে তৈরি হয়েছে!`);
      }

      setIsModalOpen(false);
      await fetchRoutes();
    } catch (err: any) {
      setErrorMsg(err.message || 'রুট সংরক্ষণ ব্যর্থ হয়েছে।');
    }
  };

  const handleDelete = async (r: RouteItem) => {
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে "${r.name}" রুটটি মুছে ফেলতে চান?`)) {
      return;
    }

    try {
      await api.deleteRoute(r.id);
      setSuccessMsg(`রুট "${r.name}" সফলভাবে মুছে ফেলা হয়েছে!`);
      await fetchRoutes();
    } catch (err: any) {
      setErrorMsg(err.message || 'রুট মোছা ব্যর্থ হয়েছে।');
    }
  };

  const filtered = routes.filter((r) => {
    if (directionFilter === 'UP' && r.direction !== 'UP') return false;
    if (directionFilter === 'DOWN' && r.direction !== 'DOWN') return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      r.origin.toLowerCase().includes(term) ||
      r.destination.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="bg-white rounded-xl border border-emerald-200 shadow-2xs overflow-hidden">
        <div className="bg-[#0b2820] px-3 py-2 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 shrink-0 text-emerald-300" />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold leading-tight truncate text-white">
                রুট ও স্টপেজ ব্যবস্থাপনা
              </h2>
              <p className="hidden sm:block text-[10px] text-emerald-200/80 leading-tight truncate">
                বাস চলাচলের প্রধান রুট, মধ্যবর্তী স্টপেজ ও কিমি দূরত্ব
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchRoutes}
              className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors cursor-pointer"
              title="রিফ্রেশ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {canManageTrips && (
              <button
                type="button"
                onClick={openAddModal}
                className="px-2.5 py-1 bg-[#0d9488] hover:bg-[#0f766e] text-white text-[11px] font-extrabold rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer border border-emerald-400/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>নতুন রুট</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar & Direction Filter Tabs */}
      <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm ?? ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="রুটের নাম, শুরুর স্থান বা গন্তব্য দিয়ে খুঁজুন..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-[#f4fbf8] border border-emerald-200 rounded-lg text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
          />
        </div>

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
            সকল ({toBengaliDigits(routes.length)})
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
            আপ রুট
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
            ডাউন রুট
          </button>
        </div>
      </div>

      {/* Route Sheet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {filtered.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-xl border border-emerald-200 shadow-2xs overflow-hidden flex flex-col justify-between"
          >
            <div>
              {/* Route Title Strip */}
              <div
                className={`${
                  r.direction === 'UP'
                    ? 'bg-[#0b2820]'
                    : r.direction === 'DOWN'
                    ? 'bg-[#0f766e]'
                    : 'bg-[#0d9488]'
                } px-3 py-1.5 text-white flex items-center justify-between gap-2`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {r.routeNumber && (
                    <span className="px-1.5 py-0.2 rounded bg-white/25 text-[10px] font-black tabular-nums shrink-0">
                      #{toBengaliDigits(r.routeNumber)}
                    </span>
                  )}
                  <h3 className="font-bold text-xs truncate">{r.name}</h3>
                </div>
                <span className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-bold shrink-0">
                  {r.direction === 'UP' ? 'আপ রুট' : r.direction === 'DOWN' ? 'ডাউন রুট' : 'উভয় দিক'}
                </span>
              </div>

              {/* Compact Route Info Rows */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-semibold min-w-0">
                    <span className="truncate">{r.origin}</span>
                    <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{r.destination}</span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    {r.distanceKm && (
                      <span className="text-[10px] text-slate-500 font-bold">
                        {toBengaliDigits(r.distanceKm)} কিমি
                      </span>
                    )}
                    {r.baseFare ? (
                      <span className="text-xs font-black text-emerald-700">{formatTaka(r.baseFare)}</span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        ট্রিপভিত্তিক
                      </span>
                    )}
                  </div>
                </div>

                {/* Intermediate Stops */}
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">
                    মধ্যবর্তী স্টপেজ:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {r.intermediateStops.length > 0 ? (
                      r.intermediateStops.map((stop, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium border border-slate-200"
                        >
                          {stop}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">নন-স্টপ (বিরতিহীন)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit / Delete Action Buttons */}
            {canManageTrips && (
              <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {isMasterBookingCounter ? 'মাষ্টার বুকিং পারমিশন' : 'এডমিন নিয়ন্ত্রণ'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(r)}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Edit className="w-3 h-3" />
                    <span>সম্পাদনা</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r)}
                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>মুছুন</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add / Edit Route Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-emerald-200 flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#0b2820] text-white flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {editingRoute ? 'রুট তথ্য সম্পাদনা' : 'নতুন রুট তৈরি করুন'}
                </h3>
                <p className="text-[11px] text-emerald-200/80 truncate">
                  ভাড়া নির্দিষ্ট নয়; শিডিউল তৈরির সময় পরিবর্তন করা যায়
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-emerald-100 hover:text-white hover:bg-white/15 rounded-lg cursor-pointer shrink-0"
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

                {/* Route Direction: UP / DOWN */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    রুটের ট্রিপ দিক (১. আপ রুট / ২. ডাউন রুট) *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection('UP')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        direction === 'UP'
                          ? 'bg-emerald-50 border-[#0d9488] text-slate-900 ring-2 ring-emerald-500/20 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">১. আপ রুট (UP)</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">মাদারীপুর ➔ ঢাকা</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('DOWN')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        direction === 'DOWN'
                          ? 'bg-emerald-50 border-[#0f766e] text-slate-900 ring-2 ring-emerald-500/20 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">২. ডাউন রুট (DOWN)</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">ঢাকা ➔ মাদারীপুর</div>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    আপ ও ডাউন রুট আলাদা থাকলে সমন্বয়ের সময় রুট জোড়া হয়ে ১টি পূর্ণাঙ্গ ট্রিপের হিসাব পাওয়া যাবে।
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      রুট নং *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={routeNumber ?? ''}
                      onChange={(e) => setRouteNumber(e.target.value)}
                      placeholder="যেমন: ১"
                      className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-bold tabular-nums outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      রুটের নাম (Route Title)
                    </label>
                    <input
                      type="text"
                      value={name ?? ''}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="মাদারীপুর - পদ্মা সেতু - সায়েদাবাদ"
                      className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      শুরুর স্থান (Origin) *
                    </label>
                    <input
                      type="text"
                      value={origin ?? ''}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="মাদারীপুর"
                      className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      গন্তব্য (Destination) *
                    </label>
                    <input
                      type="text"
                      value={destination ?? ''}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="ঢাকা (গাবতলী)"
                      className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    মধ্যবর্তী স্টপেজ সমূহ (কমা দিয়ে আলাদা করুন)
                  </label>
                  <textarea
                    rows={2}
                    value={stopsText ?? ''}
                    onChange={(e) => setStopsText(e.target.value)}
                    placeholder="ভাঙ্গা, শিবচর, পদ্মা সেতু টোলপ্লাজা, সায়েদাবাদ"
                    className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      বেস ভাড়া (৳) <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
                    </label>
                    <input
                      type="number"
                      value={baseFare ?? ''}
                      onChange={(e) => setBaseFare(e.target.value)}
                      placeholder="ট্রিপে পরিবর্তনযোগ্য"
                      className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      দূরত্ব (কিমি)
                    </label>
                    <input
                      type="number"
                      value={distanceKm ?? ''}
                      onChange={(e) => setDistanceKm(e.target.value)}
                      placeholder="যেমন: ৮৫"
                      className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-4 py-3 bg-[#f0f9f6] border-t border-emerald-200 flex items-center justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 min-h-[44px] bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{editingRoute ? 'আপডেট সংরক্ষণ' : 'রুট যুক্ত করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
