import React, { useState } from 'react';
import {
  Users,
  Grid3X3,
  Calendar,
  AlertTriangle,
  Receipt,
  CheckCircle,
  Wrench,
  TrendingUp,
  Info,
  Droplets,
} from 'lucide-react';
import type { Language, SchemeMetrics, WaterSchedule, Invoice, Payment } from '../types/index.ts';

interface DashboardViewProps {
  metrics: SchemeMetrics;
  schedules: WaterSchedule[];
  invoices: Invoice[];
  payments: Payment[];
  language: Language;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  schedules,
  invoices,
  payments,
  language,
  onNavigate,
}) => {
  const [selectedSeason, setSelectedSeason] = useState('2026A');

  // Chart data: Planned vs Actual water delivery volume for recent schedules
  const recentDeliveries = schedules.slice(0, 5);
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.totalRwf, 0);
  const totalCollected = payments.reduce((sum, p) => sum + p.amountRwf, 0);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Mandatory Demo Data Notice Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <span className="font-bold uppercase tracking-wider text-amber-800 mr-2">
            [DEMO DATA NOTICE]
          </span>
          {language === 'rw'
            ? 'Imibare yose igaragara hano ni iy\'icyitegererezo (DEMO). Politiki z\'amazi za GFI Nasho 1 mu Karere ka Kirehe, imirima, abanyamuryango n\'ibiciro byo kuhira bigomba kubanza kwemezwa n\'ubuyobozi mbere yo gutangiza ku mugaragaro.'
            : 'All statistics, farmer profiles, tariffs, and schedules shown below are simulated demonstration data. Operational policies, farmer rolls, block dimensions, and water tariffs must be verified with GFI Nasho 1 management before production.'}
        </div>
      </div>

      {/* Header with Season and Date Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {language === 'rw' ? 'Ibonerana ry\'Umushinga wa Nasho 1' : 'Nasho 1 Scheme Operations Dashboard'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === 'rw'
              ? 'Akarere ka Kirehe · Intara y\'Iburasirazuba · Igihe cy\'Ihinga 2026A'
              : 'Kirehe District · Eastern Province, Rwanda · Season 2026A'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="season-select" className="text-xs font-medium text-slate-600">
            {language === 'rw' ? 'Igihe:' : 'Season:'}
          </label>
          <select
            id="season-select"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
          >
            <option value="2026A">Season 2026A (Current)</option>
            <option value="2025B">Season 2025B</option>
            <option value="ALL">All Recorded Seasons</option>
          </select>
        </div>
      </div>

      {/* Primary KPI Grid (8 Core Operational Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">
              {language === 'rw' ? 'Abahinzi Bakora' : 'Active Farmers'}
            </span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.activeFarmers}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Registered WUA members
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">
              {language === 'rw' ? 'Imirima / Pivo' : 'Registered Plots'}
            </span>
            <Grid3X3 className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.registeredPlots}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across 3 Pivot Blocks
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">
              {language === 'rw' ? 'Ubuso Buhingwa' : 'Cultivated Area'}
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.cultivatedHectares}{' '}
            <span className="text-sm font-normal text-slate-500">Ha</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Irrigated land under crop
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">
              {language === 'rw' ? 'Guhira Guteganyijwe' : 'Upcoming Deliveries'}
            </span>
            <Calendar className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.upcomingSchedules}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Next 48 operating hours
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">
              {language === 'rw' ? 'Guhagarara kw\'Amazi' : 'Water Interruptions'}
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.reportedInterruptions}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Active reported issues
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">
              {language === 'rw' ? 'Ibirarane by\'Inyemezabwishyu' : 'Outstanding Balance'}
            </span>
            <Receipt className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {(metrics.outstandingInvoicesRwf / 1000).toFixed(0)}k{' '}
            <span className="text-xs font-normal text-slate-500">RWF</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Unsettled seasonal dues
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">
              {language === 'rw' ? 'Amafaranga Yinjiye' : 'Collected Revenue'}
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {(metrics.recordedPaymentsRwf / 1000).toFixed(0)}k{' '}
            <span className="text-xs font-normal text-slate-500">RWF</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Verified MoMo & bank deposits
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">
              {language === 'rw' ? 'Gusana Gukorwa' : 'Open Work Orders'}
            </span>
            <Wrench className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.openMaintenanceJobs}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Active maintenance tickets
          </div>
        </div>
      </div>

      {/* Visual Analytics Split Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Planned vs Actual Irrigation Water Volume */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'rw'
                  ? 'Amazi Yateganyijwe vs Ayahawe (m³)'
                  : 'Planned vs Actual Irrigation Volume (m³)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparison per scheduled plot rotation cycle
              </p>
            </div>
            <button
              onClick={() => onNavigate('schedules')}
              className="text-xs font-semibold text-sky-700 hover:text-sky-800"
            >
              View Schedules →
            </button>
          </div>

          <div className="space-y-4 pt-2">
            {recentDeliveries.map((s) => {
              const maxVol = 600;
              const plannedPercent = Math.min(100, Math.round((s.plannedVolumeM3 / maxVol) * 100));
              const actualVol = s.actualVolumeM3 || 0;
              const actualPercent = Math.min(100, Math.round((actualVol / maxVol) * 100));

              return (
                <div key={s.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {s.plotCode} · <span className="font-normal text-slate-500">{s.farmerName}</span>
                    </span>
                    <span className="text-slate-500 font-mono tabular-nums text-[11px]">
                      Planned: {s.plannedVolumeM3} m³ | Actual: {actualVol ? `${actualVol} m³` : 'Pending'}
                    </span>
                  </div>

                  {/* Planned Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                    <div
                      className="bg-sky-400 h-2.5 rounded-full"
                      style={{ width: `${plannedPercent}%` }}
                      title={`Planned: ${s.plannedVolumeM3} m³`}
                    />
                  </div>

                  {/* Actual Bar (if measured) */}
                  {actualVol > 0 && (
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-2.5 rounded-full"
                        style={{ width: `${actualPercent}%` }}
                        title={`Actual: ${actualVol} m³`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-6 mt-5 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs bg-sky-400 inline-block" />
              <span>Planned Allocation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
              <span>Measured Flow Meter Volume</span>
            </div>
          </div>
        </div>

        {/* Chart B: Financial Collection & Reconciliation Health */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'rw'
                  ? 'Ubwishyu bwakiriwe n\'Ibirarane'
                  : 'Revenue Collection & Reconciliation'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Seasonal water levy recovery rate
              </p>
            </div>
            <button
              onClick={() => onNavigate('billing')}
              className="text-xs font-semibold text-sky-700 hover:text-sky-800"
            >
              View Invoices →
            </button>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1.5">
              <span>Collection Progress</span>
              <span className="font-bold text-slate-900 tabular-nums">{collectionRate}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2 font-mono tabular-nums">
              <span>Collected: {totalCollected.toLocaleString()} RWF</span>
              <span>Total Invoiced: {totalInvoiced.toLocaleString()} RWF</span>
            </div>
          </div>

          {/* Quick summary rows */}
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Active Center Pivot Tariffs</span>
              <span className="font-semibold text-slate-900">45,000 RWF / Ha / Season</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">WUA Infrastructure Levy</span>
              <span className="font-semibold text-slate-900">5,000 RWF / Ha / Season</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">Payment Channels Verified</span>
              <span className="font-medium text-emerald-700">MTN MoMo (*182#) · Airtel · BK</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Highlights / Quick Actions Strip */}
      <div className="bg-slate-900 text-white rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            {language === 'rw' ? 'Ibikorwa Byihutirwa by\'Uyu Munsi' : 'Immediate Operations Checklist'}
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            Review pending water schedules, process incoming mobile money payments, and inspect Pivot 03 repairs.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigate('schedules')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition cursor-pointer"
          >
            Review Schedules
          </button>
          <button
            onClick={() => onNavigate('farmer-portal')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            Open Farmer PWA
          </button>
        </div>
      </div>
    </div>
  );
};
