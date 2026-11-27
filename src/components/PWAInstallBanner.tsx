import React, { useState, useEffect } from 'react';
import {
  Download,
  CheckCircle2,
  X,
  Smartphone,
  ExternalLink,
  Laptop,
  Apple,
  HelpCircle,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import { useBrandLogoUrl } from '../utils/brandAssets.ts';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallBanner: React.FC = () => {
  const brandLogoUrl = useBrandLogoUrl();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && (window as any).__deferredPwaPrompt) {
      return (window as any).__deferredPwaPrompt as BeforeInstallPromptEvent;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'android' | 'desktop' | 'ios'>('android');
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if in iframe
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    // Check if running as installed standalone app
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    // Detect device type to select default guide tab
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setActiveTab('ios');
    } else if (/android/.test(ua)) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }

    // Sync any globally captured prompt or capture future prompt events
    const syncGlobalPrompt = () => {
      if ((window as any).__deferredPwaPrompt) {
        setDeferredPrompt((window as any).__deferredPwaPrompt as BeforeInstallPromptEvent);
      }
    };

    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredPwaPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__deferredPwaPrompt = null;
      setShowModal(false);
    };

    syncGlobalPrompt();
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('vms-pwa-prompt-ready', syncGlobalPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('vms-pwa-prompt-ready', syncGlobalPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstallButtonClick = async () => {
    const promptEvent = deferredPrompt || ((window as any).__deferredPwaPrompt as BeforeInstallPromptEvent | undefined);
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        (window as any).__deferredPwaPrompt = null;
        return;
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
    setShowModal(true);
  };

  const directUrl = typeof window !== 'undefined' ? window.location.href : '/';

  return (
    <>
      {/* Offline Mode Bar */}
      {!isOnline && (
        <div className="bg-[#1e3a8a] text-white border-b border-white/15 px-3 py-1.5 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 w-full">
          <WifiOff className="w-3.5 h-3.5 text-[#93c5fd] shrink-0" />
          <span>অফলাইন মোড — ইন্টারনেট সংযোগ বিচ্ছিন্ন রয়েছে, ক্যাশ করা তথ্য প্রদর্শিত হচ্ছে</span>
        </div>
      )}

      {/* Top Install Notification Banner */}
      {!isInstalled && !dismissed && (
        <div className="bg-[#1e40af] text-white px-3 sm:px-4 py-1.5 shadow-sm flex items-center justify-between gap-2 text-xs border-b border-white/15 w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img
              src={brandLogoUrl}
              alt="Vehicles Management System"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-cover border border-white/25 shrink-0"
            />
            <div className="min-w-0 truncate">
              <span className="font-bold text-white tracking-wide text-[11px] sm:text-xs">
                অ্যাপ ইনস্টল (PWA)
              </span>
              <span className="text-[#bfdbfe] hidden md:inline ml-1.5 text-xs">
                — মোবাইল বা কম্পিউটারে সরাসরি ইনস্টল করে দ্রুত ব্যবহার করুন।
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isInIframe ? (
              <a
                href={directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-white hover:bg-[#eff6ff] text-[#1d4ed8] font-extrabold rounded-lg shadow-xs flex items-center gap-1 transition-all text-[11px] whitespace-nowrap"
                title="অ্যাপটি নতুন ট্যাবে খুলুন"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span>নতুন ট্যাবে</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={handleInstallButtonClick}
                className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white border border-white/25 font-extrabold rounded-lg shadow-xs flex items-center gap-1 transition-all text-[11px] cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3 h-3 shrink-0" />
                <span>{deferredPrompt ? 'ইনস্টল করুন' : 'ইনস্টল'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors text-[11px] font-semibold flex items-center gap-1 cursor-pointer border border-white/20"
              title="ইনস্টল সহায়িকা ও নির্দেশিকা"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#bfdbfe]" />
              <span className="hidden md:inline">সহায়িকা</span>
            </button>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1 text-[#bfdbfe] hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
              title="ব্যানার বন্ধ করুন"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Comprehensive PWA Installation Guide Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white text-slate-900 rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88dvh]">
            {/* Modal Header */}
            <div className="shrink-0 bg-[#1d4ed8] text-white p-4 flex items-center justify-between border-b border-[#1e40af]">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={brandLogoUrl}
                  alt="Vehicles Management System"
                  className="w-9 h-9 rounded-xl object-cover border border-white/25 shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-white truncate">Vehicles Management System (PWA)</h3>
                  <p className="text-[11px] text-[#bfdbfe] truncate">মোবাইল ও পিসিতে ইনস্টল করার সহজ নিয়ম</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#dbeafe] hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-4 overflow-y-auto overscroll-contain space-y-3.5">
              {/* If in iframe alert box */}
              {isInIframe && (
                <div className="p-3 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-[#1e3a8a] text-xs">
                  <div className="font-bold flex items-center gap-1.5 text-[#1e3a8a] mb-1">
                    <Sparkles className="w-4 h-4 text-[#1d4ed8]" />
                    <span>প্রিভিউ মোড সতর্কবার্তা:</span>
                  </div>
                  <p className="leading-relaxed mb-2">
                    আপনি বর্তমানে প্রিভিউ ফ্রেমের ভেতরে আছেন। ক্রোম থেকে সরাসরি অ্যাপ ইনস্টল করতে নিচের বাটনে ট্যাপ করে নতুন ট্যাবে খুলুন:
                  </p>
                  <a
                    href={directUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-[#1e40af] hover:bg-[#1e3a8a] text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4 text-[#93c5fd]" />
                    <span>সরাসরি নতুন ট্যাবে অ্যাপটি খুলুন</span>
                  </a>
                </div>
              )}

              {/* Direct Prompt Button if available */}
              {deferredPrompt && (
                <div className="p-3.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-center">
                  <p className="text-xs text-[#1e3a8a] font-semibold mb-2">
                    আপনার ক্রোম ব্রাউজার অ্যাপটি সরাসরি ইনস্টল করার জন্য প্রস্তুত!
                  </p>
                  <button
                    type="button"
                    onClick={handleInstallButtonClick}
                    className="w-full py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm cursor-pointer text-xs sm:text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>সরাসরি অ্যাপ ইনস্টল করুন</span>
                  </button>
                </div>
              )}

              {/* Device Selector Tabs */}
              <div>
                <div className="text-xs font-bold text-slate-700 mb-1.5">আপনার ডিভাইস নির্বাচন করুন:</div>
                <div className="grid grid-cols-3 gap-1.5 bg-[#f8fafc] border border-slate-200 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('android')}
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'android'
                        ? 'bg-[#1d4ed8] text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>অ্যান্ড্রয়েড</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('desktop')}
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'desktop'
                        ? 'bg-[#1d4ed8] text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    <span>কম্পিউটার</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('ios')}
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'ios'
                        ? 'bg-[#1d4ed8] text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    <Apple className="w-3.5 h-3.5" />
                    <span>আইফোন</span>
                  </button>
                </div>
              </div>

              {/* Tab Contents */}
              {activeTab === 'android' && (
                <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3.5 text-xs space-y-2.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#1d4ed8]" />
                    <span>Android Chrome ব্রাউজারে ইনস্টল করার নিয়ম:</span>
                  </div>
                  <ol className="space-y-1.5 text-slate-700 leading-relaxed font-medium">
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold">১.</span>
                      <span>প্রথমে উপরের <strong>"নতুন ট্যাবে"</strong> বাটনে চাপ দিয়ে ব্রাউজারের মূল ট্যাবে ওপেন করুন।</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold">২.</span>
                      <span>ব্রাউজারের উপরে ডান কোণায় থাকা <strong>৩-ডট (⋮)</strong> মেনুতে ট্যাপ করে <strong>"Add to Home screen"</strong> বা <strong>"Install app"</strong> নির্বাচন করুন।</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold">৩.</span>
                      <span>পপআপে <strong>"Install"</strong> বাটনে ট্যাপ করুন। হোম স্ক্রিনে সরাসরি VMS অ্যাপ যুক্ত হয়ে যাবে।</span>
                    </li>
                  </ol>
                </div>
              )}

              {activeTab === 'desktop' && (
                <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3.5 text-xs space-y-2.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-[#1d4ed8]" />
                    <span>Chrome / Microsoft Edge (PC / Mac) এ ইনস্টল:</span>
                  </div>
                  <ol className="space-y-1.5 text-slate-700 leading-relaxed font-medium">
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold">১.</span>
                      <span>ব্রাউজারের এড্রেস বারে ডান পাশে থাকা <strong>⤓ (Install)</strong> আইকনে ক্লিক করুন।</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold">২.</span>
                      <span>অথবা ৩-ডট মেনু ➔ <strong>"Cast, save, and share"</strong> ➔ <strong>"Install Vehicles Management System"</strong> এ ক্লিক করুন।</span>
                    </li>
                  </ol>
                </div>
              )}

              {activeTab === 'ios' && (
                <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3.5 text-xs space-y-2.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Apple className="w-4 h-4 text-[#1e40af]" />
                    <span>iPhone / iPad (Safari) ব্রাউজারে ইনস্টল:</span>
                  </div>
                  <ol className="space-y-1.5 text-slate-700 leading-relaxed font-medium">
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold">১.</span>
                      <span><strong>Safari</strong> ব্রাউজারে ওপেন করে নিচের <strong>Share (↑)</strong> আইকনে ট্যাপ করুন।</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold">২.</span>
                      <span>নিচে স্ক্রোল করে <strong>"Add to Home Screen"</strong> নির্বাচন করে <strong>"Add"</strong> চাপুন।</span>
                    </li>
                  </ol>
                </div>
              )}

              {/* Advantages */}
              <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3 text-[11px] text-[#1e3a8a]">
                <div className="font-bold mb-1 flex items-center gap-1.5 text-[#1e3a8a]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1d4ed8]" />
                  <span>PWA ইনস্টল করার সুবিধাসমূহ:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-800">
                  <div>✓ ব্রাউজার বার ছাড়া ফুল-স্ক্রিন অ্যাপ মোড</div>
                  <div>✓ দ্রুত টিকিট বুকিং ও প্রিন্ট</div>
                  <div>✓ অফলাইন ও দ্রুত ক্যাশ লোডিং</div>
                  <div>✓ হোম স্ক্রিন থেকে এক-ক্লিক ওপেন</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 bg-[#f8fafc] px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-h-[44px] px-4 py-2 bg-white hover:bg-[#eff6ff] text-slate-900 border border-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>

              <a
                href={directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>নতুন ট্যাবে খুলুন</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
