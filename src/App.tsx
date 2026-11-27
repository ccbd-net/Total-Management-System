import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Sidebar, type NavTab } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { BookingPage } from './pages/BookingPage.tsx';
import { TicketPrintPage } from './pages/TicketPrintPage.tsx';
import { DailySchedulesPage } from './pages/DailySchedulesPage.tsx';
import { ScheduleMakerPage } from './pages/ScheduleMakerPage.tsx';
import { ReconciliationPage } from './pages/ReconciliationPage.tsx';
import { CountersPage } from './pages/CountersPage.tsx';
import { VehiclesPage } from './pages/VehiclesPage.tsx';
import { RoutesPage } from './pages/RoutesPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { CompanyAdminPage } from './pages/CompanyAdminPage.tsx';
import { DatabasePage } from './pages/DatabasePage.tsx';
import { FuelManagementPage } from './pages/FuelManagementPage.tsx';
import { PWAInstallBanner } from './components/PWAInstallBanner.tsx';

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'ড্যাশবোর্ড',
  company_admin: 'কোম্পানি ও সাবস্ক্রিপশন এডমিন',
  seat_booking: 'সিট বুকিং',
  ticket_print: 'টিকিট প্রিন্ট',
  daily_schedules: 'দৈনিক ট্রিপ শিডিউল ও ফিরতি লগ',
  schedule_maker: 'শিডিউল মেকার',
  reconciliation: 'ট্রিপ হিসাব সমন্বয়',
  fuel_management: 'জ্বালানি ব্যবস্থাপনা ও ডিজেল লগ',
  counters: 'কাউন্টার ব্যবস্থাপনা',
  vehicles: 'গাড়ি ব্যবস্থাপনা',
  routes: 'রুট ব্যবস্থাপনা',
  users: 'ইউজার ও সুপারভাইজার',
  database: 'ডাটাবেইজ — ট্রিপ ও রুট সমন্বয় রেকর্ড',
  settings: 'সিস্টেম সেটিংস',
};

const VALID_TABS = new Set<NavTab>(Object.keys(TAB_TITLES) as NavTab[]);

function MainLayout() {
  const { user, loading, isFuelManager, isChecker, isSuperAdmin, isMasterAdmin, isModerator, canManageTrips, canManageFuel } = useAuth();
  const [currentTab, setCurrentTabState] = useState<NavTab>(() => {
    try {
      const saved = localStorage.getItem('zb_active_tab') as NavTab | null;
      if (saved && VALID_TABS.has(saved)) return saved;
    } catch {}
    return 'dashboard';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const setCurrentTab = (tab: NavTab) => {
    try {
      localStorage.setItem('zb_active_tab', tab);
    } catch {}
    setCurrentTabState(tab);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#f0f9f6] flex flex-col items-center justify-center text-slate-900 p-4">
        <div className="w-full max-w-xs bg-white border border-emerald-200 rounded-2xl overflow-hidden shadow-lg text-center">
          <div className="h-1.5 w-full bg-[#0d9488]" />
          <div className="p-6">
            <img
              src="/assets/aistudio/1795651588938_2_f0f59799.jpg"
              alt="Vehicles Management System"
              className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-emerald-200 mx-auto mb-3"
            />
            <div className="w-6 h-6 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
            <div className="text-xs font-bold text-slate-900 tracking-wide">
              Vehicles Management System লোড হচ্ছে...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const isTabAllowed = (tab: NavTab): boolean => {
    if (isFuelManager) {
      return tab === 'dashboard' || tab === 'fuel_management' || tab === 'daily_schedules' || tab === 'database';
    }
    if (isChecker) {
      return tab === 'dashboard' || tab === 'seat_booking' || tab === 'ticket_print' || tab === 'daily_schedules' || tab === 'database';
    }
    if (tab === 'company_admin') return isSuperAdmin;
    if (tab === 'settings') return isMasterAdmin;
    if (tab === 'schedule_maker' || tab === 'routes') return canManageTrips;
    if (tab === 'fuel_management') return canManageFuel;
    if (tab === 'reconciliation' || tab === 'counters' || tab === 'vehicles' || tab === 'users') return isModerator;
    return true;
  };

  const effectiveTab: NavTab = isTabAllowed(currentTab)
    ? currentTab
    : isFuelManager
    ? 'fuel_management'
    : 'dashboard';

  const navigateTo = (tab: NavTab) => {
    setCurrentTab(tab);
  };

  const renderCurrentPage = () => {
    switch (effectiveTab) {
      case 'dashboard':
        return <DashboardPage onNavigateTo={navigateTo} />;
      case 'company_admin':
        return <CompanyAdminPage />;
      case 'seat_booking':
        return <BookingPage />;
      case 'ticket_print':
        return <TicketPrintPage />;
      case 'daily_schedules':
        return (
          <DailySchedulesPage
            onSelectTripForBooking={() => {
              setCurrentTab('seat_booking');
            }}
          />
        );
      case 'schedule_maker':
        return (
          <ScheduleMakerPage
            onScheduleCreated={() => {
              setCurrentTab('daily_schedules');
            }}
          />
        );
      case 'reconciliation':
        return <ReconciliationPage />;
      case 'fuel_management':
        return <FuelManagementPage />;
      case 'counters':
        return <CountersPage />;
      case 'vehicles':
        return <VehiclesPage />;
      case 'routes':
        return <RoutesPage />;
      case 'users':
        return <UsersPage />;
      case 'database':
        return <DatabasePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigateTo={navigateTo} />;
    }
  };

  return (
    <div className="h-[100dvh] w-full max-w-full bg-[#f0f9f6] text-slate-900 flex overflow-hidden">
      {/* Deep Forest-Green Sidebar Navigation */}
      <Sidebar
        currentTab={effectiveTab}
        onSelectTab={setCurrentTab}
        isOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Shell with Fixed Top Header */}
      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full h-full overflow-hidden">
        <div className="shrink-0 z-30">
          <PWAInstallBanner />
          <Header
            pageTitle={TAB_TITLES[effectiveTab] || 'Vehicles Management System'}
            onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          />
        </div>

        <main className="vms-excel-shell flex-1 overflow-y-auto overflow-x-clip p-2 sm:p-3.5 lg:p-4 max-w-7xl mx-auto w-full min-w-0">
          {renderCurrentPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
