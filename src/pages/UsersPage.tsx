import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { User, Counter, Supervisor, Driver } from '../types/index.ts';
import { toBengaliDigits, formatBengaliDateTime } from '../utils/formatters.ts';
import {
  Users,
  Plus,
  Search,
  KeyRound,
  Shield,
  Phone,
  Building2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  X,
  Edit,
  Trash2,
  UserCheck,
  Briefcase,
  UserCog,
  Truck,
  Lock,
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user: currentUser, isMasterAdmin, activeCompanyId } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'supervisors' | 'drivers'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loginId, setLoginId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<User['role']>('booking_point');
  const [counterId, setCounterId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Supervisor Modal & Quick-Add State (Name only, comma-separated supported)
  const [isSupModalOpen, setIsSupModalOpen] = useState<boolean>(false);
  const [editingSup, setEditingSup] = useState<Supervisor | null>(null);
  const [supName, setSupName] = useState<string>('');
  const [quickSupNames, setQuickSupNames] = useState<string>('');
  const [supSubmitting, setSupSubmitting] = useState<boolean>(false);

  // Driver Modal & Quick-Add State (Name only, comma-separated supported)
  const [isDriverModalOpen, setIsDriverModalOpen] = useState<boolean>(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverName, setDriverName] = useState<string>('');
  const [quickDriverNames, setQuickDriverNames] = useState<string>('');
  const [driverSubmitting, setDriverSubmitting] = useState<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'user' | 'supervisor' | 'driver';
    id: string;
    name: string;
  } | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, cRes, sRes, dRes] = await Promise.all([
        api.getUsers(),
        api.getCounters(),
        api.getSupervisors(),
        api.getDrivers(),
      ]);
      setUsers(uRes.users);
      setCounters(cRes.counters);
      setSupervisors(sRes.supervisors);
      setDrivers(dRes.drivers || []);
    } catch (err) {
      console.error('Failed to load user, supervisor and driver data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // USER CRUD
  const openAddUserModal = () => {
    setEditingUser(null);
    setLoginId('');
    setName('');
    setRole('booking_point');
    setCounterId(counters[0]?.id || '');
    setPhone('');
    setPin('');
    setStatus('active');
    setErrorMsg('');
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    setLoginId(u.loginId ?? '');
    setName(u.name ?? '');
    setRole(u.role || 'booking_point');
    setCounterId(u.counterId ?? '');
    setPhone(u.phone ?? '');
    setPin('');
    setStatus(u.status || 'active');
    setErrorMsg('');
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name,
          role,
          counterId: role === 'booking_point' ? counterId : null,
          phone,
          status,
          pin: pin.trim() ? pin.trim() : undefined,
        });
        setSuccessMsg(`ব্যবহারকারী "${name}" এর তথ্য সফলভাবে আপডেট হয়েছে!`);
      } else {
        if (!pin.trim() || pin.trim().length < 4 || pin.trim().length > 6) {
          setErrorMsg('নতুন ব্যবহারকারীর জন্য ৪-৬ ডিজিট পিন কোড আবশ্যক!');
          return;
        }
        await api.createUser({
          loginId,
          name,
          role,
          counterId: role === 'booking_point' ? counterId : undefined,
          phone,
          pin,
          companyId: activeCompanyId || currentUser?.companyId,
        });
        setSuccessMsg(`নতুন ব্যবহারকারী "${name}" সফলভাবে তৈরি হয়েছে!`);
      }
      setIsUserModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'ব্যবহারকারী সংরক্ষণ ব্যর্থ হয়েছে।');
    }
  };

  const handleDeleteUser = (u: User) => {
    if (u.id === currentUser?.id) {
      setErrorMsg('আপনি নিজের একাউন্ট ডিলিট করতে পারবেন না!');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setDeleteConfirmTarget({ type: 'user', id: u.id, name: u.name });
  };

  // SUPERVISOR CRUD (NAME ONLY - Comma-separated bulk add supported)
  const parseCommaNames = (raw: string): string[] =>
    raw
      .split(/[,،\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const openAddSupModal = () => {
    setEditingSup(null);
    setSupName('');
    setErrorMsg('');
    setIsSupModalOpen(true);
  };

  const openEditSupModal = (s: Supervisor) => {
    setEditingSup(s);
    setSupName(s.name ?? '');
    setErrorMsg('');
    setIsSupModalOpen(true);
  };

  const handleSaveSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!supName.trim()) {
      setErrorMsg('সুপারভাইজারের নাম আবশ্যক!');
      return;
    }

    setSupSubmitting(true);
    try {
      if (editingSup) {
        await api.updateSupervisor(editingSup.id, {
          name: supName.trim(),
        });
        setSuccessMsg(`সুপারভাইজার "${supName.trim()}" এর নাম আপডেট হয়েছে!`);
      } else {
        const res = await api.createSupervisor({
          name: supName.trim(),
          companyId: activeCompanyId || currentUser?.companyId,
        });
        const count = res.createdCount || res.supervisors?.length || 1;
        setSuccessMsg(
          count > 1
            ? `একসাথে ${toBengaliDigits(count)} জন সুপারভাইজার সফলভাবে যুক্ত হয়েছে!`
            : `নতুন সুপারভাইজার "${res.supervisor?.name || supName.trim()}" তালিকায় যুক্ত হয়েছে!`
        );
      }
      setIsSupModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'সুপারভাইজার সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSupSubmitting(false);
    }
  };

  const handleQuickAddSupervisors = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!quickSupNames.trim()) return;

    setSupSubmitting(true);
    try {
      const res = await api.createSupervisor({
        name: quickSupNames.trim(),
        companyId: activeCompanyId || currentUser?.companyId,
      });
      const count = res.createdCount || res.supervisors?.length || 1;
      setQuickSupNames('');
      setSuccessMsg(
        count > 1
          ? `একসাথে ${toBengaliDigits(count)} জন সুপারভাইজার সফলভাবে যুক্ত হয়েছে!`
          : `নতুন সুপারভাইজার "${res.supervisor?.name || ''}" তালিকায় যুক্ত হয়েছে!`
      );
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'সুপারভাইজার সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSupSubmitting(false);
    }
  };

  const handleDeleteSupervisor = (s: Supervisor) => {
    setErrorMsg('');
    setSuccessMsg('');
    setDeleteConfirmTarget({ type: 'supervisor', id: s.id, name: s.name });
  };

  // DRIVER CRUD (NAME ONLY - Comma-separated bulk add supported)
  const openAddDriverModal = () => {
    setEditingDriver(null);
    setDriverName('');
    setErrorMsg('');
    setIsDriverModalOpen(true);
  };

  const openEditDriverModal = (d: Driver) => {
    setEditingDriver(d);
    setDriverName(d.name ?? '');
    setErrorMsg('');
    setIsDriverModalOpen(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!driverName.trim()) {
      setErrorMsg('ড্রাইভারের নাম আবশ্যক!');
      return;
    }

    setDriverSubmitting(true);
    try {
      if (editingDriver) {
        await api.updateDriver(editingDriver.id, {
          name: driverName.trim(),
        });
        setSuccessMsg(`ড্রাইভার "${driverName.trim()}" এর নাম আপডেট হয়েছে!`);
      } else {
        const res = await api.createDriver({
          name: driverName.trim(),
          companyId: activeCompanyId || currentUser?.companyId,
        });
        const count = res.createdCount || res.drivers?.length || 1;
        setSuccessMsg(
          count > 1
            ? `একসাথে ${toBengaliDigits(count)} জন ড্রাইভার সফলভাবে যুক্ত হয়েছে!`
            : `নতুন ড্রাইভার "${res.driver?.name || driverName.trim()}" তালিকায় যুক্ত হয়েছে!`
        );
      }
      setIsDriverModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'ড্রাইভার সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setDriverSubmitting(false);
    }
  };

  const handleQuickAddDrivers = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!quickDriverNames.trim()) return;

    setDriverSubmitting(true);
    try {
      const res = await api.createDriver({
        name: quickDriverNames.trim(),
        companyId: activeCompanyId || currentUser?.companyId,
      });
      const count = res.createdCount || res.drivers?.length || 1;
      setQuickDriverNames('');
      setSuccessMsg(
        count > 1
          ? `একসাথে ${toBengaliDigits(count)} জন ড্রাইভার সফলভাবে যুক্ত হয়েছে!`
          : `নতুন ড্রাইভার "${res.driver?.name || ''}" তালিকায় যুক্ত হয়েছে!`
      );
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'ড্রাইভার সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setDriverSubmitting(false);
    }
  };

  const handleDeleteDriver = (d: Driver) => {
    setErrorMsg('');
    setSuccessMsg('');
    setDeleteConfirmTarget({ type: 'driver', id: d.id, name: d.name });
  };

  const confirmDeleteTargetAction = async () => {
    if (!deleteConfirmTarget) return;
    setDeletingTarget(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (deleteConfirmTarget.type === 'user') {
        await api.deleteUser(deleteConfirmTarget.id);
        setSuccessMsg(`ব্যবহারকারী "${deleteConfirmTarget.name}" সফলভাবে মুছে ফেলা হয়েছে!`);
      } else if (deleteConfirmTarget.type === 'supervisor') {
        await api.deleteSupervisor(deleteConfirmTarget.id);
        setSuccessMsg(`সুপারভাইজার "${deleteConfirmTarget.name}" সফলভাবে মুছে ফেলা হয়েছে!`);
      } else {
        await api.deleteDriver(deleteConfirmTarget.id);
        setSuccessMsg(`ড্রাইভার "${deleteConfirmTarget.name}" সফলভাবে মুছে ফেলা হয়েছে!`);
      }
      setDeleteConfirmTarget(null);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'তথ্য মুছে ফেলা ব্যর্থ হয়েছে।');
    } finally {
      setDeletingTarget(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const visibleLoginId = u.isCredentialHidden ? '' : (u.loginId || '').toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      visibleLoginId.includes(term) ||
      (u.counterName && u.counterName.toLowerCase().includes(term))
    );
  });

  const filteredSupervisors = supervisors.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term);
  });

  const filteredDrivers = drivers.filter((d) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return d.name.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="bg-white rounded-xl border border-emerald-200 shadow-2xs overflow-hidden">
        <div className="bg-[#0b2820] px-3 py-2 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 shrink-0 text-emerald-300" />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold leading-tight truncate text-white">
                ইউজার, সুপারভাইজার ও ড্রাইভার ব্যবস্থাপনা
              </h2>
              <p className="hidden sm:block text-[10px] text-emerald-200/80 leading-tight truncate">
                লগইন অপারেটর, সুপারভাইজার ও ড্রাইভারদের তালিকা পরিচালনা
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchData}
              className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors cursor-pointer"
              title="রিফ্রেশ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {isMasterAdmin && (
              activeTab === 'users' ? (
                <button
                  type="button"
                  onClick={openAddUserModal}
                  className="px-2.5 py-1 bg-[#0d9488] hover:bg-[#0f766e] text-white text-[11px] font-extrabold rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer border border-emerald-400/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন ইউজার</span>
                </button>
              ) : activeTab === 'supervisors' ? (
                <button
                  type="button"
                  onClick={openAddSupModal}
                  className="px-2.5 py-1 bg-[#0d9488] hover:bg-[#0f766e] text-white text-[11px] font-extrabold rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer border border-emerald-400/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন সুপারভাইজার</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openAddDriverModal}
                  className="px-2.5 py-1 bg-[#0d9488] hover:bg-[#0f766e] text-white text-[11px] font-extrabold rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer border border-emerald-400/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন ড্রাইভার</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Compact Excel Tabs */}
      <div className="bg-white p-1.5 rounded-xl border border-emerald-200 shadow-2xs flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'users'
              ? 'bg-[#0b2820] text-white shadow-2xs'
              : 'bg-[#e6f4ef] text-slate-700 hover:text-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>অপারেটর ({toBengaliDigits(users.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('supervisors')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'supervisors'
              ? 'bg-[#0d9488] text-white shadow-2xs'
              : 'bg-[#e6f4ef] text-slate-700 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>সুপারভাইজার ({toBengaliDigits(supervisors.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drivers')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'drivers'
              ? 'bg-[#0f766e] text-white shadow-2xs'
              : 'bg-[#e6f4ef] text-slate-700 hover:text-slate-900'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>ড্রাইভার ({toBengaliDigits(drivers.length)})</span>
        </button>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm ?? ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === 'users'
                ? 'ব্যবহারকারীর নাম, লগইন আইডি বা কাউন্টার খুঁজুন...'
                : activeTab === 'supervisors'
                ? 'সুপারভাইজারের নাম খুঁজুন...'
                : 'ড্রাইভারের নাম খুঁজুন...'
            }
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-violet-500 focus:bg-white outline-none"
          />
        </div>
      </div>

      {/* TAB 1: USERS TABLE */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-emerald-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0b2820] text-white font-bold text-[11px]">
                  <th className="py-3 px-4">ব্যবহারকারী</th>
                  <th className="py-3 px-4">লগইন আইডি</th>
                  <th className="py-3 px-4">ভূমিকা (Role)</th>
                  <th className="py-3 px-4">নিযুক্ত কাউন্টার</th>
                  <th className="py-3 px-4">মোবাইল</th>
                  <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                  {isMasterAdmin && <th className="py-3 px-4 text-right">একশন</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      কোনো ব্যবহারকারী পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          তৈরি: {formatBengaliDateTime(u.createdAt)}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {u.isCredentialHidden || u.loginId === '••••••••' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-sans font-bold">
                            <Lock className="w-3 h-3" />
                            <span>গোপন (সুরক্ষিত)</span>
                          </span>
                        ) : (
                          u.loginId
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'master_admin'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'super_admin'
                              ? 'bg-rose-100 text-rose-800'
                              : u.role === 'moderator'
                              ? 'bg-blue-100 text-blue-800'
                              : u.role === 'fuel_manager'
                              ? 'bg-amber-100 text-amber-800'
                              : u.role === 'checker'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {u.role === 'master_admin'
                            ? 'মাস্টার এডমিন'
                            : u.role === 'super_admin'
                            ? 'সুপার এডমিন'
                            : u.role === 'company_admin'
                            ? 'মাস্টার এডমিন'
                            : u.role === 'moderator'
                            ? 'মডারেটর'
                            : u.role === 'fuel_manager'
                            ? 'ফুয়েল ম্যানেজার'
                            : u.role === 'checker'
                            ? 'চেকার'
                            : 'কাউন্টার অপারেটর'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {u.counterName ? (
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <span
                              className="w-2.5 h-2.5 rounded-full shadow-2xs"
                              style={{ backgroundColor: u.counterColor || '#2563EB' }}
                            />
                            <span>{u.counterName}</span>
                            <span className="text-[10px] text-slate-400">({u.counterCode})</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">সকল কাউন্টার / কেন্দ্রীয়</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600">
                        {u.phone || 'ফোন নেই'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {u.status === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                        </span>
                      </td>

                      {isMasterAdmin && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditUserModal(u)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors font-semibold"
                              title="সম্পাদনা ও পিন পরিবর্তন"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SUPERVISORS DIRECTORY (NAME ONLY - BULK COMMA ADD) */}
      {activeTab === 'supervisors' && (
        <div className="space-y-4">
          {isMasterAdmin && (
            <form
              onSubmit={handleQuickAddSupervisors}
              className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>একসাথে কমা (,) দিয়ে একাধিক সুপারভাইজারের নাম যুক্ত করুন</span>
                </label>
                {quickSupNames.trim() && (
                  <span className="text-[11px] font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded-full border border-blue-200">
                    {toBengaliDigits(parseCommaNames(quickSupNames).length)} টি নাম পাওয়া গেছে
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={quickSupNames}
                  onChange={(e) => setQuickSupNames(e.target.value)}
                  placeholder="যেমন: কানন, সবুজ, সিরাজ, রফিক, মামুন"
                  className="flex-1 px-3.5 py-2.5 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={supSubmitting || parseCommaNames(quickSupNames).length === 0}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{supSubmitting ? 'যুক্ত হচ্ছে...' : 'নাম যুক্ত করুন'}</span>
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-[#0b2820] text-white font-bold text-[11px]">
                    <th className="py-2 px-3 border-r border-white/25 text-center w-20">ক্রম</th>
                    <th className="py-2 px-4 border-r border-white/25">সুপারভাইজারের নাম</th>
                    <th className="py-2 px-3 border-r border-white/25 text-center w-44">
                      মোট পূর্ণাঙ্গ ট্রিপ
                    </th>
                    {isMasterAdmin && <th className="py-2 px-3 text-right w-24">একশন</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {filteredSupervisors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 border border-slate-300">
                        কোনো সুপারভাইজার পাওয়া যায়নি। কমা দিয়ে নাম লিখে অথবা "+ নতুন সুপারভাইজার যোগ করুন" বাটনে ক্লিক করে যুক্ত করুন।
                      </td>
                    </tr>
                  ) : (
                    filteredSupervisors.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-700 tabular-nums">
                          #{toBengaliDigits(idx + 1)}
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-200">
                          <div className="font-bold text-slate-900">{s.name}</div>
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center bg-blue-50/20 font-bold">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-200 tabular-nums">
                            {toBengaliDigits(s.totalTrips || 0)} টি ট্রিপ
                          </span>
                        </td>
                        {isMasterAdmin && (
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditSupModal(s)}
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-semibold cursor-pointer"
                                title="নাম সম্পাদনা"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSupervisor(s)}
                                className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors font-semibold cursor-pointer"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DRIVERS DIRECTORY (NAME ONLY - BULK COMMA ADD) */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          {isMasterAdmin && (
            <form
              onSubmit={handleQuickAddDrivers}
              className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  <span>একসাথে কমা (,) দিয়ে একাধিক ড্রাইভারের নাম যুক্ত করুন</span>
                </label>
                {quickDriverNames.trim() && (
                  <span className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {toBengaliDigits(parseCommaNames(quickDriverNames).length)} টি নাম পাওয়া গেছে
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={quickDriverNames}
                  onChange={(e) => setQuickDriverNames(e.target.value)}
                  placeholder="যেমন: জামাল, আনু, ফটিক, কুদ্দুস, আল আমিন"
                  className="flex-1 px-3.5 py-2.5 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={driverSubmitting || parseCommaNames(quickDriverNames).length === 0}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{driverSubmitting ? 'যুক্ত হচ্ছে...' : 'নাম যুক্ত করুন'}</span>
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-[#0b2820] text-white font-bold text-[11px]">
                    <th className="py-2 px-3 border-r border-white/25 text-center w-20">ক্রম</th>
                    <th className="py-2 px-4 border-r border-white/25">ড্রাইভারের নাম</th>
                    <th className="py-2 px-3 border-r border-white/25 text-center w-44">
                      মোট পূর্ণাঙ্গ ট্রিপ
                    </th>
                    {isMasterAdmin && <th className="py-2 px-3 text-right w-24">একশন</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {filteredDrivers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 border border-slate-300">
                        কোনো ড্রাইভার পাওয়া যায়নি। কমা দিয়ে নাম লিখে অথবা "+ নতুন ড্রাইভার যোগ করুন" বাটনে ক্লিক করে যুক্ত করুন।
                      </td>
                    </tr>
                  ) : (
                    filteredDrivers.map((d, idx) => (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-700 tabular-nums">
                          #{toBengaliDigits(idx + 1)}
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-200">
                          <div className="font-bold text-slate-900">{d.name}</div>
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center bg-indigo-50/20 font-bold">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-900 border border-indigo-200 tabular-nums">
                            {toBengaliDigits(d.totalTrips || 0)} টি ট্রিপ
                          </span>
                        </td>
                        {isMasterAdmin && (
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditDriverModal(d)}
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-semibold cursor-pointer"
                                title="নাম সম্পাদনা"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDriver(d)}
                                className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors font-semibold cursor-pointer"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-emerald-200 flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#0b2820] text-white flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white">
                {editingUser ? 'ইউজার ও পিন সম্পাদনা' : 'নতুন ইউজার তৈরি করুন'}
              </h3>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 text-emerald-100 hover:text-white hover:bg-white/15 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 text-slate-900">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {!editingUser && (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      লগইন আইডি (ইউনিক) *
                    </label>
                    <input
                      type="text"
                      value={loginId ?? ''}
                      onChange={(e) => setLoginId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="e.g. counter01, mod02"
                      className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ব্যবহারকারীর পূর্ণ নাম *
                  </label>
                  <input
                    type="text"
                    value={name ?? ''}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. মোঃ করিম হোসেন"
                    className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">ভূমিকা (Role) *</label>
                  <select
                    value={role ?? 'booking_point'}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-bold focus:bg-white outline-none"
                  >
                    <option value="booking_point">কাউন্টার বুকিং পয়েন্ট (Booking Operator)</option>
                    <option value="fuel_manager">ফুয়েল ম্যানেজার (Fuel Manager)</option>
                    <option value="checker">চেকার (Checker)</option>
                    <option value="moderator">মডারেটর / অপারেশন ম্যানেজার (Moderator)</option>
                    <option value="master_admin">মাস্টার এডমিন (Master Admin)</option>
                  </select>
                </div>

                {role === 'booking_point' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      নির্ধারিত কাউন্টার নির্বাচন *
                    </label>
                    <select
                      value={counterId ?? ''}
                      onChange={(e) => setCounterId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-bold focus:bg-white outline-none"
                      required
                    >
                      <option value="">-- কাউন্টার সিলেক্ট করুন --</option>
                      {counters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code}) — {c.counterType === 'master_booking' ? 'মাষ্টার কাউন্টার' : 'রোড কাউন্টার'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">মোবাইল ফোন নম্বর</label>
                  <input
                    type="tel"
                    value={phone ?? ''}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {editingUser ? 'নতুন পিন কোড (পরিবর্তন করতে চাইলে)' : 'লগইন পিন (৪-৬ ডিজিট) *'}
                  </label>
                  <input
                    type="password"
                    value={pin ?? ''}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={editingUser ? 'পিন অপরিবর্তিত রাখতে খালি রাখুন' : '৪ থেকে ৬ সংখ্যার পিন'}
                    className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-mono tracking-widest text-center font-bold focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                    required={!editingUser}
                  />
                </div>

                {editingUser && (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">স্ট্যাটাস</label>
                    <select
                      value={status ?? 'active'}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-bold focus:bg-white outline-none"
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
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none px-5 py-2.5 min-h-[44px] bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {editingUser ? 'তথ্য আপডেট করুন' : 'নতুন ব্যবহারকারী তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Supervisor Modal (NAME ONLY, comma-separated bulk supported) */}
      {isSupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-emerald-200 flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#0b2820] text-white flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white">
                {editingSup ? 'সুপারভাইজারের নাম সম্পাদনা' : 'নতুন সুপারভাইজার যোগ করুন'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSupModalOpen(false)}
                className="p-1.5 text-emerald-100 hover:text-white hover:bg-white/15 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupervisor} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 text-slate-900">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {editingSup ? 'সুপারভাইজারের নাম *' : 'সুপারভাইজারের নাম (কমা দিয়ে একাধিক নাম লিখুন) *'}
                  </label>
                  {editingSup ? (
                    <input
                      type="text"
                      value={supName ?? ''}
                      onChange={(e) => setSupName(e.target.value)}
                      placeholder="যেমন: মোঃ কানন"
                      className="w-full px-3.5 py-2.5 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                      required
                    />
                  ) : (
                    <textarea
                      rows={3}
                      value={supName ?? ''}
                      onChange={(e) => setSupName(e.target.value)}
                      placeholder="যেমন: মোঃ কানন, সবুজ, সিরাজ, রফিক"
                      className="w-full px-3.5 py-2.5 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none resize-none"
                      required
                    />
                  )}
                </div>

                {!editingSup && parseCommaNames(supName).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[11px] font-bold text-emerald-950 w-full">
                      মোট {toBengaliDigits(parseCommaNames(supName).length)} জন যুক্ত হবে:
                    </span>
                    {parseCommaNames(supName).map((n, i) => (
                      <span
                        key={`${n}-${i}`}
                        className="px-2 py-0.5 bg-white text-emerald-900 border border-emerald-200 rounded-md text-[11px] font-bold"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0 px-4 py-3 bg-[#f0f9f6] border-t border-emerald-200 flex items-center justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsSupModalOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={supSubmitting}
                  className="flex-1 sm:flex-none px-5 py-2.5 min-h-[44px] bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {supSubmitting
                    ? 'সংরক্ষণ হচ্ছে...'
                    : editingSup
                    ? 'নাম আপডেট করুন'
                    : 'তালিকায় যুক্ত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Driver Modal (NAME ONLY, comma-separated bulk supported) */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-emerald-200 flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#0b2820] text-white flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white">
                {editingDriver ? 'ড্রাইভারের নাম সম্পাদনা' : 'নতুন ড্রাইভার যোগ করুন'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDriverModalOpen(false)}
                className="p-1.5 text-emerald-100 hover:text-white hover:bg-white/15 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 text-slate-900">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {editingDriver ? 'ড্রাইভারের নাম *' : 'ড্রাইভারের নাম (কমা দিয়ে একাধিক নাম লিখুন) *'}
                  </label>
                  {editingDriver ? (
                    <input
                      type="text"
                      value={driverName ?? ''}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="যেমন: জামাল"
                      className="w-full px-3.5 py-2.5 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                      required
                    />
                  ) : (
                    <textarea
                      rows={3}
                      value={driverName ?? ''}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="যেমন: জামাল, আনু, ফটিক, কুদ্দুস"
                      className="w-full px-3.5 py-2.5 bg-[#f4fbf8] border border-emerald-200 rounded-xl text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none resize-none"
                      required
                    />
                  )}
                </div>

                {!editingDriver && parseCommaNames(driverName).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[11px] font-bold text-emerald-950 w-full">
                      মোট {toBengaliDigits(parseCommaNames(driverName).length)} জন যুক্ত হবে:
                    </span>
                    {parseCommaNames(driverName).map((n, i) => (
                      <span
                        key={`${n}-${i}`}
                        className="px-2 py-0.5 bg-white text-emerald-900 border border-emerald-200 rounded-md text-[11px] font-bold"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0 px-4 py-3 bg-[#f0f9f6] border-t border-emerald-200 flex items-center justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsDriverModalOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={driverSubmitting}
                  className="flex-1 sm:flex-none px-5 py-2.5 min-h-[44px] bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {driverSubmitting
                    ? 'সংরক্ষণ হচ্ছে...'
                    : editingDriver
                    ? 'নাম আপডেট করুন'
                    : 'তালিকায় যুক্ত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl border border-rose-200 flex flex-col max-h-[90dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <h3 className="font-bold text-sm">মুছে ফেলার নিশ্চিতকরণ</h3>
              </div>
              <button
                type="button"
                onClick={() => !deletingTarget && setDeleteConfirmTarget(null)}
                disabled={deletingTarget}
                className="p-1 text-rose-100 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-4">
              <p className="text-xs text-slate-800 leading-relaxed">
                আপনি কি নিশ্চিতভাবে{' '}
                <strong className="text-slate-900">"{deleteConfirmTarget.name}"</strong>{' '}
                {deleteConfirmTarget.type === 'user'
                  ? 'ব্যবহারকারীকে'
                  : deleteConfirmTarget.type === 'supervisor'
                  ? 'সুপারভাইজারকে'
                  : 'ড্রাইভারকে'}{' '}
                তালিকা থেকে স্থায়ীভাবে মুছে ফেলতে চান?
              </p>
            </div>
            <div className="shrink-0 px-4 py-3 bg-[#f0f9f6] border-t border-slate-200 flex items-center justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={deletingTarget}
                className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={confirmDeleteTargetAction}
                disabled={deletingTarget}
                className="px-4 py-2.5 min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingTarget ? 'মুছে ফেলা হচ্ছে...' : 'মুছে ফেলুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
