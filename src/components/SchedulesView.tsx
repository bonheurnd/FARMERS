import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Droplets,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  X,
  Send,
  UserCheck,
} from 'lucide-react';
import type { WaterSchedule, Plot, Language, UserRole } from '../types/index.ts';
import { canApproveSchedule, hasPermission } from '../lib/logic/permissions.ts';

interface SchedulesViewProps {
  schedules: WaterSchedule[];
  plots: Plot[];
  language: Language;
  currentRole: UserRole;
  onAddSchedule: (scheduleData: Partial<WaterSchedule>) => Promise<void>;
  onApproveSchedule: (id: string) => Promise<void>;
  onRecordDelivery: (id: string, deliveryData: any) => Promise<void>;
}

export const SchedulesView: React.FC<SchedulesViewProps> = ({
  schedules,
  plots,
  language,
  currentRole,
  onAddSchedule,
  onApproveSchedule,
  onRecordDelivery,
}) => {
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState<WaterSchedule | null>(null);

  // New Schedule Form States
  const [plotId, setPlotId] = useState(plots[0]?.id || '');
  const [startTime, setStartTime] = useState('2026-10-18T08:00');
  const [endTime, setEndTime] = useState('2026-10-18T12:00');
  const [plannedVolume, setPlannedVolume] = useState('420');
  const [allocationBasis, setAllocationBasis] = useState<WaterSchedule['allocationBasis']>('TIME_HOURS');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delivery recording form
  const [actualVolume, setActualVolume] = useState('415');
  const [deliveryStatus, setDeliveryStatus] = useState<WaterSchedule['status']>('COMPLETED');
  const [interruptionReason, setInterruptionReason] = useState('');

  const canCreate = hasPermission(currentRole, 'CREATE_SCHEDULE');
  const canApprove = canApproveSchedule(currentRole);
  const canDeliver = hasPermission(currentRole, 'RECORD_DELIVERY');

  const filteredSchedules = schedules.filter((s) => {
    if (selectedStatus === 'ALL') return true;
    return s.status === selectedStatus;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!plotId) {
      setFormError('Please select a plot.');
      return;
    }
    if (new Date(startTime) >= new Date(endTime)) {
      setFormError('End time must be after start time.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddSchedule({
        plotId,
        plannedStartTime: new Date(startTime).toISOString(),
        plannedEndTime: new Date(endTime).toISOString(),
        plannedVolumeM3: parseFloat(plannedVolume) || 350,
        allocationBasis,
        notes: notes.trim() || undefined,
      });
      setShowAddModal(false);
      setNotes('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to schedule irrigation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDeliveryModal) return;

    try {
      setIsSubmitting(true);
      await onRecordDelivery(showDeliveryModal.id, {
        actualVolumeM3: parseFloat(actualVolume) || showDeliveryModal.plannedVolumeM3,
        status: deliveryStatus,
        interruptionReason: interruptionReason.trim() || undefined,
      });
      setShowDeliveryModal(null);
      setInterruptionReason('');
    } catch (err: any) {
      alert(err.message || 'Failed to record delivery.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {language === 'rw' ? 'Iteganyamazi no Kwemeza Guhira' : 'Irrigation Scheduling & Delivery Logs'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rotational schedule management across Lake Nasho intake pumps and center pivots
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              setShowAddModal(true);
              setFormError('');
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'rw' ? 'Gutegeka Guhira' : 'Schedule Water'}</span>
          </button>
        )}
      </div>

      {/* Filter by Status Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 font-medium mr-1">Status:</span>
        {['ALL', 'APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DRAFT', 'COMPLETED', 'INTERRUPTED'].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              selectedStatus === st
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Schedules Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Plot & Pivot</th>
                <th className="py-3 px-4">Farmer</th>
                <th className="py-3 px-4">Window Time</th>
                <th className="py-3 px-4 text-right">Planned (m³)</th>
                <th className="py-3 px-4 text-right">Actual (m³)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchedules.map((s) => {
                const sDate = new Date(s.plannedStartTime);
                const eDate = new Date(s.plannedEndTime);
                const timeStr = `${sDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${eDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      {s.scheduleCode}
                    </td>
                    <td className="py-3 px-4 font-semibold text-sky-800">
                      {s.plotCode}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {s.farmerName}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {timeStr}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {s.plannedVolumeM3} m³
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">
                      {s.actualVolumeM3 ? `${s.actualVolumeM3} m³` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] font-semibold ${
                          s.status === 'APPROVED'
                            ? 'text-sky-700'
                            : s.status === 'IN_PROGRESS'
                            ? 'text-amber-700'
                            : s.status === 'COMPLETED'
                            ? 'text-emerald-700'
                            : s.status === 'INTERRUPTED'
                            ? 'text-rose-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {/* Approval Action for Scheme Manager / Admin */}
                      {s.status === 'SUBMITTED' && canApprove && (
                        <button
                          onClick={() => onApproveSchedule(s.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-[11px] transition shadow-xs cursor-pointer"
                        >
                          Approve
                        </button>
                      )}

                      {/* Log Delivery Action for Operator */}
                      {(s.status === 'APPROVED' || s.status === 'IN_PROGRESS') && canDeliver && (
                        <button
                          onClick={() => {
                            setShowDeliveryModal(s);
                            setActualVolume(String(s.plannedVolumeM3));
                          }}
                          className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium text-[11px] transition shadow-xs cursor-pointer"
                        >
                          Log Delivery
                        </button>
                      )}

                      {s.status === 'COMPLETED' && (
                        <span className="text-slate-400 text-[11px]">Logged ✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredSchedules.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    No schedules found for selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {language === 'rw' ? 'Gutegeka Igihe cyo Kuhira' : 'Create Irrigation Schedule'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Plot & Assigned Member *</label>
                <select
                  value={plotId}
                  onChange={(e) => setPlotId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  {plots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plotCode} ({p.blockCode}) — Farmer: {p.currentFarmerName || 'Unassigned'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Planned Start Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Planned End Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Planned Volume (m³)</label>
                  <input
                    type="number"
                    min="1"
                    value={plannedVolume}
                    onChange={(e) => setPlannedVolume(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Allocation Basis</label>
                  <select
                    value={allocationBasis}
                    onChange={(e) => setAllocationBasis(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="TIME_HOURS">Pumping Hours (Time Slot)</option>
                    <option value="VOLUME_M3">Metered Volume Quota (m³)</option>
                    <option value="HECTARE_QUOTA">Hectare Crop Duty</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Operational Instructions</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Ensure secondary valve V-12 is open 10 minutes prior."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-xs"
                >
                  {isSubmitting ? 'Checking Conflicts...' : 'Submit Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Delivery Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Actual Delivery</h3>
                <p className="text-xs text-slate-500">{showDeliveryModal.scheduleCode} · {showDeliveryModal.plotCode}</p>
              </div>
              <button
                onClick={() => setShowDeliveryModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeliverySubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Measured Flow Meter Volume (m³)</label>
                <input
                  type="number"
                  required
                  value={actualVolume}
                  onChange={(e) => setActualVolume(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono text-base font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Delivery Status</label>
                <select
                  value={deliveryStatus}
                  onChange={(e) => setDeliveryStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  <option value="COMPLETED">COMPLETED (Normal Operation)</option>
                  <option value="INTERRUPTED">INTERRUPTED (Pressure / Power Drop)</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (Currently Running)</option>
                </select>
              </div>

              {deliveryStatus === 'INTERRUPTED' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Reason for Interruption</label>
                  <input
                    type="text"
                    required
                    value={interruptionReason}
                    onChange={(e) => setInterruptionReason(e.target.value)}
                    placeholder="e.g. Floating pump intake screen clogged by lake weeds"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDeliveryModal(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-xs"
                >
                  Save Delivery Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
