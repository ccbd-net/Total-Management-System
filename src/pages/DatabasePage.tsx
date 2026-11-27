import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import type { Schedule, Vehicle, RouteItem, FuelEntry, FuelSettings } from '../types/index.ts';
import {
  formatTaka,
  toBengaliDigits,
  getTodayDhakaDate,
  formatBengaliDate,
  formatTime12Hour,
} from '../utils/formatters.ts';
import { downloadElementAsPDF, printElementById } from '../utils/pdfGenerator.ts';
import {
  formatSignedFuelCostDiff,
  normalizeRegNo,
  type OwnerReportSummaryItem,
} from '../utils/whatsapp.ts';
import { OwnerWhatsAppModal } from '../components/OwnerWhatsAppModal.tsx';
import { DateInput } from '../components/DateInput.tsx';
import {
  Database,
  Calendar,
  Clock,
  Bus,
  User,
  Search,
  Printer,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Moon,
  Info,
  Route as RouteIcon,
  TrendingUp,
  Award,
  MessageCircle,
  X,
} from 'lucide-react';

export interface DatabaseRow {
  id: string;
  autoSerial: number;
  dateDisplay: string;
  operationalDate: string; // The date when the trip is counted
  isNightHold: boolean;
  vehicleRegNo: string;
  vehicleOwnerName?: string;
  vehicleOwnerPhone?: string;
  upTime: string;
  upTripNo?: string;
  downTime: string;
  downTripNo?: string;
  timeDiffDisplay: string;
  timeDiffMinutes: number;
  routeMerged: string;
  distanceKmDisplay: string;
  totalDistanceKm: number;
  upSeatsAndFare: string;
  upBookedSeats: number;
  upSeatFare: number;
  upCargoFare: number;
  upFare: number;
  downSeatsAndFare: string;
  downBookedSeats: number;
  downSeatFare: number;
  downCargoFare: number;
  downFare: number;
  totalSeatsAndFare: string;
  combinedSeats: number;
  combinedSeatFare: number;
  combinedCargoFare: number;
  combinedFare: number;
  fuelExpectedCost: number;
  fuelActualCost: number;
  fuelCostDiff: number | null;
  supervisorDisplay: string;
  driverDisplay: string;
  isFullTrip: boolean; // True when UP + DOWN paired and completed
  status: string;
}

// Convert "07:30 AM" or "04:00 PM" into minutes from 00:00
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// Calculate time difference between UP time and DOWN time
function calculateTimeDifference(upTime: string, downTime: string, isNightHold: boolean): { display: string; minutes: number } {
  if (!upTime || !downTime || downTime.includes('অপেক্ষমাণ') || downTime.includes('আগামীকাল')) {
    return { display: 'নির্ধারিত হয়নি', minutes: 0 };
  }

  const upMin = timeToMinutes(upTime);
  let downMin = timeToMinutes(downTime);

  let diffMinutes = 0;
  if (isNightHold) {
    // Night hold: Down trip is next day
    diffMinutes = (1440 + downMin) - upMin;
  } else {
    // Same day trip
    if (downMin >= upMin) {
      diffMinutes = downMin - upMin;
    } else {
      // Overnight or return later
      diffMinutes = (1440 + downMin) - upMin;
    }
  }

  if (diffMinutes < 0) diffMinutes = 0;

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;

  const display = `${toBengaliDigits(hours)} ঘণ্টা ${mins > 0 ? `${toBengaliDigits(mins)} মিনিট` : '০০ মিনিট'}`;
  return { display, minutes: diffMinutes };
}

// Clean up parenthesis details like (ভায়া পদ্মা সেতু)
function cleanRouteName(str: string): string {
  if (!str) return '';
  return str.replace(/\([^)]*\)/g, '').trim();
}

// Intelligent Route Merging according to user instructions:
// (মাদারীপুর - গুলিস্থান + গুলিস্থান - মাদারীপুর = মাদারীপুর - গুলিস্থান - মাদারীপুর ১টি পুর্নাঙ্গ ট্রিপ)
// (কালকিনি - কদমতলী + গুলিস্থান - মাদারীপুর = কালকিনি - কদমতলী - গুলিস্থান - মাদারীপুর ১টি পুর্নাঙ্গ ট্রিপ)
function mergeRoutes(upRouteName: string, downRouteName: string): string {
  if (!upRouteName && !downRouteName) return 'রুট সমন্বয় অপেক্ষমাণ';
  if (!upRouteName) return `${downRouteName} (ডাউন ট্রিপ)`;
  if (!downRouteName) return `${upRouteName} (আপ ট্রিপ - ফিরতি অপেক্ষমাণ)`;

  const upClean = cleanRouteName(upRouteName);
  const downClean = cleanRouteName(downRouteName);

  const splitStops = (str: string) => {
    return str
      .split(/[-➜→]/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const upStops = splitStops(upClean);
  const downStops = splitStops(downClean);

  if (upStops.length === 0 && downStops.length === 0) return 'মাদারীপুর - ঢাকা - মাদারীপুর (১টি পূর্ণাঙ্গ ট্রিপ)';
  if (upStops.length === 0) return downStops.join(' - ');
  if (downStops.length === 0) return upStops.join(' - ');

  const upLast = upStops[upStops.length - 1];
  const downFirst = downStops[0];

  let consolidated = '';
  // If the last stop of UP is the same as first stop of DOWN (e.g. গুলিস্থান == গুলিস্থান)
  if (upLast.toLowerCase() === downFirst.toLowerCase()) {
    const merged = [...upStops, ...downStops.slice(1)];
    consolidated = merged.join(' - ');
  } else {
    // If different (e.g. কদমতলী and গুলিস্থান) -> কালকিনি - কদমতলী - গুলিস্থান - মাদারীপুর
    const merged = [...upStops, ...downStops];
    consolidated = merged.join(' - ');
  }

  return `${upClean} + ${downClean} = ${consolidated} (১টি পূর্ণাঙ্গ ট্রিপ)`;
}

// Calculate yesterday's date
function getYesterdayDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// Calculate tomorrow's date
function getTomorrowDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// Helper to determine route distance in KM
function getRouteDistance(routes: RouteItem[], routeId?: string, routeName?: string): number {
  if (routeId) {
    const found = routes.find((r) => r.id === routeId);
    if (found?.distanceKm && found.distanceKm > 0) return found.distanceKm;
  }
  if (routeName) {
    const found = routes.find((r) => r.name.toLowerCase() === routeName.toLowerCase());
    if (found?.distanceKm && found.distanceKm > 0) return found.distanceKm;
    const name = routeName.toLowerCase();
    if (name.includes('কালকিনি') || name.includes('সাহেবরামপুর')) return 125;
    if (name.includes('মাদারীপুর') && (name.includes('ঢাকা') || name.includes('গুলিস্তান') || name.includes('সায়দাবাদ') || name.includes('কদমতলী'))) return 110;
    if (name.includes('বরিশাল')) return 180;
  }
  return 110; // Default realistic distance in KM
}

function getScheduleFareBreakdown(s?: Schedule): { seat: number; cargo: number; total: number } {
  if (!s) return { seat: 0, cargo: 0, total: 0 };
  const cargo = Math.max(0, Number(s.totalCargoCollection) || 0);
  const total = Math.max(0, Number(s.totalCollection) || 0);
  const seat =
    s.totalSeatCollection !== undefined && s.totalSeatCollection !== null
      ? Math.max(0, Number(s.totalSeatCollection) || 0)
      : Math.max(0, total - cargo);
  return { seat, cargo, total: seat + cargo };
}

export const DatabasePage: React.FC = () => {
  const { user, isMasterAdmin } = useAuth();
  const [date, setDate] = useState<string>(getTodayDhakaDate());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [fuelSettings, setFuelSettings] = useState<FuelSettings>({ commonMileage: 4, fuelPricePerLiter: 135.4 });
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [vehicleFilter, setVehicleFilter] = useState<string>('ALL');
  const [tripTypeFilter, setTripTypeFilter] = useState<'ALL' | 'FULL_TRIPS' | 'NIGHT_HOLD' | 'PENDING'>('ALL');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);

  // AI Insights State
  const [aiReport, setAiReport] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);

  // Load schedules, vehicles, routes, and fuel entries
  const fetchData = async () => {
    setLoading(true);
    try {
      const yesterday = getYesterdayDate(date);
      const [schRes, vehRes, routeRes, fuelRes, fuelSettRes] = await Promise.all([
        api.getSchedules({ date }),
        api.getVehicles(),
        api.getRoutes(),
        api.getFuelEntries({ startDate: yesterday, endDate: date }).catch(() => ({ entries: [] })),
        api.getFuelSettings().catch(() => ({ settings: { commonMileage: 4, fuelPricePerLiter: 135.4 } })),
      ]);
      setSchedules(schRes.schedules || []);
      setVehicles(vehRes.vehicles || []);
      setRoutes(routeRes.routes || []);
      setFuelEntries(fuelRes.entries || []);
      if (fuelSettRes?.settings) {
        setFuelSettings(fuelSettRes.settings);
      }
    } catch (err) {
      console.error('Failed to load database records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  // Construct Data Table rows implementing the exact Night Hold logic:
  // - If an UP trip (e.g. 1-11-26) has isNightHold: true, its round trip completes on return day (2-11-26).
  // - Therefore, on 2-11-26, it is counted as a completed full round trip!
  // - On 1-11-26, it is marked as awaiting return next day and does NOT count as a completed full trip.
  // - Exactly 13 specified columns:
  //   তারিখ - গাড়ি নাম্বার - নাইট হোল্ড - আপ ট্রিপ সময় - ডাউন ট্রিপ সময় - সময় ব্যবধান (আপ সময় - ডাউন সময়) -
  //   রুট (আপ ট্রিপ রুট + ডাউন ট্রিপ রুট) - মোট দুরত্ব (আপ রুট কিমি + ডাউন ট্রিপ কিমি) -
  //   আপ ট্রিপ সিট বুকিং সংখ্যা + মোট ভাড়া - ডাউন ট্রিপ সিট বুকিং সংখ্যা + মোট ভাড়া -
  //   মোট সিট বুকিং ও মোট ভাড়ার টাকা - সুপারভাইজার - ড্রাইভার
  const tableRows: DatabaseRow[] = useMemo(() => {
    const rows: DatabaseRow[] = [];
    const yesterday = getYesterdayDate(date);
    const tomorrow = getTomorrowDate(date);

    const vehicleByReg = new Map<string, Vehicle>();
    vehicles.forEach((v) => {
      vehicleByReg.set(normalizeRegNo(v.regNo), v);
    });

    const getFuelForVehicleOnDate = (vehReg: string, targetDate: string) => {
      const normReg = normalizeRegNo(vehReg);
      const matched = fuelEntries.filter(
        (f) => normalizeRegNo(f.vehicleRegNo) === normReg && f.date === targetDate
      );
      if (matched.length === 0) {
        return { expectedCost: 0, actualCost: 0, costDiff: null as number | null };
      }
      let expectedCost = 0;
      let actualCost = 0;
      matched.forEach((f) => {
        const rate = Number(f.fuelRatePerLiter) || fuelSettings.fuelPricePerLiter || 135.4;
        const exp =
          f.expectedFuelCost !== undefined && f.expectedFuelCost !== null
            ? Math.round(Number(f.expectedFuelCost))
            : Math.round((Number(f.expectedFuelLiters) || 0) * rate);
        const act =
          Number(f.totalCost) || Math.round((Number(f.actualFuelLiters) || 0) * rate);
        expectedCost += exp;
        actualCost += act;
      });
      return { expectedCost, actualCost, costDiff: expectedCost - actualCost };
    };

    // Group schedules by vehicle
    const vehicleGroups = new Map<string, {
      yesterdayNightHoldUp: Schedule[];
      todayUpRegular: Schedule[];
      todayUpNightHold: Schedule[];
      todayDown: Schedule[];
    }>();

    schedules.forEach((sch) => {
      const reg = sch.vehicleRegNo;
      if (!vehicleGroups.has(reg)) {
        vehicleGroups.set(reg, {
          yesterdayNightHoldUp: [],
          todayUpRegular: [],
          todayUpNightHold: [],
          todayDown: [],
        });
      }
      const group = vehicleGroups.get(reg)!;

      if (sch.direction === 'UP') {
        if (sch.isNightHold) {
          if (sch.date === yesterday || sch.date < date) {
            // Yesterday's night-hold UP trip returning on this operational date
            group.yesterdayNightHoldUp.push(sch);
          } else {
            // Initiated today, returns tomorrow
            group.todayUpNightHold.push(sch);
          }
        } else {
          group.todayUpRegular.push(sch);
        }
      } else {
        // DOWN trips for this date
        if (sch.date === date) {
          group.todayDown.push(sch);
        }
      }
    });

    let autoSl = 1;

    vehicleGroups.forEach((group, vehReg) => {
      // 1. Process yesterday's Night Hold UP trips that return today
      // Rule: Tripped counted on today (return day)
      group.yesterdayNightHoldUp.forEach((upTrip) => {
        const downTrip = group.todayDown.shift();
        const isNightHold = true;
        const isFullTrip = Boolean(downTrip);

        const dateDisplay = downTrip
          ? `${formatBengaliDate(yesterday)} (আপ) + ${formatBengaliDate(date)} (ডাউন)`
          : `${formatBengaliDate(yesterday)} (আপ) [আজ ${formatBengaliDate(date)} ডাউন অপেক্ষমাণ]`;

        const upTime = `${formatTime12Hour(upTrip.departureTime)} ${upTrip.tripSequenceLabel ? `(${upTrip.tripSequenceLabel})` : ''}`;
        const downTime = downTrip ? `${formatTime12Hour(downTrip.departureTime)}` : 'ডাউন ট্রিপ অপেক্ষমাণ';

        const { display: timeDiffDisplay, minutes: timeDiffMinutes } =
          downTrip
            ? calculateTimeDifference(upTrip.departureTime, downTrip.departureTime, isNightHold)
            : { display: 'নির্ধারিত হয়নি', minutes: 0 };

        const upRoute = upTrip.routeName || '';
        const downRoute = downTrip?.routeName || '';
        const routeMerged = mergeRoutes(upRoute, downRoute);

        // Distance in KM
        const upKm = getRouteDistance(routes, upTrip.routeId, upTrip.routeName);
        const downKm = downTrip ? getRouteDistance(routes, downTrip.routeId, downTrip.routeName) : 0;
        const totalDistanceKm = upKm + downKm;
        const distanceKmDisplay = downTrip
          ? `${toBengaliDigits(upKm)} কিমি + ${toBengaliDigits(downKm)} কিমি = ${toBengaliDigits(totalDistanceKm)} কিমি`
          : `${toBengaliDigits(upKm)} কিমি`;

        // Seats & Fares (Seat + Cargo = Total)
        const upBookedSeats = upTrip.totalBookedSeats || 0;
        const upFares = getScheduleFareBreakdown(upTrip);
        const downBookedSeats = downTrip?.totalBookedSeats || 0;
        const downFares = getScheduleFareBreakdown(downTrip);
        const combinedSeats = upBookedSeats + downBookedSeats;
        const combinedSeatFare = upFares.seat + downFares.seat;
        const combinedCargoFare = upFares.cargo + downFares.cargo;
        const combinedFare = combinedSeatFare + combinedCargoFare;

        const upSeatsAndFare = `${toBengaliDigits(upBookedSeats)} সিট | ${formatTaka(upFares.total)}`;
        const downSeatsAndFare = downTrip
          ? `${toBengaliDigits(downBookedSeats)} সিট | ${formatTaka(downFares.total)}`
          : '-';
        const totalSeatsAndFare = `${toBengaliDigits(combinedSeats)} সিট | ${formatTaka(combinedFare)}`;

        // Supervisor
        const upSup = upTrip.supervisor || '';
        const downSup = downTrip?.supervisor || '';
        let supervisorDisplay = '';
        if (downTrip && upSup && downSup) {
          supervisorDisplay = upSup === downSup ? upSup : `আপ: ${upSup} | ডাউন: ${downSup}`;
        } else {
          supervisorDisplay = upSup || downSup || '-';
        }

        // Driver
        const upDrv = upTrip.driver || '';
        const downDrv = downTrip?.driver || '';
        let driverDisplay = '';
        if (downTrip && upDrv && downDrv) {
          driverDisplay = upDrv === downDrv ? upDrv : `আপ: ${upDrv} | ডাউন: ${downDrv}`;
        } else {
          driverDisplay = upDrv || downDrv || '-';
        }

        const matchedVeh = vehicleByReg.get(normalizeRegNo(vehReg));
        const owner = upTrip.vehicleOwnerName || downTrip?.vehicleOwnerName || matchedVeh?.ownerName || 'সাধারণ';
        const fuelInfo = getFuelForVehicleOnDate(vehReg, date);

        rows.push({
          id: `row-nh-${autoSl}-${vehReg}`,
          autoSerial: autoSl++,
          dateDisplay,
          operationalDate: date,
          isNightHold: true,
          vehicleRegNo: vehReg,
          vehicleOwnerName: owner,
          vehicleOwnerPhone: matchedVeh?.ownerPhone,
          upTime,
          upTripNo: upTrip.tripNo,
          downTime,
          downTripNo: downTrip?.tripNo,
          timeDiffDisplay,
          timeDiffMinutes,
          routeMerged,
          distanceKmDisplay,
          totalDistanceKm,
          upSeatsAndFare,
          upBookedSeats,
          upSeatFare: upFares.seat,
          upCargoFare: upFares.cargo,
          upFare: upFares.total,
          downSeatsAndFare,
          downBookedSeats,
          downSeatFare: downFares.seat,
          downCargoFare: downFares.cargo,
          downFare: downFares.total,
          totalSeatsAndFare,
          combinedSeats,
          combinedSeatFare,
          combinedCargoFare,
          combinedFare,
          fuelExpectedCost: fuelInfo.expectedCost,
          fuelActualCost: fuelInfo.actualCost,
          fuelCostDiff: fuelInfo.costDiff,
          supervisorDisplay,
          driverDisplay,
          isFullTrip,
          status: isFullTrip ? 'সমন্বিত (নাইট হোল্ড পূর্ণাঙ্গ ট্রিপ)' : 'ডাউন ট্রিপ অপেক্ষমাণ',
        });
      });

      // 2. Process Regular same-day UP trips paired with remaining today DOWN trips
      const regularPairsCount = Math.max(group.todayUpRegular.length, group.todayDown.length);
      for (let i = 0; i < regularPairsCount; i++) {
        const upTrip = group.todayUpRegular[i];
        const downTrip = group.todayDown[i];
        const isFullTrip = Boolean(upTrip && downTrip);
        const isNightHold = false;

        const dateDisplay = formatBengaliDate(date);
        const upTime = upTrip
          ? `${formatTime12Hour(upTrip.departureTime)} ${upTrip.tripSequenceLabel ? `(${upTrip.tripSequenceLabel})` : ''}`
          : '-';
        const downTime = downTrip ? `${formatTime12Hour(downTrip.departureTime)}` : 'ডাউন ট্রিপ অপেক্ষমাণ';

        const { display: timeDiffDisplay, minutes: timeDiffMinutes } =
          upTrip && downTrip
            ? calculateTimeDifference(upTrip.departureTime, downTrip.departureTime, isNightHold)
            : { display: 'নির্ধারিত হয়নি', minutes: 0 };

        const upRoute = upTrip?.routeName || '';
        const downRoute = downTrip?.routeName || '';
        const routeMerged = mergeRoutes(upRoute, downRoute);

        // Distance in KM
        const upKm = upTrip ? getRouteDistance(routes, upTrip.routeId, upTrip.routeName) : 0;
        const downKm = downTrip ? getRouteDistance(routes, downTrip.routeId, downTrip.routeName) : 0;
        const totalDistanceKm = upKm + downKm;
        const distanceKmDisplay =
          upTrip && downTrip
            ? `${toBengaliDigits(upKm)} কিমি + ${toBengaliDigits(downKm)} কিমি = ${toBengaliDigits(totalDistanceKm)} কিমি`
            : `${toBengaliDigits(upKm || downKm)} কিমি`;

        // Seats & Fares (Seat + Cargo = Total)
        const upBookedSeats = upTrip?.totalBookedSeats || 0;
        const upFares = getScheduleFareBreakdown(upTrip);
        const downBookedSeats = downTrip?.totalBookedSeats || 0;
        const downFares = getScheduleFareBreakdown(downTrip);
        const combinedSeats = upBookedSeats + downBookedSeats;
        const combinedSeatFare = upFares.seat + downFares.seat;
        const combinedCargoFare = upFares.cargo + downFares.cargo;
        const combinedFare = combinedSeatFare + combinedCargoFare;

        const upSeatsAndFare = upTrip ? `${toBengaliDigits(upBookedSeats)} সিট | ${formatTaka(upFares.total)}` : '-';
        const downSeatsAndFare = downTrip ? `${toBengaliDigits(downBookedSeats)} সিট | ${formatTaka(downFares.total)}` : '-';
        const totalSeatsAndFare = `${toBengaliDigits(combinedSeats)} সিট | ${formatTaka(combinedFare)}`;

        // Supervisor
        const upSup = upTrip?.supervisor || '';
        const downSup = downTrip?.supervisor || '';
        let supervisorDisplay = '';
        if (upTrip && downTrip && upSup && downSup) {
          supervisorDisplay = upSup === downSup ? upSup : `আপ: ${upSup} | ডাউন: ${downSup}`;
        } else {
          supervisorDisplay = upSup || downSup || '-';
        }

        // Driver
        const upDrv = upTrip?.driver || '';
        const downDrv = downTrip?.driver || '';
        let driverDisplay = '';
        if (upTrip && downTrip && upDrv && downDrv) {
          driverDisplay = upDrv === downDrv ? upDrv : `আপ: ${upDrv} | ডাউন: ${downDrv}`;
        } else {
          driverDisplay = upDrv || downDrv || '-';
        }

        const matchedVeh = vehicleByReg.get(normalizeRegNo(vehReg));
        const owner = upTrip?.vehicleOwnerName || downTrip?.vehicleOwnerName || matchedVeh?.ownerName || 'সাধারণ';
        const fuelInfo = getFuelForVehicleOnDate(vehReg, date);

        rows.push({
          id: `row-reg-${autoSl}-${vehReg}-${i}`,
          autoSerial: autoSl++,
          dateDisplay,
          operationalDate: date,
          isNightHold: false,
          vehicleRegNo: vehReg,
          vehicleOwnerName: owner,
          vehicleOwnerPhone: matchedVeh?.ownerPhone,
          upTime,
          upTripNo: upTrip?.tripNo,
          downTime,
          downTripNo: downTrip?.tripNo,
          timeDiffDisplay,
          timeDiffMinutes,
          routeMerged,
          distanceKmDisplay,
          totalDistanceKm,
          upSeatsAndFare,
          upBookedSeats,
          upSeatFare: upFares.seat,
          upCargoFare: upFares.cargo,
          upFare: upFares.total,
          downSeatsAndFare,
          downBookedSeats,
          downSeatFare: downFares.seat,
          downCargoFare: downFares.cargo,
          downFare: downFares.total,
          totalSeatsAndFare,
          combinedSeats,
          combinedSeatFare,
          combinedCargoFare,
          combinedFare,
          fuelExpectedCost: fuelInfo.expectedCost,
          fuelActualCost: fuelInfo.actualCost,
          fuelCostDiff: fuelInfo.costDiff,
          supervisorDisplay,
          driverDisplay,
          isFullTrip,
          status: isFullTrip
            ? 'সমন্বিত (রেগুলার পূর্ণাঙ্গ ট্রিপ)'
            : upTrip
            ? 'ডাউন ট্রিপ অপেক্ষমাণ'
            : 'শুধুমাত্র ডাউন ট্রিপ',
        });
      }

      // 3. Process today's Night Hold UP trips (initiated today, returning tomorrow)
      // Rule: Will be counted tomorrow, shown today with awaiting tag
      group.todayUpNightHold.forEach((upTrip) => {
        const isNightHold = true;
        const isFullTrip = false; // Returns tomorrow!
        const dateDisplay = `${formatBengaliDate(date)} (আপ) [ফিরতি দিন: ${formatBengaliDate(tomorrow)}]`;
        const upTime = `${formatTime12Hour(upTrip.departureTime)} ${upTrip.tripSequenceLabel ? `(${upTrip.tripSequenceLabel})` : ''}`;
        const downTime = `আগামীকাল ফিরতি ট্রিপ (${formatBengaliDate(tomorrow)})`;
        const timeDiffDisplay = 'আগামীকাল গণনা হবে';

        const upRoute = upTrip.routeName || '';
        const routeMerged = `${cleanRouteName(upRoute)} (নাইট হোল্ড আপ - ফিরতি দিন ট্রিপ সমন্বয়)`;

        const upKm = getRouteDistance(routes, upTrip.routeId, upTrip.routeName);
        const distanceKmDisplay = `${toBengaliDigits(upKm)} কিমি (আপ)`;

        const upBookedSeats = upTrip.totalBookedSeats || 0;
        const upFares = getScheduleFareBreakdown(upTrip);

        const upSeatsAndFare = `${toBengaliDigits(upBookedSeats)} সিট | ${formatTaka(upFares.total)}`;
        const downSeatsAndFare = '-';
        const totalSeatsAndFare = `${toBengaliDigits(upBookedSeats)} সিট | ${formatTaka(upFares.total)}`;

        const matchedVeh = vehicleByReg.get(normalizeRegNo(vehReg));
        const fuelInfo = getFuelForVehicleOnDate(vehReg, date);

        rows.push({
          id: `row-today-nh-${autoSl}-${vehReg}`,
          autoSerial: autoSl++,
          dateDisplay,
          operationalDate: date,
          isNightHold: true,
          vehicleRegNo: vehReg,
          vehicleOwnerName: upTrip.vehicleOwnerName || matchedVeh?.ownerName || 'সাধারণ',
          vehicleOwnerPhone: matchedVeh?.ownerPhone,
          upTime,
          upTripNo: upTrip.tripNo,
          downTime,
          downTripNo: undefined,
          timeDiffDisplay,
          timeDiffMinutes: 0,
          routeMerged,
          distanceKmDisplay,
          totalDistanceKm: upKm,
          upSeatsAndFare,
          upBookedSeats,
          upSeatFare: upFares.seat,
          upCargoFare: upFares.cargo,
          upFare: upFares.total,
          downSeatsAndFare,
          downBookedSeats: 0,
          downSeatFare: 0,
          downCargoFare: 0,
          downFare: 0,
          totalSeatsAndFare,
          combinedSeats: upBookedSeats,
          combinedSeatFare: upFares.seat,
          combinedCargoFare: upFares.cargo,
          combinedFare: upFares.total,
          fuelExpectedCost: fuelInfo.expectedCost,
          fuelActualCost: fuelInfo.actualCost,
          fuelCostDiff: fuelInfo.costDiff,
          supervisorDisplay: upTrip.supervisor || '-',
          driverDisplay: upTrip.driver || '-',
          isFullTrip: false, // Counts on tomorrow's date!
          status: 'নাইট হোল্ড (আগামীকাল ফিরতি দিনে ট্রিপ কাউন্ট হবে)',
        });
      });
    });

    return rows;
  }, [schedules, routes, vehicles, fuelEntries, fuelSettings.fuelPricePerLiter, date]);

  // Client Filtered Rows
  const filteredRows = tableRows.filter((row) => {
    if (vehicleFilter !== 'ALL' && row.vehicleRegNo !== vehicleFilter) return false;
    if (tripTypeFilter === 'FULL_TRIPS' && !row.isFullTrip) return false;
    if (tripTypeFilter === 'NIGHT_HOLD' && !row.isNightHold) return false;
    if (tripTypeFilter === 'PENDING' && row.isFullTrip) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      row.vehicleRegNo.toLowerCase().includes(term) ||
      row.routeMerged.toLowerCase().includes(term) ||
      row.supervisorDisplay.toLowerCase().includes(term) ||
      row.driverDisplay.toLowerCase().includes(term) ||
      (row.vehicleOwnerName && row.vehicleOwnerName.toLowerCase().includes(term))
    );
  });

  // KPI Calculations
  const stats = useMemo(() => {
    const fullTrips = tableRows.filter((r) => r.isFullTrip).length;
    const nightHoldTrips = tableRows.filter((r) => r.isNightHold && r.isFullTrip).length;
    const pendingTrips = tableRows.filter((r) => !r.isFullTrip).length;
    const totalSeats = tableRows.reduce((sum, r) => sum + r.combinedSeats, 0);
    const totalSeatFare = tableRows.reduce((sum, r) => sum + r.combinedSeatFare, 0);
    const totalCargoFare = tableRows.reduce((sum, r) => sum + r.combinedCargoFare, 0);
    const totalFare = totalSeatFare + totalCargoFare;
    const totalDistance = tableRows.reduce((sum, r) => sum + r.totalDistanceKm, 0);

    return {
      fullTrips,
      nightHoldTrips,
      pendingTrips,
      totalSeats,
      totalSeatFare,
      totalCargoFare,
      totalFare,
      totalDistance,
    };
  }, [tableRows]);

  // Filtered rows totals for the table footer
  const filteredTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.fullTrips += r.isFullTrip ? 1 : 0;
        acc.distance += r.totalDistanceKm;
        acc.upSeats += r.upBookedSeats;
        acc.upFare += r.upFare;
        acc.downSeats += r.downBookedSeats;
        acc.downFare += r.downFare;
        acc.totalSeats += r.combinedSeats;
        acc.totalSeatFare += r.combinedSeatFare;
        acc.totalCargoFare += r.combinedCargoFare;
        acc.totalFare += r.combinedFare;
        if (r.fuelCostDiff !== null) {
          acc.fuelDiff += r.fuelCostDiff;
          acc.hasFuelData = true;
        }
        return acc;
      },
      {
        fullTrips: 0,
        distance: 0,
        upSeats: 0,
        upFare: 0,
        downSeats: 0,
        downFare: 0,
        totalSeats: 0,
        totalSeatFare: 0,
        totalCargoFare: 0,
        totalFare: 0,
        fuelDiff: 0,
        hasFuelData: false,
      }
    );
  }, [filteredRows]);

  const whatsappOwnerItems: OwnerReportSummaryItem[] = useMemo(() => {
    const grouped = new Map<
      string,
      {
        ownerName: string;
        ownerPhone: string;
        vehicles: Set<string>;
        tripCount: number;
        bookedSeats: number;
        seatFare: number;
        cargoFare: number;
        totalFare: number;
        fuelExpectedCost: number;
        fuelActualCost: number;
        fuelCostDiff: number;
        hasFuel: boolean;
      }
    >();

    filteredRows.forEach((r) => {
      const ownerName = r.vehicleOwnerName || 'সাধারণ';
      if (!grouped.has(ownerName)) {
        grouped.set(ownerName, {
          ownerName,
          ownerPhone: r.vehicleOwnerPhone || '',
          vehicles: new Set(),
          tripCount: 0,
          bookedSeats: 0,
          seatFare: 0,
          cargoFare: 0,
          totalFare: 0,
          fuelExpectedCost: 0,
          fuelActualCost: 0,
          fuelCostDiff: 0,
          hasFuel: false,
        });
      }
      const g = grouped.get(ownerName)!;
      g.vehicles.add(r.vehicleRegNo);
      if (!g.ownerPhone && r.vehicleOwnerPhone) g.ownerPhone = r.vehicleOwnerPhone;
      g.tripCount += r.isFullTrip ? 1 : 0;
      g.bookedSeats += r.combinedSeats;
      g.seatFare += r.combinedSeatFare;
      g.cargoFare += r.combinedCargoFare;
      g.totalFare += r.combinedFare;
      if (r.fuelCostDiff !== null) {
        g.fuelExpectedCost += r.fuelExpectedCost;
        g.fuelActualCost += r.fuelActualCost;
        g.fuelCostDiff += r.fuelCostDiff;
        g.hasFuel = true;
      }
    });

    return Array.from(grouped.values()).map((g) => ({
      ownerName: g.ownerName,
      ownerPhone: g.ownerPhone,
      vehicles: Array.from(g.vehicles),
      tripCount: g.tripCount || 1,
      bookedSeats: g.bookedSeats,
      seatFare: g.seatFare,
      cargoFare: g.cargoFare,
      totalFare: g.totalFare,
      fuelExpectedCost: g.hasFuel ? g.fuelExpectedCost : undefined,
      fuelActualCost: g.hasFuel ? g.fuelActualCost : undefined,
      fuelCostDiff: g.hasFuel ? g.fuelCostDiff : null,
    }));
  }, [filteredRows]);

  // Export CSV with UTF-8 BOM containing Seat + Cargo + Total + Fuel +/- মূল্য columns
  const handleExportCSV = () => {
    const headers = [
      'সিরিয়াল',
      'তারিখ',
      'গাড়ি নাম্বার',
      'নাইট হোল্ড',
      'আপ ট্রিপ সময়',
      'ডাউন ট্রিপ সময়',
      'সময় ব্যবধান (আপ-ডাউন)',
      'রুট (আপ ট্রিপ + ডাউন ট্রিপ)',
      'মোট দূরত্ব (কিমি)',
      'আপ ট্রিপ সিট বুকিং ও ভাড়া',
      'ডাউন ট্রিপ সিট বুকিং ও ভাড়া',
      'মোট সিট সংখ্যা',
      'সিট বুকিং টাকা (৳)',
      'মালের ভাড়া (৳)',
      'মোট টাকা (সিট+মাল) (৳)',
      'ফুয়েল +/- মূল্য (৳)',
      'সুপারভাইজার',
      'ড্রাইভার',
      'স্ট্যাটাস',
    ];

    const rows = filteredRows.map((r) => [
      r.autoSerial,
      r.dateDisplay,
      r.vehicleRegNo,
      r.isNightHold ? 'হ্যাঁ' : 'না',
      r.upTime,
      r.downTime,
      r.timeDiffDisplay,
      `"${r.routeMerged}"`,
      `"${r.distanceKmDisplay}"`,
      `"${r.upSeatsAndFare}"`,
      `"${r.downSeatsAndFare}"`,
      r.combinedSeats,
      r.combinedSeatFare,
      r.combinedCargoFare,
      r.combinedFare,
      r.fuelCostDiff !== null ? r.fuelCostDiff : '-',
      `"${r.supervisorDisplay}"`,
      `"${r.driverDisplay}"`,
      `"${r.status}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trip_database_report_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    printElementById('printable-database-report', `ডাটাবেইজ রিপোর্ট — ${formatBengaliDate(date)}`, 'A4-landscape');
  };

  const handleDownloadPDF = async () => {
    try {
      await downloadElementAsPDF(
        'printable-database-report',
        `Trip-Database-${date}.pdf`,
        'landscape',
        'a4'
      );
    } catch (err) {
      console.error('Database PDF export error:', err);
      printElementById('printable-database-report', `ডাটাবেইজ রিপোর্ট — ${formatBengaliDate(date)}`, 'A4-landscape');
    }
  };

  // Generate AI Summary optionally
  const handleGenerateAi = async () => {
    setAiLoading(true);
    setShowAiModal(true);
    try {
      const res = await api.getAiDailySummary(date);
      setAiReport(res.summary);
    } catch (err: any) {
      setAiReport('এআই বিশ্লেষণ লোড করা যায়নি: ' + (err.message || 'নেটওয়ার্ক সমস্যা'));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3 print:hidden">
      {/* Compact Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#1d4ed8] px-3 py-2 text-white flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="w-4 h-4 shrink-0 text-[#bfdbfe]" />
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold leading-tight truncate text-white">
                ডাটাবেইজ — ট্রিপ সমন্বয়, নাইট হোল্ড ও পুর্নাঙ্গ রিপোর্ট
              </h1>
              <p className="hidden sm:block text-[10px] text-[#dbeafe] leading-tight truncate">
                আপ ও ডাউন ট্রিপ সমন্বয়, নাইট হোল্ড হিসাব, সময় ব্যবধান ও দূরত্ব রেজিস্টার
              </p>
            </div>
          </div>

          {/* Global Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchData}
              className="p-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-lg transition-colors cursor-pointer"
              title="রিফ্রেশ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowWhatsAppModal(true)}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              title="মালিকদের মোবাইল নম্বরে হোয়াটসঅ্যাপে রিপোর্ট পাঠান"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WA মালিক</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-2.5 py-1 bg-white hover:bg-[#eff6ff] text-[#1e3a8a] rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="এক্সেল ডাউনলোড"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#1d4ed8]" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer border border-white/25"
              title="শুধু ডাটা টেবিল পিডিএফ ডাউনলোড করুন"
            >
              <Download className="w-3.5 h-3.5 text-[#bfdbfe]" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1 bg-white hover:bg-[#eff6ff] text-[#1e3a8a] rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              title="শুধু ডাটা টেবিল প্রিন্ট / সেভ PDF"
            >
              <Printer className="w-3.5 h-3.5 text-[#1d4ed8]" />
              <span>প্রিন্ট</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateAi}
              className="px-2.5 py-1 bg-[#1e3a8a] hover:bg-[#1e40af] text-white border border-white/20 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="এআই বিশ্লেষণ"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#bfdbfe]" />
              <span>ইনসাইটস</span>
            </button>
          </div>
        </div>
      </div>

      {/* Excel-Sheet 6-Column KPI Summary Matrix */}
      <div className="bg-slate-200 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px">
          {/* Full Trips Count */}
          <div className="bg-white flex flex-col">
            <div className="bg-[#1e3a8a] px-2.5 py-1 flex items-center justify-between gap-1 text-white">
              <span className="text-[10px] font-bold truncate">আজকের পূর্ণাঙ্গ ট্রিপ</span>
              <Award className="w-3 h-3 shrink-0 opacity-90 text-[#bfdbfe]" />
            </div>
            <div className="px-2.5 py-1.5 flex items-baseline justify-between gap-1">
              <span className="text-sm sm:text-base font-black text-[#1e3a8a] tabular-nums">
                {toBengaliDigits(stats.fullTrips)}
              </span>
              <span className="text-[10px] text-slate-500 truncate">টি ট্রিপ</span>
            </div>
          </div>

          {/* Night Hold Trips */}
          <div className="bg-white flex flex-col">
            <div className="bg-[#1d4ed8] px-2.5 py-1 flex items-center justify-between gap-1 text-white">
              <span className="text-[10px] font-bold truncate">নাইট হোল্ড ট্রিপ</span>
              <Moon className="w-3 h-3 shrink-0 opacity-90" />
            </div>
            <div className="px-2.5 py-1.5 flex items-baseline justify-between gap-1">
              <span className="text-sm sm:text-base font-black text-[#1e3a8a] tabular-nums">
                {toBengaliDigits(stats.nightHoldTrips)}
              </span>
              <span className="text-[10px] text-slate-500 truncate">টি ফিরতি</span>
            </div>
          </div>

          {/* Total Booked Seats */}
          <div className="bg-white flex flex-col">
            <div className="bg-[#1e3a8a] px-2.5 py-1 flex items-center justify-between gap-1 text-white">
              <span className="text-[10px] font-bold truncate">মোট সিট বুকিং</span>
              <User className="w-3 h-3 shrink-0 opacity-90 text-[#bfdbfe]" />
            </div>
            <div className="px-2.5 py-1.5 flex items-baseline justify-between gap-1">
              <span className="text-sm sm:text-base font-black text-[#1e3a8a] tabular-nums">
                {toBengaliDigits(stats.totalSeats)}
              </span>
              <span className="text-[10px] text-slate-500 truncate">টি আসন</span>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white flex flex-col">
            <div className="bg-[#1d4ed8] px-2.5 py-1 flex items-center justify-between gap-1 text-white">
              <span className="text-[10px] font-bold truncate">মোট আদায়</span>
              <TrendingUp className="w-3 h-3 shrink-0 opacity-90" />
            </div>
            <div className="px-2.5 py-1.5">
              <div className="text-sm sm:text-base font-black text-[#1d4ed8] tabular-nums leading-tight">
                {formatTaka(stats.totalFare)}
              </div>
              <div className="text-[9.5px] text-slate-500 tabular-nums truncate">
                সিট: {formatTaka(stats.totalSeatFare)} · মাল: {formatTaka(stats.totalCargoFare)}
              </div>
            </div>
          </div>

          {/* Total Distance */}
          <div className="bg-white flex flex-col">
            <div className="bg-[#1e3a8a] px-2.5 py-1 flex items-center justify-between gap-1 text-white">
              <span className="text-[10px] font-bold truncate">মোট দূরত্ব</span>
              <RouteIcon className="w-3 h-3 shrink-0 opacity-90 text-[#bfdbfe]" />
            </div>
            <div className="px-2.5 py-1.5 flex items-baseline justify-between gap-1">
              <span className="text-sm sm:text-base font-black text-[#1e3a8a] tabular-nums">
                {toBengaliDigits(stats.totalDistance)}
              </span>
              <span className="text-[10px] text-slate-500 truncate">কিমি</span>
            </div>
          </div>

          {/* Pending Trips */}
          <div className="bg-white flex flex-col">
            <div className={`${stats.pendingTrips === 0 ? 'bg-[#1d4ed8]' : 'bg-[#1e40af]'} px-2.5 py-1 flex items-center justify-between gap-1 text-white`}>
              <span className="text-[10px] font-bold truncate">ফিরতি অপেক্ষমাণ</span>
              <Clock className="w-3 h-3 shrink-0 opacity-90" />
            </div>
            <div className="px-2.5 py-1.5 flex items-baseline justify-between gap-1">
              <span className={`text-sm sm:text-base font-black tabular-nums ${stats.pendingTrips === 0 ? 'text-[#1d4ed8]' : 'text-[#1e3a8a]'}`}>
                {toBengaliDigits(stats.pendingTrips)}
              </span>
              <span className="text-[10px] text-slate-500 truncate">
                {stats.pendingTrips === 0 ? 'সমন্বিত' : 'বাকি'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Filter Bar */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-[#f8fafc] px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold">
            <Calendar className="w-3.5 h-3.5 text-[#1d4ed8]" />
            <DateInput
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent outline-none cursor-pointer font-bold text-[#1e3a8a]"
            />
          </div>

          {/* Vehicle Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#f8fafc] px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold">
            <Bus className="w-3.5 h-3.5 text-[#1d4ed8]" />
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer font-bold text-[#1e3a8a]"
            >
              <option value="ALL">সকল গাড়ি</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.regNo}>
                  {v.regNo}
                </option>
              ))}
            </select>
          </div>

          {/* Trip Type Filter */}
          <div className="flex flex-wrap bg-[#f8fafc] p-0.5 rounded-lg text-[11px] font-bold border border-slate-200 gap-0.5">
            <button
              type="button"
              onClick={() => setTripTypeFilter('ALL')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                tripTypeFilter === 'ALL'
                  ? 'bg-[#1d4ed8] text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              সব ({toBengaliDigits(tableRows.length)})
            </button>
            <button
              type="button"
              onClick={() => setTripTypeFilter('FULL_TRIPS')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                tripTypeFilter === 'FULL_TRIPS'
                  ? 'bg-[#1d4ed8] text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              পূর্ণাঙ্গ ({toBengaliDigits(stats.fullTrips)})
            </button>
            <button
              type="button"
              onClick={() => setTripTypeFilter('NIGHT_HOLD')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                tripTypeFilter === 'NIGHT_HOLD'
                  ? 'bg-[#1e3a8a] text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              নাইট হোল্ড ({toBengaliDigits(stats.nightHoldTrips)})
            </button>
            <button
              type="button"
              onClick={() => setTripTypeFilter('PENDING')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                tripTypeFilter === 'PENDING'
                  ? 'bg-[#1e3a8a] text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              ফিরতি বাকি ({toBengaliDigits(stats.pendingTrips)})
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="গাড়ি, রুট, সুপারভাইজার বা ড্রাইভার..."
            className="w-full pl-8 pr-2.5 py-1 bg-[#f8fafc] border border-slate-200 rounded-lg text-[11px] text-slate-900 outline-none focus:bg-white focus:ring-1 focus:ring-[#1d4ed8] font-medium"
          />
        </div>
      </div>

      {/* Main Database Excel Sheet Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Card Header Bar */}
        <div className="bg-[#1e3a8a] px-3 py-2 text-white flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.2 rounded bg-white/15 border border-white/25 text-white font-bold text-[10px] font-mono">
              {toBengaliDigits(filteredRows.length)}
            </span>
            <h3 className="text-xs font-bold">
              ডাটাবেইজ সমন্বয় রেজিস্টার শীট
            </h3>
          </div>

          <div className="text-[10px] text-[#dbeafe] flex items-center gap-1">
            <Info className="w-3 h-3 shrink-0 text-[#93c5fd]" />
            <span>আপ + ডাউন মিলে ১ পূর্ণাঙ্গ ট্রিপ · নাইট হোল্ড ফিরতি দিনে কাউন্ট হয়</span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#1d4ed8]" />
            ডাটাবেইজ লোড হচ্ছে...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 px-6 text-center bg-white">
            {tripTypeFilter === 'PENDING' ? (
              <div className="max-w-md mx-auto p-6 bg-[#eff6ff] rounded-2xl border border-[#bfdbfe]">
                <CheckCircle2 className="w-10 h-10 text-[#1d4ed8] mx-auto mb-2" />
                <h4 className="text-sm font-bold text-[#1e3a8a]">কোনো ট্রিপ অপেক্ষমাণ নেই!</h4>
                <p className="text-xs text-[#1d4ed8] mt-1">
                  আজকের সকল গাড়ির আপ ও ডাউন ট্রিপ সফলভাবে সমন্বয় করা হয়েছে।
                </p>
              </div>
            ) : (
              <div>
                <div className="w-14 h-14 rounded-2xl bg-[#f8fafc] text-[#1d4ed8] border border-slate-200 flex items-center justify-center mx-auto mb-3">
                  <Database className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">ডাটাবেইজে কোনো ট্রিপ এন্ট্রি নেই</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  শিডিউল মেকার থেকে আপ ট্রিপ ও ডাউন কাউন্টার থেকে ফিরতি ট্রিপ তৈরি হলে স্বয়ংক্রিয়ভাবে এখানে পুর্নাঙ্গ সমন্বিত ডাটা প্রদর্শিত হবে।
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Excel Spreadsheet Grid Table with 17 columns */}
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-[#1d4ed8] text-white font-bold border-b border-[#1e40af] sticky top-0 z-10">
                <tr>
                  <th className="px-2.5 py-2.5 text-center w-10 border-r border-blue-600/60">ক্রমিক</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[120px]">তারিখ</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[130px]">গাড়ি নাম্বার</th>
                  <th className="px-2.5 py-2.5 text-center border-r border-blue-600/60 min-w-[80px]">নাইট হোল্ড</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[110px]">আপ ট্রিপ সময়</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[110px]">ডাউন ট্রিপ সময়</th>
                  <th className="px-2.5 py-2.5 text-center border-r border-blue-600/60 min-w-[110px]">সময় ব্যবধান (আপ-ডাউন)</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[200px]">রুট (আপ + ডাউন)</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[130px]">মোট দূরত্ব (কিমি)</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[130px] bg-[#1e40af]">আপ সিট ও ভাড়া</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[130px] bg-[#1e40af]">ডাউন সিট ও ভাড়া</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[110px] text-right bg-[#1e40af]">সিট বুকিং টাকা</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[100px] text-right bg-[#1e40af]">মালের ভাড়া</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[115px] text-right bg-[#1e3a8a] font-black">মোট টাকা</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[105px] text-right bg-[#1e40af]">ফুয়েল +/- মূল্য</th>
                  <th className="px-2.5 py-2.5 border-r border-blue-600/60 min-w-[100px]">সুপারভাইজার</th>
                  <th className="px-2.5 py-2.5 min-w-[100px]">ড্রাইভার</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="odd:bg-white even:bg-[#f1f5f9] hover:bg-[#eff6ff] transition-colors"
                  >
                    {/* 1. ক্রমিক */}
                    <td className="px-2.5 py-2 text-center font-bold text-[#1e3a8a] border-r border-slate-200">
                      <span className="w-5 h-5 rounded bg-[#eff6ff] text-[#1e3a8a] border border-[#bfdbfe] inline-flex items-center justify-center font-mono text-[11px]">
                        {toBengaliDigits(row.autoSerial)}
                      </span>
                    </td>

                    {/* 2. তারিখ */}
                    <td className="px-2.5 py-2 border-r border-slate-200">
                      <div className="font-bold text-slate-900 leading-tight">{row.dateDisplay}</div>
                      {row.isNightHold && (
                        <span className="inline-flex items-center gap-0.5 text-[9.5px] text-white font-bold bg-[#1e3a8a] px-1 rounded mt-0.5">
                          <Moon className="w-2.5 h-2.5 text-[#93c5fd]" />
                          <span>নাইট হোল্ড রিটার্ন</span>
                        </span>
                      )}
                    </td>

                    {/* 3. গাড়ি নাম্বার */}
                    <td className="px-2.5 py-2 border-r border-slate-200">
                      <div className="font-black text-slate-900 font-mono flex items-center gap-1">
                        <Bus className="w-3 h-3 text-[#1d4ed8]" />
                        <span>{row.vehicleRegNo}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        মালিক: <span className="font-semibold text-slate-700">{row.vehicleOwnerName || 'সাধারণ'}</span>
                      </div>
                    </td>

                    {/* 4. নাইট হোল্ড */}
                    <td className="px-2.5 py-2 text-center border-r border-slate-200">
                      {row.isNightHold ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#1e3a8a] text-white shadow-2xs">
                          <Moon className="w-3 h-3 text-[#93c5fd]" />
                          <span>হ্যাঁ</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-semibold">না</span>
                      )}
                    </td>

                    {/* 5. আপ ট্রিপ সময় */}
                    <td className="px-2.5 py-2 border-r border-slate-200">
                      <div className="font-bold text-[#1e3a8a]">{row.upTime}</div>
                      {row.upTripNo && (
                        <div className="text-[10px] text-[#1d4ed8] font-mono">{row.upTripNo}</div>
                      )}
                    </td>

                    {/* 6. ডাউন ট্রিপ সময় */}
                    <td className="px-2.5 py-2 border-r border-slate-200">
                      <div className={`font-bold ${row.downTime.includes('অপেক্ষমাণ') || row.downTime.includes('আগামীকাল') ? 'text-[#1e3a8a]' : 'text-[#1d4ed8]'}`}>
                        {row.downTime}
                      </div>
                      {row.downTripNo && (
                        <div className="text-[10px] text-[#1d4ed8] font-mono">{row.downTripNo}</div>
                      )}
                    </td>

                    {/* 7. সময় ব্যবধান (আপ সময় - ডাউন সময়) */}
                    <td className="px-2.5 py-2 text-center border-r border-slate-200">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#eff6ff] text-[#1e3a8a] font-bold text-[11px] border border-[#bfdbfe]">
                        <Clock className="w-3 h-3 text-[#1d4ed8] shrink-0" />
                        <span>{row.timeDiffDisplay}</span>
                      </div>
                    </td>

                    {/* 8. রুট (আপ ট্রিপ রুট + ডাউন ট্রিপ রুট) */}
                    <td className="px-2.5 py-2 border-r border-slate-200">
                      <div className="font-semibold text-slate-900 text-[11px] leading-snug">
                        {row.routeMerged}
                      </div>
                    </td>

                    {/* 9. মোট দূরত্ব (আপ রুট কিমি + ডাউন ট্রিপ কিমি) */}
                    <td className="px-2.5 py-2 border-r border-slate-200 font-semibold text-slate-800">
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <RouteIcon className="w-3 h-3 text-[#1d4ed8] shrink-0" />
                        <span>{row.distanceKmDisplay}</span>
                      </div>
                    </td>

                    {/* 10. আপ ট্রিপ সিট বুকিং সংখ্যা + মোট ভাড়া */}
                    <td className="px-2.5 py-2 border-r border-slate-200">
                      <div className="font-bold text-[#1e3a8a] text-xs">{row.upSeatsAndFare}</div>
                      {row.upCargoFare > 0 && (
                        <div className="text-[10px] text-slate-600 font-semibold">
                          সিট: {formatTaka(row.upSeatFare)} | মাল: {formatTaka(row.upCargoFare)}
                        </div>
                      )}
                    </td>

                    {/* 11. ডাউন ট্রিপ সিট বুকিং সংখ্যা + মোট ভাড়া */}
                    <td className="px-2.5 py-2 border-r border-slate-200">
                      <div className="font-bold text-[#1d4ed8] text-xs">{row.downSeatsAndFare}</div>
                      {row.downCargoFare > 0 && (
                        <div className="text-[10px] text-slate-600 font-semibold">
                          সিট: {formatTaka(row.downSeatFare)} | মাল: {formatTaka(row.downCargoFare)}
                        </div>
                      )}
                    </td>

                    {/* 12. সিট বুকিং টাকা */}
                    <td className="px-2.5 py-2 border-r border-slate-200 text-right tabular-nums whitespace-nowrap">
                      <div className="font-bold text-[#1e3a8a] text-xs">{formatTaka(row.combinedSeatFare)}</div>
                      <div className="text-[10px] text-slate-500">{toBengaliDigits(row.combinedSeats)} সিট</div>
                    </td>

                    {/* 13. মালের ভাড়া */}
                    <td className="px-2.5 py-2 border-r border-slate-200 text-right tabular-nums whitespace-nowrap">
                      <div className="font-bold text-[#1e3a8a] text-xs">{formatTaka(row.combinedCargoFare)}</div>
                    </td>

                    {/* 14. মোট টাকা (সিট + মাল) */}
                    <td className="px-2.5 py-2 border-r border-slate-200 text-right tabular-nums whitespace-nowrap">
                      <div className="font-black text-[#1d4ed8] text-xs">{formatTaka(row.combinedFare)}</div>
                    </td>

                    {/* 15. ফুয়েল +/- মূল্য */}
                    <td className="px-2.5 py-2 border-r border-slate-200 text-right tabular-nums whitespace-nowrap">
                      {row.fuelCostDiff !== null ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] border ${
                            row.fuelCostDiff > 0
                              ? 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]'
                              : row.fuelCostDiff < 0
                              ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                              : 'bg-[#f8fafc] text-[#1e3a8a] border-slate-200'
                          }`}
                        >
                          {formatSignedFuelCostDiff(row.fuelCostDiff)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>

                    {/* 16. সুপারভাইজার */}
                    <td className="px-2.5 py-2 border-r border-slate-200 font-semibold text-slate-800">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-[#1d4ed8] shrink-0" />
                        <span>{row.supervisorDisplay}</span>
                      </div>
                    </td>

                    {/* 17. ড্রাইভার */}
                    <td className="px-2.5 py-2 font-semibold text-slate-800">
                      <span>{row.driverDisplay}</span>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Table Summary Footer */}
              <tfoot className="bg-[#eff6ff] text-[#1e3a8a] font-black border-t-2 border-[#bfdbfe] text-xs">
                <tr>
                  <td colSpan={3} className="px-3 py-2.5 border-r border-[#bfdbfe] text-left font-bold">
                    সর্বমোট: {toBengaliDigits(filteredRows.length)} টি রেকর্ড | পূর্ণাঙ্গ ট্রিপ: {toBengaliDigits(filteredTotals.fullTrips)} টি
                  </td>
                  <td className="px-2 py-2.5 border-r border-[#bfdbfe] text-center">-</td>
                  <td className="px-2 py-2.5 border-r border-[#bfdbfe] text-center">-</td>
                  <td className="px-2 py-2.5 border-r border-[#bfdbfe] text-center">-</td>
                  <td className="px-2 py-2.5 border-r border-[#bfdbfe] text-center">-</td>
                  <td className="px-2 py-2.5 border-r border-[#bfdbfe] text-center">-</td>
                  <td className="px-2.5 py-2.5 border-r border-[#bfdbfe] font-mono text-[#1e3a8a]">
                    {toBengaliDigits(filteredTotals.distance)} কিমি
                  </td>
                  <td className="px-2.5 py-2.5 border-r border-[#bfdbfe] text-[#1e3a8a]">
                    {toBengaliDigits(filteredTotals.upSeats)} সিট | {formatTaka(filteredTotals.upFare)}
                  </td>
                  <td className="px-2.5 py-2.5 border-r border-[#bfdbfe] text-[#1d4ed8]">
                    {toBengaliDigits(filteredTotals.downSeats)} সিট | {formatTaka(filteredTotals.downFare)}
                  </td>
                  <td className="px-2.5 py-2.5 border-r border-[#bfdbfe] text-right text-[#1e3a8a] tabular-nums whitespace-nowrap">
                    {formatTaka(filteredTotals.totalSeatFare)}
                  </td>
                  <td className="px-2.5 py-2.5 border-r border-[#bfdbfe] text-right text-[#1e3a8a] tabular-nums whitespace-nowrap">
                    {formatTaka(filteredTotals.totalCargoFare)}
                  </td>
                  <td className="px-2.5 py-2.5 border-r border-[#bfdbfe] text-right text-[#1d4ed8] font-black tabular-nums whitespace-nowrap">
                    {formatTaka(filteredTotals.totalFare)}
                  </td>
                  <td className={`px-2.5 py-2.5 border-r border-[#bfdbfe] text-right font-black tabular-nums whitespace-nowrap ${
                    filteredTotals.fuelDiff > 0 ? 'text-[#1d4ed8]' : filteredTotals.fuelDiff < 0 ? 'text-white bg-[#1e3a8a]' : 'text-[#1e3a8a]'
                  }`}>
                    {filteredTotals.hasFuelData ? formatSignedFuelCostDiff(filteredTotals.fuelDiff) : '-'}
                  </td>
                  <td colSpan={2} className="px-3 py-2.5 text-center text-[11px] text-[#1e3a8a]">
                    সমন্বয় সম্পন্ন
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      </div>

      {/* Printable Sheet (hidden on screen, visible ONLY during isolated PDF/Print) */}
      <div
        id="printable-database-report"
        className="hidden print:block font-sans"
        style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '10px' }}
      >
        <div
          className="recon-print-header"
          style={{
            textAlign: 'center',
            borderBottom: '1.5px solid #0f172a',
            paddingBottom: '8px',
            marginBottom: '10px',
          }}
        >
          <h2
            className="recon-company-name"
            style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.35 }}
          >
            {user?.company?.name || 'কাউন্টার টিকেটিং'}
          </h2>
          <div
            className="recon-subtitle"
            style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginTop: '3px', lineHeight: 1.4 }}
          >
            ট্রিপ সমন্বয় ডাটাবেইজ • তারিখ: {formatBengaliDate(date)} • পূর্ণাঙ্গ ট্রিপ: {toBengaliDigits(stats.fullTrips)} টি • মোট আদায়: {formatTaka(stats.totalFare)}
          </div>
        </div>

        {/* Print 17-Column Compressed Table with Separate Borders & Generous Line Height */}
        <table
          className="report-table recon-compact-table"
          style={{
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'separate',
            borderSpacing: 0,
            borderTop: '1px solid #475569',
            borderLeft: '1px solid #475569',
            fontSize: '9.5px',
            lineHeight: 1.6,
            backgroundColor: '#ffffff',
            color: '#0f172a',
          }}
        >
          <colgroup>
            <col style={{ width: '2.8%' }} />
            <col style={{ width: '5.5%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '4%' }} />
            <col style={{ width: '5.2%' }} />
            <col style={{ width: '5.2%' }} />
            <col style={{ width: '5.5%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '5.5%' }} />
            <col style={{ width: '7.5%' }} />
            <col style={{ width: '7.5%' }} />
            <col style={{ width: '5.5%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '5.8%' }} />
            <col style={{ width: '5.5%' }} />
            <col style={{ width: '5.5%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#e2e8f0', color: '#0f172a', fontWeight: 700, textAlign: 'center' }}>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>ক্র.</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>তারিখ</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>গাড়ি</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>নাইট</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>আপ</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>ডাউন</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>ব্যবধান</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>রুট</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>কিমি</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>আপ সিট/ভাড়া</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>ডাউন সিট/ভাড়া</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5, textAlign: 'right' }}>সিট</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5, textAlign: 'right' }}>মাল</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5, textAlign: 'right' }}>মোট টাকা</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5, textAlign: 'right' }}>ফুয়েল +/-</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>সুপারভাইজার</th>
              <th style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.5 }}>ড্রাইভার</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => (
              <tr key={row.id} style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, textAlign: 'center', fontWeight: 700 }}>
                  {toBengaliDigits(row.autoSerial)}
                </td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, textAlign: 'center', fontWeight: 600 }}>
                  {row.dateDisplay}
                </td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, fontWeight: 800 }}>
                  {row.vehicleRegNo}
                </td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, textAlign: 'center', fontWeight: 700 }}>
                  {row.isNightHold ? 'হ্যাঁ' : 'না'}
                </td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, textAlign: 'center' }}>{row.upTime}</td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, textAlign: 'center' }}>{row.downTime}</td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, textAlign: 'center', fontWeight: 700 }}>{row.timeDiffDisplay}</td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, fontWeight: 600 }}>{row.routeMerged}</td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, textAlign: 'center' }}>{row.distanceKmDisplay}</td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6 }}>{row.upSeatsAndFare}</td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6 }}>{row.downSeatsAndFare}</td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatTaka(row.combinedSeatFare)}</td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatTaka(row.combinedCargoFare)}</td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatTaka(row.combinedFare)}</td>
                <td
                  style={{
                    borderRight: '1px solid #475569',
                    borderBottom: '1px solid #475569',
                    padding: '7px 4px',
                    lineHeight: 1.6,
                    textAlign: 'right',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: row.fuelCostDiff && row.fuelCostDiff > 0 ? '#065f46' : row.fuelCostDiff && row.fuelCostDiff < 0 ? '#b91c1c' : '#0f172a',
                  }}
                >
                  {formatSignedFuelCostDiff(row.fuelCostDiff)}
                </td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6 }}>{row.supervisorDisplay}</td>
                <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '7px 4px', lineHeight: 1.6 }}>{row.driverDisplay}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#e2e8f0', fontWeight: 800 }}>
              <td colSpan={3} style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 5px', lineHeight: 1.6, textAlign: 'left' }}>
                মোট: {toBengaliDigits(filteredTotals.fullTrips)} টি ট্রিপ
              </td>
              <td colSpan={6} style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 5px', lineHeight: 1.6, textAlign: 'right' }}>
                দূরত্ব: {toBengaliDigits(filteredTotals.distance)} কিমি
              </td>
              <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.6 }}>
                {toBengaliDigits(filteredTotals.upSeats)} সিট | {formatTaka(filteredTotals.upFare)}
              </td>
              <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.6 }}>
                {toBengaliDigits(filteredTotals.downSeats)} সিট | {formatTaka(filteredTotals.downFare)}
              </td>
              <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatTaka(filteredTotals.totalSeatFare)}
              </td>
              <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatTaka(filteredTotals.totalCargoFare)}
              </td>
              <td style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatTaka(filteredTotals.totalFare)}
              </td>
              <td
                style={{
                  borderRight: '1px solid #475569',
                  borderBottom: '1px solid #475569',
                  padding: '8px 4px',
                  lineHeight: 1.6,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: filteredTotals.fuelDiff > 0 ? '#065f46' : filteredTotals.fuelDiff < 0 ? '#b91c1c' : '#0f172a',
                }}
              >
                {filteredTotals.hasFuelData ? formatSignedFuelCostDiff(filteredTotals.fuelDiff) : '-'}
              </td>
              <td colSpan={2} style={{ borderRight: '1px solid #475569', borderBottom: '1px solid #475569', padding: '8px 4px', lineHeight: 1.6, textAlign: 'center' }}>
                অডিট সম্পন্ন
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Owner WhatsApp Modal */}
      <OwnerWhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        companyName={user?.company?.name || 'কাউন্টার টিকেটিং'}
        reportTitle="ডাটাবেইজ ও ফুয়েল +/- মূল্য রিপোর্ট"
        dateLabel={formatBengaliDate(date)}
        items={whatsappOwnerItems}
      />

      {/* AI Insights Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 print:hidden">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90dvh] overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-[#1d4ed8] text-white flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#bfdbfe]" />
                <span>এআই দৈনিক বিশ্লেষণ ও ইনসাইটস</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="p-1.5 text-[#dbeafe] hover:text-white hover:bg-white/15 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-4">
              {aiLoading ? (
                <div className="py-12 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#1d4ed8]" />
                  এআই বিশ্লেষণ প্রস্তুত হচ্ছে...
                </div>
              ) : (
                <div className="p-4 bg-[#f8fafc] rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-medium">
                  {aiReport}
                </div>
              )}
            </div>

            <div className="shrink-0 px-4 py-3 bg-[#f8fafc] border-t border-slate-200 flex justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="px-5 py-2 min-h-[44px] bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold cursor-pointer"
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
