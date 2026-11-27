import React, { useState, useEffect } from 'react';
import { Printer, X, Check, Save, Sliders, FileText, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { openPrintWindow } from '../utils/pdfGenerator.ts';

export interface PrinterSettings {
  paperSize: '58mm' | '80mm' | 'A4';
  defaultCopy: 'BOTH' | 'PASSENGER' | 'OFFICE';
  autoPrintOnBooking: boolean;
  showLogoOnTicket: boolean;
  selectedPrinterName?: string;
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  paperSize: '58mm',
  defaultCopy: 'PASSENGER',
  autoPrintOnBooking: false,
  showLogoOnTicket: true,
  selectedPrinterName: 'সিস্টেম ডিফল্ট থার্মাল প্রিন্টার',
};

export function getStoredPrinterSettings(): PrinterSettings {
  try {
    const saved = localStorage.getItem('bus_printer_settings');
    if (saved) {
      return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_PRINTER_SETTINGS;
}

export function saveStoredPrinterSettings(settings: PrinterSettings) {
  try {
    localStorage.setItem('bus_printer_settings', JSON.stringify(settings));
  } catch {
    // fallback
  }
}

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: PrinterSettings) => void;
}

export const PrinterSettingsModal: React.FC<PrinterSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PrinterSettings>(getStoredPrinterSettings());
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getStoredPrinterSettings());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveStoredPrinterSettings(settings);
    setSavedSuccess(true);
    if (onSave) onSave(settings);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleTestPrint = () => {
    const companyName = user?.company?.name || 'কাউন্টার ম্যানেজমেন্ট সিস্টেম';
    const companyPhone = user?.company?.phone || '০১৭১১-২২৩৩৪৪';

    const testHtml = `
      <div style="text-align: center; border: 1.5px solid #000; padding: 8px; border-radius: 4px; font-family: 'Hind Siliguri', sans-serif;">
        <div style="font-size: 14px; font-weight: 800; margin-bottom: 2px;">${companyName}</div>
        <div style="font-size: 10px; color: #475569; margin-bottom: 6px;">প্রিন্টার টেস্ট স্লিপ (${settings.paperSize.toUpperCase()})</div>
        <div style="display: inline-block; padding: 2px 6px; border: 1px solid #000; font-weight: bold; font-size: 10px; margin: 4px 0;">টেস্ট প্রিন্ট সফল</div>
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
        <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
          <tr><td style="text-align: left; padding: 2px 0;">তারিখ ও সময়:</td><td style="text-align: right; font-weight: bold;">${new Date().toLocaleString('bn-BD')}</td></tr>
          <tr><td style="text-align: left; padding: 2px 0;">কাগজের সাইজ:</td><td style="text-align: right; font-weight: bold;">${settings.paperSize}</td></tr>
          <tr><td style="text-align: left; padding: 2px 0;">ডিফল্ট কপি:</td><td style="text-align: right; font-weight: bold;">${settings.defaultCopy === 'BOTH' ? 'উভয় কপি' : settings.defaultCopy === 'PASSENGER' ? 'যাত্রী কপি' : 'অফিস কপি'}</td></tr>
          <tr><td style="text-align: left; padding: 2px 0;">হটলাইন:</td><td style="text-align: right; font-weight: bold;">${companyPhone}</td></tr>
        </table>
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
        <div style="font-size: 9px; text-align: center; color: #334155;">বাংলা লেখা ও প্রিন্টার কনফিগারেশন ১০০% সঠিক রয়েছে।</div>
      </div>
    `;

    openPrintWindow(testHtml, `টেস্ট প্রিন্ট — ${companyName}`, settings.paperSize);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-emerald-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88dvh]">
        {/* Sticky Header */}
        <div className="shrink-0 px-4 py-3 bg-[#0b2820] text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0d9488]/30 text-emerald-300 flex items-center justify-center font-bold shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base truncate">এড প্রিন্টার ও প্রিন্ট কনফিগারেশন</h3>
              <p className="text-[11px] text-emerald-200 truncate">
                ৫৮ মিমি / ৮০ মিমি পিওএস থার্মাল ও এ৪ প্রিন্টার সেটিংস
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 text-xs text-slate-800">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>প্রিন্টার সেটিংস সফলভাবে সংরক্ষিত হয়েছে!</span>
            </div>
          )}

          {/* Paper Size */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-2">
              ১. প্রিন্টার ও কাগজের সাইজ নির্বাচন (Printer Paper Size)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '58mm', title: '৫৮ মিমি থার্মাল', desc: 'মিনি পিওএস রোল' },
                { id: '80mm', title: '৮০ মিমি থার্মাল', desc: 'স্ট্যান্ডার্ড পিওএস' },
                { id: 'A4', title: 'A4 / A5 লেটারহেড', desc: 'অফিস ডেক্সটপ প্রিন্টার' },
              ].map((p) => {
                const isSelected = settings.paperSize === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, paperSize: p.id as any })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#0d9488] bg-emerald-50 text-[#0b2820] font-bold ring-2 ring-[#0d9488]/20'
                        : 'border-[#a7d7c5] hover:border-[#0d9488] bg-[#f4fbf8] text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[11px] sm:text-xs">{p.title}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal">{p.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Copy Option */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-2">
              ২. ডিফল্ট প্রিন্ট কপি (Default Copies)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'BOTH', title: 'উভয় কপি', desc: 'যাত্রী + অফিস কপি' },
                { id: 'PASSENGER', title: 'যাত্রী কপি', desc: 'শুধু প্যাসেঞ্জার কপি' },
                { id: 'OFFICE', title: 'অফিস কপি', desc: 'শুধু কাউন্টার অডিট' },
              ].map((c) => {
                const isSelected = settings.defaultCopy === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, defaultCopy: c.id as any })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#0f766e] bg-teal-50 text-[#0b2820] font-bold ring-2 ring-[#0f766e]/20'
                        : 'border-[#a7d7c5] hover:border-[#0d9488] bg-[#f4fbf8] text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[11px] sm:text-xs">{c.title}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal">{c.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2.5 pt-2 border-t border-emerald-100">
            <label className="flex items-center justify-between p-3 bg-[#f4fbf8] rounded-xl border border-[#a7d7c5] cursor-pointer">
              <div>
                <div className="font-bold text-slate-900">স্বয়ংক্রিয় প্রিন্ট ডায়লগ (Auto Print)</div>
                <div className="text-[10px] text-slate-500">
                  সিট বুকিং নিশ্চিত হওয়ার সাথে সাথে প্রিন্ট উইন্ডো চালু হবে
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPrintOnBooking}
                onChange={(e) => setSettings({ ...settings, autoPrintOnBooking: e.target.checked })}
                className="w-4 h-4 accent-[#0d9488] rounded cursor-pointer shrink-0"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-[#f4fbf8] rounded-xl border border-[#a7d7c5] cursor-pointer">
              <div>
                <div className="font-bold text-slate-900">কোম্পানি লোগো ও হেডার প্যাড প্রিন্ট</div>
                <div className="text-[10px] text-slate-500">
                  টিকিট ও রিপোর্টের উপরে কোম্পানির আসল নাম ও লোগো প্রদর্শন
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.showLogoOnTicket}
                onChange={(e) => setSettings({ ...settings, showLogoOnTicket: e.target.checked })}
                className="w-4 h-4 accent-[#0d9488] rounded cursor-pointer shrink-0"
              />
            </label>
          </div>

          {/* Notice info */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 leading-relaxed">
            <strong>প্রিন্টার কানেকশন গাইড:</strong> ইউএসবি বা ব্লুটুথ থার্মাল প্রিন্টারটি আপনার পিসি/মোবাইলে কানেক্ট রাখুন। প্রিন্ট বাটনে চাপ দিলে সিস্টেম আপনার নির্বাচিত পেপার সাইজে বাংলা ফন্ট বিকৃত না করে সরাসরি প্রিন্ট করবে।
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 px-4 py-3 bg-[#f0f9f6] border-t border-emerald-200 flex flex-wrap items-center justify-between gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleTestPrint}
            className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>টেস্ট প্রিন্ট</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>সংরক্ষণ করুন</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
