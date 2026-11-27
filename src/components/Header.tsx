import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { Company } from '../types/index.ts';
import { useDataSync } from '../hooks/useDataSync.ts';
import { toBengaliDigits } from '../utils/formatters.ts';
import {
  Menu,
  Clock,
  Building,
} from 'lucide-react';
import { useBrandLogoUrl } from '../utils/brandAssets.ts';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  pageTitle: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  pageTitle,
}) => {
  const brandLogoUrl = useBrandLogoUrl();
  const { user, isSuperAdmin, activeCompanyId, setActiveCompanyId } = useAuth();
  const [dhakaTime, setDhakaTime] = useState<string>('');
  const [companiesList, setCompaniesList] = useState<{ id: string; name: string }[]>([]);

  const loadCompanies = useCallback(() => {
    if (isSuperAdmin) {
      api.getCompanies().then((res: { companies: Company[] }) => {
        setCompaniesList(res.companies.map((c: Company) => ({ id: c.id, name: c.name })));
      }).catch(() => {});
    } else {
      setCompaniesList([]);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useDataSync(
    useCallback(() => {
      loadCompanies();
    }, [loadCompanies]),
    ['COMPANY_CHANGED', 'VAULT_REHYDRATED']
  );

  // Live Asia/Dhaka Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      };
      const timeStr = now.toLocaleTimeString('en-US', options);
      setDhakaTime(toBengaliDigits(timeStr));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCompanySwitch = (newCompanyId: string | null) => {
    setActiveCompanyId(newCompanyId);
    window.location.reload();
  };

  const activeCompanyName = companiesList.find((c) => c.id === activeCompanyId)?.name;

  return (
    <>
      {isSuperAdmin && activeCompanyId && (
        <div className="bg-[#1e40af] text-white px-3 sm:px-4 py-1.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-xs w-full max-w-full border-b border-[#1e3a8a]">
          <div className="flex items-center gap-2 min-w-0">
            <Building className="w-4 h-4 text-[#93c5fd] shrink-0" />
            <span className="truncate">
              আপনি <strong>{activeCompanyName || 'নির্বাচিত কোম্পানি'}</strong> এর ডাটা মোডে আছেন।
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCompanySwitch(null)}
            className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded text-[11px] font-bold transition-colors cursor-pointer shrink-0"
          >
            মাস্টার প্ল্যাটফর্মে ফিরুন
          </button>
        </div>
      )}
      <header className="bg-white border-b-2 border-[#1d4ed8] shadow-xs w-full max-w-full">
        <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
          {/* Left: Mobile hamburger & Page Title */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#1d4ed8] bg-[#eff6ff] hover:bg-[#dbeafe] border border-[#bfdbfe] transition-colors cursor-pointer shrink-0"
              aria-label="মেনু খুলুন"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <img
                src={user?.company?.logoUrl || brandLogoUrl}
                alt={user?.company?.name || 'Vehicles Management System'}
                className="w-7 h-7 rounded-lg object-cover border border-[#1e40af] bg-[#1d4ed8] shadow-2xs shrink-0 hidden sm:block"
              />
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-extrabold text-slate-950 leading-tight truncate">
                  {pageTitle}
                </h1>
                <div className="text-[10px] text-[#1d4ed8] font-medium hidden sm:block truncate">
                  {user?.company?.name ? `${user.company.name} — ` : ''}Vehicles Management System
                </div>
              </div>
            </div>
          </div>

          {/* Right: Company Switcher (Super Admin ONLY), Dhaka Clock, Assigned Counter */}
          <div className="flex items-center gap-1.5 shrink-0 max-w-full">
            {isSuperAdmin && companiesList.length > 0 && (
              <div className="flex items-center gap-1 bg-[#eff6ff] border border-[#bfdbfe] px-2 py-1 rounded-lg text-[11px] shadow-2xs max-w-[155px] sm:max-w-[210px]">
                <Building className="w-3 h-3 text-[#1d4ed8] shrink-0" />
                <span className="text-[10px] font-bold text-[#1e3a8a] hidden lg:inline shrink-0">কোম্পানি:</span>
                <select
                  value={activeCompanyId || ''}
                  onChange={(e) => handleCompanySwitch(e.target.value || null)}
                  className="bg-transparent font-bold text-slate-950 outline-none cursor-pointer text-[11px] min-w-0 w-full truncate"
                >
                  <option value="">সকল কোম্পানি (ওভারভিউ)</option>
                  {companiesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Asia/Dhaka Live Clock */}
            <div className="hidden xl:flex items-center gap-1 px-2.5 py-1 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg text-[11px] font-bold text-[#1e3a8a] tabular-nums">
              <Clock className="w-3 h-3 text-[#1d4ed8]" />
              <span>ঢাকা: {dhakaTime}</span>
            </div>

            {/* Current Counter Badge with Seat Color */}
            {user?.counterName && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg text-[11px] font-bold text-slate-900">
                <span
                  className="w-3 h-3 rounded-full shadow-2xs ring-1 ring-black/15 shrink-0"
                  style={{ backgroundColor: user.counterColor || '#1d4ed8' }}
                  title={`সিট কালার: ${user.counterColor}`}
                />
                <span className="truncate max-w-[130px]">{user.counterName}</span>
                <span className="text-[10px] text-[#1d4ed8] font-mono">({user.counterCode})</span>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};
