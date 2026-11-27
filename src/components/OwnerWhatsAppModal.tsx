import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Copy, Check, Phone, Bus } from 'lucide-react';
import {
  buildOwnerWhatsAppMessage,
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
  type OwnerReportSummaryItem,
} from '../utils/whatsapp.ts';
import { toBengaliDigits, formatTaka } from '../utils/formatters.ts';

interface OwnerWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  reportTitle: string;
  dateLabel: string;
  items: OwnerReportSummaryItem[];
}

export const OwnerWhatsAppModal: React.FC<OwnerWhatsAppModalProps> = ({
  isOpen,
  onClose,
  companyName,
  reportTitle,
  dateLabel,
  items,
}) => {
  const [phoneOverrides, setPhoneOverrides] = useState<Record<string, string>>({});
  const [messageOverrides, setMessageOverrides] = useState<Record<string, string>>({});
  const [copiedOwner, setCopiedOwner] = useState<string | null>(null);
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPhoneOverrides({});
      setMessageOverrides({});
      setCopiedOwner(null);
      setExpandedOwner(null);
    }
  }, [isOpen, dateLabel, items.length]);

  if (!isOpen) return null;

  const handleCopy = async (ownerName: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOwner(ownerName);
      setTimeout(() => setCopiedOwner(null), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 print:hidden">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88dvh]">
        <div className="shrink-0 px-4 py-3 bg-[#1d4ed8] text-white flex items-center justify-between gap-2 border-b border-[#1e40af]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#1e40af] flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base truncate">
                মালিকদের হোয়াটসঅ্যাপে রিপোর্ট পাঠান
              </h3>
              <p className="text-[11px] text-[#dbeafe] truncate">
                {reportTitle} • {dateLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#dbeafe] hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-3 bg-[#f8fafc]">
          {items.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-600 bg-white rounded-xl border border-slate-200">
              হোয়াটসঅ্যাপে পাঠানোর জন্য কোনো মালিক বা গাড়ির তথ্য পাওয়া যায়নি।
            </div>
          ) : (
            items.map((item) => {
              const currentPhone =
                phoneOverrides[item.ownerName] !== undefined
                  ? phoneOverrides[item.ownerName]
                  : item.ownerPhone || '';
              const defaultMsg = buildOwnerWhatsAppMessage(companyName, reportTitle, dateLabel, item);
              const currentMsg =
                messageOverrides[item.ownerName] !== undefined
                  ? messageOverrides[item.ownerName]
                  : defaultMsg;
              const normalized = normalizeWhatsAppPhone(currentPhone);
              const waUrl = buildWhatsAppUrl(currentPhone, currentMsg);
              const isExpanded = expandedOwner === item.ownerName;

              return (
                <div
                  key={item.ownerName}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{item.ownerName}</span>
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Bus className="w-3.5 h-3.5 text-[#1d4ed8]" />
                          <span>{item.vehicles.join(', ')}</span>
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                        <span>ট্রিপ: <strong>{toBengaliDigits(item.tripCount)}</strong> টি</span>
                        {item.bookedSeats !== undefined && (
                          <span>সিট: <strong>{toBengaliDigits(item.bookedSeats)}</strong> টি</span>
                        )}
                        <span>মোট: <strong className="text-[#1d4ed8]">{formatTaka(item.totalFare)}</strong></span>
                        {item.fuelCostDiff !== undefined && item.fuelCostDiff !== null && (
                          <span>
                            তেল +/-:{' '}
                            <strong
                              className={
                                item.fuelCostDiff > 0
                                  ? 'text-[#1d4ed8]'
                                  : item.fuelCostDiff < 0
                                  ? 'text-[#1e3a8a] underline decoration-dotted'
                                  : 'text-slate-700'
                              }
                            >
                              {item.fuelCostDiff > 0
                                ? `+${formatTaka(item.fuelCostDiff)}`
                                : formatTaka(item.fuelCostDiff)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 bg-[#f8fafc] border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#1d4ed8] shrink-0" />
                        <input
                          type="tel"
                          value={currentPhone}
                          onChange={(e) =>
                            setPhoneOverrides((prev) => ({
                              ...prev,
                              [item.ownerName]: e.target.value,
                            }))
                          }
                          placeholder="01XXXXXXXXX"
                          className="w-32 bg-transparent text-xs font-mono font-bold text-slate-900 outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedOwner(isExpanded ? null : item.ownerName)}
                        className="px-2.5 py-1.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1e3a8a] border border-[#bfdbfe] rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        {isExpanded ? 'বার্তা লুকান' : 'বার্তা এডিট'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(item.ownerName, currentMsg)}
                        className="px-2.5 py-1.5 bg-[#f8fafc] hover:bg-[#eff6ff] text-[#1e3a8a] border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        title="মেসেজ কপি করুন"
                      >
                        {copiedOwner === item.ownerName ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#1d4ed8]" />
                            <span>কপি হয়েছে</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-[#1d4ed8]" />
                            <span>কপি</span>
                          </>
                        )}
                      </button>

                      {normalized && waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>হোয়াটসঅ্যাপে পাঠান</span>
                        </a>
                      ) : (
                        <span className="px-3 py-1.5 bg-[#f8fafc] text-[#1e3a8a] border border-slate-200 rounded-lg text-[11px] font-semibold">
                          সঠিক মোবাইল দিন
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        হোয়াটসঅ্যাপ বার্তা প্রিভিউ ও সম্পাদনা:
                      </label>
                      <textarea
                        rows={7}
                        value={currentMsg}
                        onChange={(e) =>
                          setMessageOverrides((prev) => ({
                            ...prev,
                            [item.ownerName]: e.target.value,
                          }))
                        }
                        className="w-full p-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 px-4 py-3 bg-[#f8fafc] border-t border-slate-200 flex items-center justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
