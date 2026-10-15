/**
 * Pure logic for Water Scheduling, Overlap Conflict Detection, and Capacity Rules.
 */

import type { ScheduleStatus, WaterSchedule } from '../../types/index.ts';

export interface TimeSlot {
  start: Date | string;
  end: Date | string;
}

/**
 * Checks whether two time intervals overlap.
 */
export function doIntervalsOverlap(
  startA: string | Date,
  endA: string | Date,
  startB: string | Date,
  endB: string | Date
): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  return sA < eB && sB < eA;
}

/**
 * Checks for conflicts with existing active/approved schedules for the same plot.
 */
export function findScheduleConflicts(
  newSchedule: { plotId: string; plannedStartTime: string; plannedEndTime: string; id?: string },
  existingSchedules: WaterSchedule[]
): WaterSchedule[] {
  const activeStatuses: ScheduleStatus[] = ['SUBMITTED', 'APPROVED', 'IN_PROGRESS'];

  return existingSchedules.filter((sch) => {
    // Ignore same schedule if updating
    if (newSchedule.id && sch.id === newSchedule.id) return false;
    // Must be same plot
    if (sch.plotId !== newSchedule.plotId) return false;
    // Must be in an active/booked state
    if (!activeStatuses.includes(sch.status)) return false;

    return doIntervalsOverlap(
      newSchedule.plannedStartTime,
      newSchedule.plannedEndTime,
      sch.plannedStartTime,
      sch.plannedEndTime
    );
  });
}

/**
 * Validates state transition according to scheme operational rules.
 */
export function isValidScheduleStateTransition(
  currentStatus: ScheduleStatus,
  targetStatus: ScheduleStatus
): boolean {
  const allowedTransitions: Record<ScheduleStatus, ScheduleStatus[]> = {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'DRAFT', 'CANCELLED'],
    APPROVED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'INTERRUPTED'],
    INTERRUPTED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  return allowedTransitions[currentStatus]?.includes(targetStatus) ?? false;
}

/**
 * Checks if total concurrent volume demands exceed pump station capacity.
 */
export function checkPumpCapacityViolation(
  concurrentDeliveriesVolumeM3PerHour: number,
  maxPumpCapacityM3PerHour: number
): boolean {
  return concurrentDeliveriesVolumeM3PerHour > maxPumpCapacityM3PerHour;
}
