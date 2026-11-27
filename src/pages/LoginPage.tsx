import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import {
  KeyRound,
  User as UserIcon,
  ShieldAlert,
  ArrowRight,
  Lock,
  Zap,
} from 'lucide-react';
import { PWAInstallBanner } from '../components/PWAInstallBanner.tsx';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [loginId, setLoginId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!loginId.trim() || !pin.trim()) {
      setError('অনুগ্রহ করে লগইন আইডি এবং পিন কোড প্রদান করুন।');
      return;
    }

    if (pin.length < 4 || pin.length > 6) {
      setError('পিন কোড অবশ্যই ৪ থেকে ৬ ডিজিটের হতে হবে।');
      return;
    }

    setLoading(true);
    try {
      await login(loginId.trim(), pin.trim());
    } catch (err: any) {
      setError(err.message || 'ভুল লগইন তথ্য! অনুগ্রহ করে সঠিক তথ্য প্রদান করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdminLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await api.resetAdmin();
      await login('admin', '1234');
    } catch (err: any) {
      setError(err.message || 'ডেমো লগইন ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f0f9f6] text-slate-900 flex flex-col justify-between">
      <PWAInstallBanner />

      {/* Container */}
      <div className="w-full max-w-md mx-auto my-auto p-3 sm:p-4">
        {/* Clean Enterprise Login Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 overflow-hidden">
          <div className="h-1.5 w-full bg-[#0d9488]" />

          {/* App Logo & Header */}
          <div className="px-5 pt-5 pb-4 bg-[#f7fcfa] border-b border-emerald-100 text-center">
            <img
              src="/assets/aistudio/1795651588938_2_f0f59799.jpg"
              alt="Vehicles Management System"
              className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-emerald-200 mx-auto mb-2.5 bg-[#0b2820]"
            />
            <h1 className="text-lg font-black text-slate-950 tracking-tight">
              Vehicles Management System
            </h1>
            <p className="text-xs font-bold text-[#0f766e] mt-0.5">
              স্মার্ট বাস ও কাউন্টার টিকেটিং ম্যানেজমেন্ট · Data&Code
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <div className="mb-4 pb-2.5 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-950">সিস্টেম ও কাউন্টার লগইন</h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                আপনার ব্যক্তিগত লগইন আইডি ও ৪-৬ ডিজিট সিকিউর পিন দিয়ে প্রবেশ করুন
              </p>
            </div>

            {error && (
              <div className="mb-4 p-2.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2 border border-rose-200">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  লগইন আইডি (Login ID)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-700">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="আপনার লগইন আইডি লিখুন"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#f7fcfa] border border-emerald-300 rounded-xl text-xs text-slate-950 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:bg-white transition-all font-mono"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  সিকিউর পিন কোড (৪-৬ ডিজিট)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-700">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="আপনার পিন কোড লিখুন"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#f7fcfa] border border-emerald-300 rounded-xl text-xs text-slate-950 font-bold tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:bg-white transition-all"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] mt-1 py-2.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  'যাচাই করা হচ্ছে...'
                ) : (
                  <>
                    <span>লগইন করুন</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-3.5 pt-3.5 border-t border-slate-200 text-center">
              <button
                type="button"
                onClick={handleQuickAdminLogin}
                disabled={loading}
                className="w-full min-h-[44px] py-2 bg-[#0b2820] hover:bg-[#133b30] text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-300" />
                <span>১-ক্লিকে মাস্টার এডমিন লগইন (ID: admin, PIN: 1234)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-3 text-center text-[11px] text-slate-700 font-medium flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#0f766e]" />
          <span>সার্ভার-সাইড হ্যাশ ও সিকিউর পিন ভেরিফিকেশন সচল</span>
        </div>
      </div>
    </div>
  );
};
