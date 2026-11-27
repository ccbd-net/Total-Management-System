import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import type { AuditLog } from '../types/index.ts';
import { formatBengaliDateTime, toBengaliDigits } from '../utils/formatters.ts';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Shield,
  Eye,
  X,
  FileText,
} from 'lucide-react';

export const AuditHistoryPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({ actionType: actionFilter || undefined, limit: 200 });
      setLogs(res.auditLogs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const filteredLogs = logs.filter((l) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.userName.toLowerCase().includes(term) ||
      l.details.toLowerCase().includes(term) ||
      l.actionType.toLowerCase().includes(term) ||
      l.entityId.toLowerCase().includes(term)
    );
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE_BOOKING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]">বুকিং তৈরি</span>;
      case 'CANCEL_BOOKING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">বুকিং বাতিল</span>;
      case 'CREATE_SCHEDULE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1d4ed8] text-white">শিডিউল তৈরি</span>;
      case 'UPDATE_SCHEDULE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1e3a8a] text-white">শিডিউল আপডেট</span>;
      case 'RECONCILE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff6ff] text-[#1e3a8a] border border-[#bfdbfe]">হিসাব সমন্বয়</span>;
      case 'SETTINGS_CHANGE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f8fafc] text-slate-800 border border-slate-200">সেটিংস পরিবর্তন</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f8fafc] text-slate-800 border border-slate-200">{action}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#1d4ed8] px-3.5 py-2.5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-4 h-4 text-[#93c5fd] shrink-0" />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold leading-tight truncate">
                পরিবর্তনের ইতিহাস ও অডিট ট্রেইল (Audit Logs)
              </h2>
              <p className="hidden sm:block text-[10px] text-[#dbeafe] leading-tight">
                কে, কখন ট্রিপ শিডিউল, গাড়ি, সুপারভাইজার, ছাড়ার সময় বা বুকিং পরিবর্তন করেছেন তার বিস্তারিত রেকর্ড
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchLogs}
            className="px-3 py-1.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white rounded-lg text-xs font-bold transition-colors self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
            title="রিফ্রেশ"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="অপারেটর নাম, অ্যাকশন বা বিবরণ দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white outline-none"
          />
        </div>

        {/* Action Type Filter Dropdown */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#1d4ed8]"
        >
          <option value="">সকল অ্যাকশন (All Actions)</option>
          <option value="CREATE_BOOKING">বুকিং তৈরি (CREATE_BOOKING)</option>
          <option value="CANCEL_BOOKING">বুকিং বাতিল (CANCEL_BOOKING)</option>
          <option value="CREATE_SCHEDULE">শিডিউল তৈরি (CREATE_SCHEDULE)</option>
          <option value="UPDATE_SCHEDULE">শিডিউল পরিবর্তন (UPDATE_SCHEDULE)</option>
          <option value="RECONCILE">হিসাব সমন্বয় (RECONCILE)</option>
          <option value="SETTINGS_CHANGE">সেটিংস পরিবর্তন (SETTINGS_CHANGE)</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-3.5 py-2.5 bg-[#1e3a8a] text-white flex items-center justify-between">
          <h3 className="font-bold text-xs sm:text-sm">
            লিপিবদ্ধ পরিবর্তন সমূহ ({toBengaliDigits(filteredLogs.length)} টি রেকর্ড)
          </h3>
          <span className="text-[11px] text-[#dbeafe]">অনপনেয় (Immutable Audit History)</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">
            কোনো পরিবর্তনের ইতিহাস পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse border border-slate-200">
              <thead>
                <tr className="bg-[#1d4ed8] text-white text-[11px] font-bold border-b border-[#1e40af]">
                  <th className="py-2.5 px-3 font-bold border-r border-blue-600/60">সময় ও তারিখ</th>
                  <th className="py-2.5 px-3 font-bold border-r border-blue-600/60">ব্যবহারকারী</th>
                  <th className="py-2.5 px-3 font-bold border-r border-blue-600/60">অ্যাকশন টাইপ</th>
                  <th className="py-2.5 px-3 font-bold border-r border-blue-600/60">বিবরণ</th>
                  <th className="py-2.5 px-3 font-bold text-right">পূর্বের/নতুন মান</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="odd:bg-white even:bg-[#f1f5f9] hover:bg-[#eff6ff] transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">
                      <div className="font-semibold text-slate-800">
                        {formatBengaliDateTime(l.timestamp)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{l.id}</div>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">
                      <div className="font-bold text-slate-900">{l.userName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-mono">{l.role}</div>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">{getActionBadge(l.actionType)}</td>

                    <td className="py-2.5 px-3 border-r border-slate-200">
                      <div className="text-slate-800 font-medium leading-relaxed max-w-md">
                        {l.details}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {(l.previousValues || l.newValues) ? (
                        <button
                          type="button"
                          onClick={() => setSelectedLog(l)}
                          className="px-2.5 py-1 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ডিফ দেখুন</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Diff / Value Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#1d4ed8] text-white flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold truncate">
                  পরিবর্তন বিবরণ ({selectedLog.actionType})
                </h3>
                <p className="text-[11px] text-[#dbeafe] truncate">
                  সম্পাদনাকারী: {selectedLog.userName} ({formatBengaliDateTime(selectedLog.timestamp)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-[#dbeafe] hover:text-white hover:bg-white/15 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 text-xs text-slate-900">
              <div className="p-3 bg-[#f8fafc] rounded-xl border border-slate-200 font-medium text-slate-800">
                {selectedLog.details}
              </div>

              {selectedLog.previousValues && (
                <div>
                  <div className="font-bold text-[#1e3a8a] mb-1">পূর্ববর্তী মান (Previous Values):</div>
                  <pre className="p-3 bg-[#f8fafc] border border-slate-200 text-slate-900 rounded-xl overflow-x-auto text-[11px] font-mono">
                    {JSON.stringify(selectedLog.previousValues, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValues && (
                <div>
                  <div className="font-bold text-[#1d4ed8] mb-1">নতুন মান (New Values):</div>
                  <pre className="p-3 bg-[#eff6ff] border border-[#bfdbfe] text-[#1e3a8a] rounded-xl overflow-x-auto text-[11px] font-mono">
                    {JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="shrink-0 px-4 py-3 bg-[#f8fafc] border-t border-slate-200 flex items-center justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="min-h-[44px] px-5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold cursor-pointer"
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
