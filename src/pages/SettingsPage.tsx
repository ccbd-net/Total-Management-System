import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { browserDb } from '../services/browserDb.ts';
import { useDataSync } from '../hooks/useDataSync.ts';
import { toBengaliDigits, formatBengaliDateTime } from '../utils/formatters.ts';
import type { SystemSettings } from '../types/index.ts';
import {
  Settings,
  Bell,
  Save,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Download,
  Upload,
  Database,
  RefreshCw,
  AlertTriangle,
  X,
  KeyRound,
  Lock,
  Image as ImageIcon,
  RotateCcw,
  Smartphone,
} from 'lucide-react';
import {
  useBrandLogoUrl,
  getCurrentBrandVersion,
  applyBrandVersionToDocument,
  syncBrandAssetsFromServer,
} from '../utils/brandAssets.ts';

type LocalBackupStats = Awaited<ReturnType<typeof browserDb.getLocalStorageStats>>;

export const SettingsPage: React.FC = () => {
  const { user, isMasterAdmin, isSuperAdmin, isCompanyAdmin, updateOwnCredentials } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>({
    companyName: 'Vehicles Management System',
    subTitle: 'কাউন্টার বুকিং ও ট্রিপ ইনফরমেশন',
    hotline: '01711-000000',
    defaultFare: 550,
    noticeText: '',
    currency: '৳',
    timezone: 'Asia/Dhaka',
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Local Storage & Backup State
  const [localStats, setLocalStats] = useState<LocalBackupStats | null>(null);
  const [savingLocal, setSavingLocal] = useState<boolean>(false);
  const [exportingJson, setExportingJson] = useState<boolean>(false);
  const [cleaningOrphans, setCleaningOrphans] = useState<boolean>(false);
  const [pendingRestoreVault, setPendingRestoreVault] = useState<{
    fileName: string;
    vault: any;
    companiesCount: number;
    recordsCount: number;
  } | null>(null);
  const [restoringBackup, setRestoringBackup] = useState<boolean>(false);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  // Own Credentials (Login ID & PIN) Update State
  const [credCurrentPin, setCredCurrentPin] = useState<string>('');
  const [credNewLoginId, setCredNewLoginId] = useState<string>(user?.loginId || '');
  const [credNewPin, setCredNewPin] = useState<string>('');
  const [credConfirmPin, setCredConfirmPin] = useState<string>('');
  const [updatingCreds, setUpdatingCreds] = useState<boolean>(false);
  const [credError, setCredError] = useState<string>('');
  const [credSuccess, setCredSuccess] = useState<string>('');

  // Global App Icon, Favicon & Logo Upload State
  const brandLogoUrl = useBrandLogoUrl();
  const [uploadingBrand, setUploadingBrand] = useState<boolean>(false);
  const [resettingBrand, setResettingBrand] = useState<boolean>(false);
  const [brandSuccess, setBrandSuccess] = useState<string>('');
  const [brandError, setBrandError] = useState<string>('');
  const brandFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user?.loginId) {
      setCredNewLoginId(user.loginId);
    }
  }, [user?.loginId]);

  const loadLocalStats = useCallback(async () => {
    try {
      const stats = await browserDb.getLocalStorageStats();
      setLocalStats(stats);
    } catch {}
  }, []);

  useDataSync(loadLocalStats, [
    'BOOKING_CREATED',
    'BOOKING_CANCELLED',
    'SCHEDULE_CREATED',
    'SCHEDULE_UPDATED',
    'SCHEDULE_DELETED',
    'VEHICLE_UPDATED',
    'COUNTER_UPDATED',
    'ROUTE_UPDATED',
    'FUEL_ENTRY_CREATED',
    'COMPANY_CHANGED',
    'VAULT_REHYDRATED',
  ]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.getSettings();
        if (res.settings) {
          setSettings({
            companyName: res.settings.companyName || '',
            subTitle: res.settings.subTitle || '',
            hotline: res.settings.hotline || '',
            defaultFare: res.settings.defaultFare ?? 550,
            noticeText: res.settings.noticeText || '',
            currency: res.settings.currency || '৳',
            timezone: res.settings.timezone || 'Asia/Dhaka',
          });
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
    loadLocalStats();
  }, [loadLocalStats]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await api.updateSettings(settings);
      if (res.settings) {
        setSettings({
          companyName: res.settings.companyName || '',
          subTitle: res.settings.subTitle || '',
          hotline: res.settings.hotline || '',
          defaultFare: res.settings.defaultFare ?? 550,
          noticeText: res.settings.noticeText || '',
          currency: res.settings.currency || '৳',
          timezone: res.settings.timezone || 'Asia/Dhaka',
        });
      }
      setSuccessMsg('সিস্টেম সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
      await loadLocalStats();
    } catch (err: any) {
      setErrorMsg(err.message || 'সেটিংস সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError('');
    setCredSuccess('');

    if (!credCurrentPin.trim()) {
      setCredError('যাচাইয়ের জন্য আপনার বর্তমান পিন দিন।');
      return;
    }
    if (!credNewLoginId.trim() || credNewLoginId.trim().length < 3) {
      setCredError('লগইন আইডি কমপক্ষে ৩ অক্ষরের হতে হবে।');
      return;
    }
    if (credNewPin.trim()) {
      if (credNewPin.trim().length < 4 || credNewPin.trim().length > 6 || !/^\d+$/.test(credNewPin.trim())) {
        setCredError('নতুন পিন অবশ্যই ৪ থেকে ৬ ডিজিটের সংখ্যা হতে হবে।');
        return;
      }
      if (credNewPin.trim() !== credConfirmPin.trim()) {
        setCredError('নতুন পিন ও নিশ্চিতকরণ পিন মিলছে না।');
        return;
      }
    }

    setUpdatingCreds(true);
    try {
      const res = await updateOwnCredentials({
        currentPin: credCurrentPin.trim(),
        newLoginId: credNewLoginId.trim(),
        newPin: credNewPin.trim() || undefined,
      });
      setCredSuccess(res?.message || 'আপনার লগইন আইডি ও পিন সফলভাবে আপডেট হয়েছে!');
      setCredCurrentPin('');
      setCredNewPin('');
      setCredConfirmPin('');
    } catch (err: any) {
      setCredError(err.message || 'লগইন তথ্য আপডেট করা যায়নি।');
    } finally {
      setUpdatingCreds(false);
    }
  };

  const handleSaveLocalSnapshot = async () => {
    setSavingLocal(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const stats = await api.saveToLocalStorage();
      setLocalStats(stats);
      const sizeKb = Math.max(1, Math.round((stats.localStorageBytes || 0) / 1024));
      const scopeLabel = isSuperAdmin
        ? `${toBengaliDigits(stats.companies)} টি কোম্পানি · ${toBengaliDigits(sizeKb)} KB`
        : `${toBengaliDigits(sizeKb)} KB`;
      setSuccessMsg(
        `সম্পূর্ণ ডাটাবেইজ স্ন্যাপশট (${scopeLabel}) ব্রাউজারের লোকাল স্টোরেজ ও ইনডেক্সডডিবিতে সংরক্ষিত হয়েছে!`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'লোকাল স্টোরেজে সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSavingLocal(false);
    }
  };

  const handleDownloadBackupJson = async () => {
    setExportingJson(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const vault = await api.exportFullBackup();
      const jsonStr = JSON.stringify(vault, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const todayStr = new Date().toISOString().split('T')[0];
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `counter-backup-${todayStr}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setSuccessMsg('সম্পূর্ণ ব্যাকআপ ফাইল (.json) ডাউনলোড শুরু হয়েছে!');
    } catch (err: any) {
      setErrorMsg(err.message || 'ব্যাকআপ ফাইল ডাউনলোড করা যায়নি।');
    } finally {
      setExportingJson(false);
    }
  };

  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const vault = parsed?.vault || parsed;
        if (!vault || typeof vault !== 'object' || (!Array.isArray(vault.companies) && !Array.isArray(vault.vehicles))) {
          setErrorMsg('নির্বাচিত ফাইলটি সঠিক ব্যাকআপ (.json) ফরম্যাটে নেই।');
          return;
        }
        const companiesCount = Array.isArray(vault.companies) ? vault.companies.length : 0;
        const recordsCount =
          (vault.counters?.length || 0) +
          (vault.vehicles?.length || 0) +
          (vault.routes?.length || 0) +
          (vault.schedules?.length || 0) +
          (vault.bookings?.length || 0) +
          (vault.reconciliations?.length || 0) +
          (vault.fuelEntries?.length || 0);

        setPendingRestoreVault({
          fileName: file.name,
          vault,
          companiesCount,
          recordsCount,
        });
      } catch {
        setErrorMsg('ব্যাকআপ JSON ফাইলটি পড়া যায়নি। অনুগ্রহ করে সঠিক ফাইল নির্বাচন করুন।');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestoreVault) return;
    setRestoringBackup(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const result = await api.restoreFullBackup(pendingRestoreVault.vault);
      setPendingRestoreVault(null);
      await loadLocalStats();
      setSuccessMsg(
        `ব্যাকআপ থেকে ${toBengaliDigits(result.restoredCompanies)} টি কোম্পানি ও মোট ${toBengaliDigits(result.totalRestored)} টি রেকর্ড সফলভাবে রিস্টোর করা হয়েছে!`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'ব্যাকআপ রিস্টোর ব্যর্থ হয়েছে।');
    } finally {
      setRestoringBackup(false);
    }
  };

  const handleCleanupOrphans = async () => {
    setCleaningOrphans(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.cleanupOrphans();
      await loadLocalStats();
      const total = (res.serverRemoved || 0) + (res.browserRemoved || 0);
      if (total > 0) {
        setSuccessMsg(
          `পূর্ববর্তী মুছে যাওয়া কোম্পানির অবশিষ্ট ${toBengaliDigits(total)} টি অরফান রেকর্ড পরিষ্কার করা হয়েছে!`
        );
      } else {
        setSuccessMsg('ডাটাবেইজ ও ব্রাউজার স্টোরেজ সম্পূর্ণ পরিষ্কার আছে — কোনো অরফান ডাটা পাওয়া যায়নি।');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'অরফান ডাটা পরিষ্কার ব্যর্থ হয়েছে।');
    } finally {
      setCleaningOrphans(false);
    }
  };

  const handleUploadBrandIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBrandError('');
    setBrandSuccess('');

    if (!file.type.startsWith('image/')) {
      setBrandError('অনুগ্রহ করে PNG, JPG অথবা WEBP ফরম্যাটের ছবি নির্বাচন করুন।');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setBrandError('ছবির সাইজ ১০ মেগাবাইটের কম হতে হবে।');
      return;
    }

    setUploadingBrand(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result || '');
        const res = await api.uploadBrandIcon(dataUrl);
        applyBrandVersionToDocument(res.version);
        await syncBrandAssetsFromServer(true);
        setBrandSuccess(
          'অ্যাপ আইকন, ফেবিকন ও লোগো সফলভাবে আপডেট হয়েছে! সকল মোবাইল ও ইনস্টল করা PWA অ্যাপে স্বয়ংক্রিয়ভাবে নতুন আইকন সিঙ্ক হবে।'
        );
      } catch (err: any) {
        setBrandError(err?.message || 'আইকন ও লোগো আপলোড ব্যর্থ হয়েছে।');
      } finally {
        setUploadingBrand(false);
      }
    };
    reader.onerror = () => {
      setBrandError('ছবি ফাইলটি পড়া যায়নি।');
      setUploadingBrand(false);
    };
    reader.readAsDataURL(file);
  };

  const handleResetBrandIcon = async () => {
    setResettingBrand(true);
    setBrandError('');
    setBrandSuccess('');
    try {
      const res = await api.resetBrandIcon();
      applyBrandVersionToDocument(res.version);
      await syncBrandAssetsFromServer(true);
      setBrandSuccess('অ্যাপ আইকন ও লোগো ডিফল্ট DATA CODE ডিজাইনে রিস্টোর করা হয়েছে!');
    } catch (err: any) {
      setBrandError(err?.message || 'ডিফল্ট লোগো রিস্টোর করা যায়নি।');
    } finally {
      setResettingBrand(false);
    }
  };

  const canManageBackup = isSuperAdmin || isCompanyAdmin || isMasterAdmin;
  const formattedLocalTime = localStats?.updatedAt
    ? formatBengaliDateTime(localStats.updatedAt)
    : 'এখনো সংরক্ষিত হয়নি';

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {/* Compact Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#1d4ed8] px-3 py-2.5 text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#93c5fd] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold leading-tight truncate">
              সিস্টেম কনফিগারেশন ও সেটিংস
            </h2>
            <p className="hidden sm:block text-[10px] text-[#dbeafe] leading-tight truncate">
              প্রতিষ্ঠানের নাম, সহায়তা হটলাইন, নোটিশ, একাউন্ট নিরাপত্তা ও ব্যাকআপ
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-2.5 bg-[#eff6ff] text-[#1e3a8a] rounded-xl text-xs font-semibold border border-[#bfdbfe] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-[#1d4ed8]" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-[#1d4ed8] hover:text-[#1e3a8a] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="text-red-600 hover:text-red-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#1d4ed8] px-3 py-2 text-white text-xs font-bold flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-[#93c5fd]" />
          <span>প্রতিষ্ঠান ও অপারেশনাল সেটিংস</span>
        </div>
        <div className="p-3.5 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              প্রতিষ্ঠানের নাম (Company Brand)
            </label>
            <input
              type="text"
              value={settings.companyName ?? ''}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              উপ-শিরোনাম (Sub Title)
            </label>
            <input
              type="text"
              value={settings.subTitle ?? ''}
              onChange={(e) => setSettings({ ...settings, subTitle: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              কেন্দ্রীয় সহায়তা হটলাইন
            </label>
            <input
              type="text"
              value={settings.hotline ?? ''}
              onChange={(e) => setSettings({ ...settings, hotline: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ডিফল্ট ট্রিপ ভাড়া (৳)
            </label>
            <input
              type="number"
              value={settings.defaultFare ?? ''}
              onChange={(e) => setSettings({ ...settings, defaultFare: Number(e.target.value) })}
              disabled={loading}
              className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-bold tabular-nums outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
            />
          </div>
        </div>

        {/* Global Notice Text */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-[#1d4ed8]" />
            <span>কাউন্টার নোটিশ বোর্ড বার্তা</span>
          </label>
          <textarea
            value={settings.noticeText ?? ''}
            onChange={(e) => setSettings({ ...settings, noticeText: e.target.value })}
            disabled={loading}
            className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
            rows={3}
            placeholder="কাউন্টার অপারেটরদের জন্য কোনো গুরুত্বপূর্ণ নোটিশ বা নির্দেশিকা..."
          />
        </div>

        {/* System Fixed Settings */}
        <div className="p-4 bg-[#f8fafc] rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500 font-medium">মুদ্রা প্রতীক (Currency):</span>
            <div className="font-bold text-slate-800 text-sm mt-0.5">৳ (বাংলাদেশি টাকা)</div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">টাইমজোন (Timezone):</span>
            <div className="font-bold text-slate-800 text-sm mt-0.5">Asia/Dhaka (UTC+6)</div>
          </div>
        </div>

        {isMasterAdmin && (
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[44px] py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'সংরক্ষিত হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}</span>
          </button>
        )}
        </div>
      </form>

      {/* Global App Icon, Favicon & Logo Management (Multi-Device PWA Sync) */}
      {isMasterAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="bg-[#1d4ed8] px-3 py-2 text-white flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#93c5fd]" />
              <span>অ্যাপ আইকন, ফেবিকন ও লোগো আপলোড (সকল ডিভাইস সিঙ্ক)</span>
            </h3>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15 border border-white/25 text-[10px] font-mono font-bold">
              <Smartphone className="w-3 h-3" />
              <span>v{getCurrentBrandVersion()}</span>
            </span>
          </div>

          <div className="p-3.5 space-y-3">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              এখানে নতুন ছবি আপলোড করলে অ্যাপের <strong>লোগো, ব্রাউজার ফেবিকন, এবং অন্য সকল মোবাইল ও পিসিতে ইনস্টল করা PWA আইকন</strong> একসাথে আপডেট হবে।
            </p>

            {brandSuccess && (
              <div className="p-2.5 bg-[#eff6ff] text-[#1e3a8a] rounded-xl text-xs font-semibold border border-[#bfdbfe] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-[#1d4ed8]" />
                  <span>{brandSuccess}</span>
                </div>
                <button type="button" onClick={() => setBrandSuccess('')} className="text-[#1d4ed8] cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {brandError && (
              <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{brandError}</span>
                </div>
                <button type="button" onClick={() => setBrandError('')} className="text-red-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Live Previews of Logo, Favicon & Mobile PWA Icon */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-[#f8fafc] border border-slate-200 rounded-xl p-3">
              <div className="flex flex-col items-center text-center gap-1.5">
                <img
                  src={brandLogoUrl}
                  alt="App Logo"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-slate-300 bg-[#030b1a] shadow-2xs"
                />
                <span className="text-[10px] font-bold text-slate-700">অ্যাপ লোগো</span>
              </div>

              <div className="flex flex-col items-center text-center gap-1.5">
                <img
                  src={`/pwa-maskable-512x512.png?v=${encodeURIComponent(getCurrentBrandVersion())}`}
                  alt="Mobile App Icon"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border border-slate-300 bg-[#030b1a] shadow-2xs"
                />
                <span className="text-[10px] font-bold text-slate-700">মোবাইল আইকন</span>
              </div>

              <div className="flex flex-col items-center text-center gap-1.5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-slate-300 bg-white flex items-center justify-center shadow-2xs">
                  <img
                    src={`/favicon.png?v=${encodeURIComponent(getCurrentBrandVersion())}`}
                    alt="Favicon"
                    className="w-8 h-8 rounded object-cover"
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-700">ফেবিকন</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex-1 min-h-[44px] px-4 py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-xs">
                {uploadingBrand ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>
                  {uploadingBrand ? 'আইকন ও লোগো আপডেট হচ্ছে...' : 'নতুন আইকন / লোগো আপলোড করুন'}
                </span>
                <input
                  ref={brandFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUploadBrandIcon}
                  disabled={uploadingBrand || resettingBrand}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleResetBrandIcon}
                disabled={uploadingBrand || resettingBrand}
                className="min-h-[44px] px-3.5 py-2.5 bg-[#f8fafc] hover:bg-[#eff6ff] text-slate-800 border border-slate-200 hover:border-[#bfdbfe] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-[#1d4ed8] ${resettingBrand ? 'animate-spin' : ''}`} />
                <span>ডিফল্ট রিস্টোর</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Own Account Security — Change Login ID & PIN */}
      <form onSubmit={handleUpdateCredentials} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#1e3a8a] px-3 py-2 text-white flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#93c5fd]" />
            <span>একাউন্ট নিরাপত্তা — লগইন আইডি ও পিন পরিবর্তন</span>
          </h3>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15 border border-white/25 text-[10px] font-bold">
            <Lock className="w-3 h-3" />
            <span>সুরক্ষিত</span>
          </span>
        </div>
        <div className="p-3.5 space-y-3">
          <p className="text-[11px] text-slate-500">
            আপনার ব্যক্তিগত লগইন আইডি ও গোপন পিন পরিবর্তন করুন। পরিবর্তিত তথ্য সম্পূর্ণ এনক্রিপ্টেড থাকবে।
          </p>

        {credSuccess && (
          <div className="p-3 bg-[#eff6ff] text-[#1e3a8a] rounded-xl text-xs font-semibold border border-[#bfdbfe] flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-[#1d4ed8]" />
            <span>{credSuccess}</span>
          </div>
        )}

        {credError && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{credError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              বর্তমান পিন কোড *
            </label>
            <input
              type="password"
              maxLength={6}
              value={credCurrentPin}
              onChange={(e) => setCredCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="আপনার বর্তমান পিন"
              className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              লগইন আইডি *
            </label>
            <input
              type="text"
              value={credNewLoginId}
              onChange={(e) => setCredNewLoginId(e.target.value.replace(/\s+/g, ''))}
              placeholder="নতুন লগইন আইডি লিখুন"
              className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              নতুন ৪-৬ ডিজিট পিন (ঐচ্ছিক)
            </label>
            <input
              type="password"
              maxLength={6}
              value={credNewPin}
              onChange={(e) => setCredNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="পিন না বদলালে খালি রাখুন"
              className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              নতুন পিন নিশ্চিত করুন
            </label>
            <input
              type="password"
              maxLength={6}
              value={credConfirmPin}
              onChange={(e) => setCredConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="নতুন পিন পুনরায় লিখুন"
              className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
              disabled={!credNewPin.trim()}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={updatingCreds}
          className="w-full min-h-[44px] py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>{updatingCreds ? 'আপডেট হচ্ছে...' : 'লগইন আইডি ও পিন আপডেট করুন'}</span>
        </button>
        </div>
      </form>

      {/* Local Storage & Backup Section */}
      {canManageBackup && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="bg-[#1d4ed8] px-3 py-2 text-white flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-[#93c5fd]" />
              <span>লোকাল স্টোরেজ ও ব্যাকআপ সংরক্ষণ</span>
            </h3>
            <span className="text-[10px] text-[#dbeafe] tabular-nums">
              শেষ: {formattedLocalTime} ·{' '}
              {localStats?.hasLocalBackup
                ? `${toBengaliDigits(Math.max(1, Math.round((localStats.localStorageBytes || 0) / 1024)))} KB`
                : 'স্ন্যাপশট নেই'}
            </span>
          </div>
          <div className="p-3.5 space-y-3">

          {/* Unboxed Inline Metadata Summary */}
          <div className="text-xs text-slate-600 bg-[#f8fafc] px-4 py-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
            <span className="font-bold text-slate-800">সংরক্ষিত ডাটা:</span>
            {isSuperAdmin && (
              <>
                <span>কোম্পানি {toBengaliDigits(localStats?.companies || 0)}</span>
                <span className="text-slate-300">·</span>
              </>
            )}
            <span>গাড়ি {toBengaliDigits(localStats?.vehicles || 0)}</span>
            <span className="text-slate-300">·</span>
            <span>রুট {toBengaliDigits(localStats?.routes || 0)}</span>
            <span className="text-slate-300">·</span>
            <span>ট্রিপ {toBengaliDigits(localStats?.schedules || 0)}</span>
            <span className="text-slate-300">·</span>
            <span>বুকিং {toBengaliDigits(localStats?.bookings || 0)}</span>
            <span className="text-slate-300">·</span>
            <span>ট্রিপ সমন্বয় {toBengaliDigits(localStats?.reconciliations || 0)}</span>
            <span className="text-slate-300">·</span>
            <span>ফুয়েল লগ {toBengaliDigits(localStats?.fuelEntries || 0)}</span>
          </div>

          {/* Pending JSON Restore Confirmation Box */}
          {pendingRestoreVault && (
            <div className="p-4 bg-[#eff6ff] border border-[#bfdbfe] rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-[#1e3a8a] font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-[#1d4ed8] shrink-0" />
                  <span>ব্যাকআপ ফাইল রিস্টোর নিশ্চিতকরণ ({pendingRestoreVault.fileName})</span>
                </div>
                <button
                  type="button"
                  onClick={() => !restoringBackup && setPendingRestoreVault(null)}
                  className="text-[#1d4ed8] hover:text-[#1e3a8a] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-[#1e3a8a] leading-relaxed tabular-nums">
                এই ব্যাকআপ ফাইলে <strong>{toBengaliDigits(pendingRestoreVault.companiesCount)} টি কোম্পানি</strong> ও সংশ্লিষ্ট{' '}
                <strong>{toBengaliDigits(pendingRestoreVault.recordsCount)} টি রেকর্ড</strong> রয়েছে। রিস্টোর করলে বর্তমান ডাটাবেইজের সাথে যুক্ত হবে এবং সুপার এডমিন অ্যাকাউন্ট সুরক্ষিত থাকবে।
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingRestoreVault(null)}
                  disabled={restoringBackup}
                  className="px-3.5 py-2 bg-white hover:bg-[#f8fafc] text-slate-700 border border-slate-200 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={restoringBackup}
                  className="px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{restoringBackup ? 'রিস্টোর হচ্ছে...' : 'এখনই রিস্টোর করুন'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleSaveLocalSnapshot}
              disabled={savingLocal}
              className="min-h-[44px] px-4 py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <HardDrive className={`w-4 h-4 ${savingLocal ? 'animate-pulse' : ''}`} />
              <span>{savingLocal ? 'জমা হচ্ছে...' : 'লোকাল স্টোরেজে ডাটা জমা করুন'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadBackupJson}
              disabled={exportingJson}
              className="min-h-[44px] px-4 py-2.5 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-[#93c5fd]" />
              <span>{exportingJson ? 'প্রস্তুত হচ্ছে...' : 'ব্যাকআপ ফাইল ডাউনলোড (.JSON)'}</span>
            </button>

            {isSuperAdmin && (
              <>
                <label className="px-4 py-2.5 bg-[#f8fafc] hover:bg-[#eff6ff] text-slate-800 border border-slate-200 hover:border-[#bfdbfe] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer">
                  <Upload className="w-4 h-4 text-[#1d4ed8]" />
                  <span>ফাইল থেকে রিস্টোর করুন</span>
                  <input
                    ref={restoreInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleSelectRestoreFile}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleCleanupOrphans}
                  disabled={cleaningOrphans}
                  className="px-4 py-2.5 bg-[#f8fafc] hover:bg-[#eff6ff] text-slate-700 border border-slate-200 hover:border-[#bfdbfe] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  {cleaningOrphans ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-[#1d4ed8]" />
                  ) : (
                    <Database className="w-4 h-4 text-[#1d4ed8]" />
                  )}
                  <span>{cleaningOrphans ? 'পরিষ্কার হচ্ছে...' : 'অবশিষ্ট অরফান ডাটা পরিষ্কার'}</span>
                </button>
              </>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

