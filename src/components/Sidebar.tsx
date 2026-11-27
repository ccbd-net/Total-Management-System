import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  LayoutDashboard,
  Building2,
  Bus,
  MapPin,
  Users,
  CalendarPlus,
  CalendarDays,
  Armchair,
  Printer,
  Scale,
  Settings,
  ShieldCheck,
  Layers,
  Database,
  Fuel,
  LogOut,
  KeyRound,
  X,
  Lock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'company_admin'
  | 'counters'
  | 'vehicles'
  | 'routes'
  | 'users'
  | 'schedule_maker'
  | 'daily_schedules'
  | 'seat_booking'
  | 'ticket_print'
  | 'reconciliation'
  | 'fuel_management'
  | 'database'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onCloseMobile,
}) => {
  const {
    user,
    isSuperAdmin,
    isCompanyAdmin,
    isMasterAdmin,
    isModerator,
    isMasterBookingCounter,
    isFuelManager,
    isChecker,
    canManageFuel,
    canManageTrips,
    logout,
    updateOwnCredentials,
  } = useAuth();

  // Change Own Login ID & PIN Modal State
  const [isCredModalOpen, setIsCredModalOpen] = useState<boolean>(false);
  const [currentPin, setCurrentPin] = useState<string>('');
  const [newLoginId, setNewLoginId] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmNewPin, setConfirmNewPin] = useState<string>('');
  const [credError, setCredError] = useState<string>('');
  const [credSuccess, setCredSuccess] = useState<string>('');
  const [credSubmitting, setCredSubmitting] = useState<boolean>(false);

  const openCredentialsModal = () => {
    setCurrentPin('');
    setNewLoginId(user?.loginId || '');
    setNewPin('');
    setConfirmNewPin('');
    setCredError('');
    setCredSuccess('');
    setIsCredModalOpen(true);
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError('');
    setCredSuccess('');

    if (!currentPin.trim()) {
      setCredError('যাচাইয়ের জন্য বর্তমান পিন কোড লিখুন।');
      return;
    }

    const cleanLoginId = newLoginId.trim();
    const cleanNewPin = newPin.trim();
    const cleanConfirmPin = confirmNewPin.trim();

    if (!cleanLoginId && !cleanNewPin) {
      setCredError('পরিবর্তনের জন্য নতুন লগইন আইডি অথবা নতুন পিন দিন।');
      return;
    }

    if (cleanLoginId && (cleanLoginId.length < 3 || /\s/.test(cleanLoginId))) {
      setCredError('লগইন আইডি কমপক্ষে ৩ অক্ষরের হতে হবে এবং কোনো স্পেস থাকা যাবে না।');
      return;
    }

    if (cleanNewPin) {
      if (cleanNewPin.length < 4 || cleanNewPin.length > 6) {
        setCredError('নতুন পিন কোড অবশ্যই ৪ থেকে ৬ ডিজিটের হতে হবে।');
        return;
      }
      if (cleanNewPin !== cleanConfirmPin) {
        setCredError('নতুন পিন এবং কনফার্ম পিন একরকম হয়নি!');
        return;
      }
    }

    setCredSubmitting(true);
    try {
      const res = await updateOwnCredentials({
        currentPin: currentPin.trim(),
        newLoginId: cleanLoginId && cleanLoginId !== user?.loginId ? cleanLoginId : undefined,
        newPin: cleanNewPin || undefined,
      });
      setCredSuccess(res.message || 'লগইন আইডি ও পিন সফলভাবে পরিবর্তন হয়েছে!');
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
    } catch (err: any) {
      setCredError(err.message || 'লগইন তথ্য পরিবর্তন করা যায়নি।');
    } finally {
      setCredSubmitting(false);
    }
  };

  type NavItem = {
    id: NavTab;
    label: string;
    icon: React.ElementType;
    group: 'operations' | 'trips' | 'management';
    badge?: string;
    adminOnly?: boolean;
    superAdminOnly?: boolean;
    modOnly?: boolean;
    fuelOnly?: boolean;
    tripManagerOnly?: boolean;
    hideForFuelManager?: boolean;
  };

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard, group: 'operations' },
    { id: 'company_admin', label: 'কোম্পানি ও সাবস্ক্রিপশন', icon: Building2, group: 'operations', superAdminOnly: true, badge: 'সুপার' },
    { id: 'seat_booking', label: 'সিট বুকিং', icon: Armchair, group: 'operations', badge: 'লাইভ', hideForFuelManager: true },
    { id: 'ticket_print', label: 'টিকিট প্রিন্ট', icon: Printer, group: 'operations', hideForFuelManager: true },
    { id: 'daily_schedules', label: 'দৈনিক ট্রিপ ও ফিরতি লগ', icon: CalendarDays, group: 'trips', badge: 'ট্রিপ' },
    { id: 'schedule_maker', label: 'শিডিউল মেকার', icon: CalendarPlus, group: 'trips', tripManagerOnly: true },
    { id: 'reconciliation', label: 'ট্রিপ হিসাব সমন্বয়', icon: Scale, group: 'trips', modOnly: true },
    { id: 'fuel_management', label: 'ফুয়েল লগ', icon: Fuel, group: 'trips', fuelOnly: true },
    { id: 'counters', label: 'কাউন্টার ব্যবস্থাপনা', icon: Layers, group: 'management', modOnly: true },
    { id: 'vehicles', label: 'গাড়ি ব্যবস্থাপনা', icon: Bus, group: 'management', modOnly: true },
    { id: 'routes', label: 'রুট ব্যবস্থাপনা', icon: MapPin, group: 'management', tripManagerOnly: true },
    { id: 'users', label: 'ইউজার ও সুপারভাইজার', icon: Users, group: 'management', modOnly: true },
    { id: 'database', label: 'ডাটাবেইজ', icon: Database, group: 'management', badge: 'রেকর্ড' },
    { id: 'settings', label: 'সিস্টেম সেটিংস', icon: Settings, group: 'management', adminOnly: true },
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.adminOnly && !isMasterAdmin) return false;
    if (item.tripManagerOnly && !canManageTrips) return false;
    if (item.fuelOnly && !canManageFuel) return false;
    if (item.modOnly && !isModerator) return false;
    if (item.hideForFuelManager && isFuelManager) return false;
    return true;
  });

  const groups: Array<{ key: NavItem['group']; title: string }> = [
    { key: 'operations', title: 'অপারেশন ও টিকেটিং' },
    { key: 'trips', title: 'শিডিউল ও হিসাব' },
    { key: 'management', title: 'ব্যবস্থাপনা ও ডাটাবেইজ' },
  ];

  const companyLogo = user?.company?.logoUrl;
  const displayName = user?.company?.name || 'Vehicles Management System';
  const roleLabel = isSuperAdmin
    ? 'সুপার এডমিন'
    : isCompanyAdmin || user?.role === 'master_admin'
    ? 'মাস্টার এডমিন'
    : user?.role === 'moderator'
    ? 'ম্যানেজার'
    : isFuelManager
    ? 'ফুয়েল ম্যানেজার'
    : isChecker
    ? 'চেকার'
    : isMasterBookingCounter
    ? 'মাষ্টার কাউন্টার'
    : 'কাউন্টার';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/55 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Deep Forest-Green Sidebar Container (#0B2820 with crisp white text) */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 shrink-0 bg-[#0b2820] text-white flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } border-r border-[#164236] shadow-2xl lg:shadow-none`}
      >
        {/* Brand Header */}
        <div className="px-3.5 py-3 border-b border-[#164236] bg-[#071d17] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={companyLogo || '/assets/aistudio/1795651588938_2_f0f59799.jpg'}
              alt={displayName}
              className="w-9 h-9 rounded-xl object-cover shadow-xs border border-emerald-500/40 shrink-0 bg-[#0b2820]"
            />
            <div className="min-w-0">
              <div className="font-extrabold text-white text-xs leading-tight tracking-wide truncate">
                {displayName}
              </div>
              <div className="text-[10px] font-semibold text-emerald-300 leading-tight mt-0.5 truncate">
                Data&Code Management
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-[#133b30] cursor-pointer shrink-0"
            aria-label="মেনু বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grouped Navigation List inside Deep Forest Green */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {groups.map((grp) => {
            const groupItems = filteredNavItems.filter((item) => item.group === grp.key);
            if (groupItems.length === 0) return null;
            return (
              <div key={grp.key} className="space-y-1">
                <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300/75">
                  {grp.title}
                </div>
                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(item.id);
                          onCloseMobile();
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11.5px] font-semibold transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#0d9488] text-white shadow-sm font-bold'
                            : 'text-white/90 hover:bg-[#133b30] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-white' : 'text-emerald-300'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-[#133b30] text-emerald-200 border border-emerald-700/60'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom Login Status, Credentials & Logout Panel */}
        <div className="mt-auto border-t border-[#164236] bg-[#071d17] p-2.5 space-y-2 shrink-0">
          {/* Active Logged-in User Info */}
          <div className="flex items-center gap-2 bg-[#0f3329] border border-[#1d5243] rounded-lg p-2">
            <div className="w-7 h-7 rounded-lg bg-[#0d9488] text-white font-black flex items-center justify-center text-xs shrink-0">
              {user?.name?.slice(0, 1) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-white truncate">
                {user?.counterName || user?.name}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[10px] text-emerald-200 font-medium truncate">
                  {roleLabel} • লগইন সচল
                </span>
              </div>
            </div>
          </div>

          {/* Credentials & Logout Action Row */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={openCredentialsModal}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-[#133b30] hover:bg-[#194d3f] text-white border border-[#1f5949] text-[11px] font-bold transition-colors cursor-pointer"
              title="নিজস্ব লগইন আইডি ও পিন পরিবর্তন করুন"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>আইডি ও পিন</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-rose-900/60 hover:bg-rose-700 text-rose-100 hover:text-white border border-rose-700/60 text-[11px] font-bold transition-colors cursor-pointer"
              title="লগআউট করুন"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>লগআউট</span>
            </button>
          </div>

          <div className="pt-0.5 text-[10px] text-emerald-300/80 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>সিস্টেম সচল</span>
            </div>
            <span className="font-mono">Asia/Dhaka</span>
          </div>
        </div>
      </aside>

      {/* Self-Service Login ID & PIN Change Modal (Mobile-Safe Sticky Footer) */}
      {isCredModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="self-credentials-title"
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-emerald-200 flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#0b2820] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#0d9488] text-white flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 id="self-credentials-title" className="font-bold text-sm truncate">
                    নিজস্ব লগইন আইডি ও পিন পরিবর্তন
                  </h3>
                  <div className="text-[11px] text-emerald-200 truncate">{user?.name}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !credSubmitting && setIsCredModalOpen(false)}
                disabled={credSubmitting}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-emerald-200 hover:text-white rounded-lg hover:bg-[#133b30] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 text-slate-900">
                {credSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{credSuccess}</span>
                  </div>
                )}

                {credError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{credError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    বর্তমান পিন কোড *
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    placeholder="আপনার বর্তমান পিন দিন"
                    className="w-full px-3 py-2.5 bg-[#f0f9f6] border border-emerald-300 rounded-xl text-xs font-mono font-bold tracking-widest text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#0d9488]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    নতুন লগইন আইডি (Login ID)
                  </label>
                  <input
                    type="text"
                    value={newLoginId}
                    onChange={(e) => setNewLoginId(e.target.value.replace(/\s+/g, ''))}
                    placeholder="আপনার নতুন ইউনিক লগইন আইডি"
                    className="w-full px-3 py-2.5 bg-[#f0f9f6] border border-emerald-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#0d9488]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      নতুন পিন (৪-৬ ডিজিট)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="পরিবর্তন করতে চাইলে"
                      className="w-full px-3 py-2.5 bg-[#f0f9f6] border border-emerald-300 rounded-xl text-xs font-mono font-bold tracking-widest text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#0d9488]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      নতুন পিন নিশ্চিত করুন
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value)}
                      placeholder="পুনরায় পিন লিখুন"
                      className="w-full px-3 py-2.5 bg-[#f0f9f6] border border-emerald-300 rounded-xl text-xs font-mono font-bold tracking-widest text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#0d9488]"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-slate-700 leading-relaxed">
                  গোপনীয়তা নিশ্চিত: আপনার পরিবর্তিত লগইন আইডি ও পিন সম্পূর্ণ এনক্রিপ্টেড অবস্থায় সংরক্ষিত থাকে এবং অন্য কেউ এটি দেখতে পায় না।
                </div>
              </div>

              <div className="shrink-0 px-4 py-3 bg-[#f0f9f6] border-t border-emerald-200 flex items-center justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsCredModalOpen(false)}
                  disabled={credSubmitting}
                  className="min-h-[44px] px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বন্ধ করুন
                </button>
                <button
                  type="submit"
                  disabled={credSubmitting}
                  className="min-h-[44px] px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{credSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'আইডি ও পিন সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
