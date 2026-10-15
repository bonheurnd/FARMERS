import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  INITIAL_USERS,
  INITIAL_FARMERS,
  INITIAL_PLOTS,
  INITIAL_SCHEDULES,
  INITIAL_TARIFFS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_EQUIPMENT,
  INITIAL_WORK_ORDERS,
  INITIAL_COMPLAINTS,
  INITIAL_NOTIFICATIONS,
} from './src/lib/storage/mockData.ts';
import {
  addMoney,
  applyPaymentToInvoice,
  isDuplicatePaymentTransaction,
} from './src/lib/logic/billing.ts';
import {
  findScheduleConflicts,
  isValidScheduleStateTransition,
} from './src/lib/logic/scheduling.ts';
import { hasPermission } from './src/lib/logic/permissions.ts';
import { validateOfflineEvent } from './src/lib/logic/sync.ts';
import type { UserRole, Farmer, Plot, WaterSchedule, Invoice, Payment, WorkOrder, Complaint, SmsNotification } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory persistent state across requests during server runtime
  let currentUser = INITIAL_USERS[0]; // Default Super Admin
  let farmers: Farmer[] = [...INITIAL_FARMERS];
  let plots: Plot[] = [...INITIAL_PLOTS];
  let schedules: WaterSchedule[] = [...INITIAL_SCHEDULES];
  const tariffs = [...INITIAL_TARIFFS];
  let invoices: Invoice[] = [...INITIAL_INVOICES];
  let payments: Payment[] = [...INITIAL_PAYMENTS];
  const equipment = [...INITIAL_EQUIPMENT];
  let workOrders: WorkOrder[] = [...INITIAL_WORK_ORDERS];
  let complaints: Complaint[] = [...INITIAL_COMPLAINTS];
  let notifications: SmsNotification[] = [...INITIAL_NOTIFICATIONS];
  const processedIdempotencyKeys = new Set<string>(['IDEM-MOMO-2026-001', 'IDEM-AIRTEL-2026-002']);
  const processedTxRefs = new Set<string>(['MOMO-RW-20260920-8841', 'AIRTEL-RW-20260922-4410']);
  const auditLogs: Array<{ id: string; timestamp: string; actor: string; role: string; action: string; details: string }> = [
    {
      id: 'aud-001',
      timestamp: '2026-09-10T08:00:00Z',
      actor: 'Marie Rose Mukamurenzi',
      role: 'FINANCE_OFFICER',
      action: 'GENERATE_SEASON_INVOICES',
      details: 'Generated 2026A baseline invoices for 3 active members.',
    },
    {
      id: 'aud-002',
      timestamp: '2026-10-15T14:00:00Z',
      actor: 'Diane Kayitesi',
      role: 'SCHEME_MANAGER',
      action: 'APPROVE_SCHEDULE',
      details: 'Approved irrigation schedule SCH-2026-0401 for Plot BLK-A-P01.',
    },
  ];

  // Helper middleware for RBAC verification
  function requirePermission(action: any) {
    return (req: Request, res: Response, next: () => void) => {
      const role = currentUser.role;
      if (!hasPermission(role, action)) {
        return res.status(403).json({
          error: `Permission denied. Your current active role [${role}] does not have authority to perform [${action}].`,
        });
      }
      next();
    };
  }

  // Helper to log audit trail
  function recordAudit(action: string, details: string) {
    auditLogs.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      actor: currentUser.name,
      role: currentUser.role,
      action,
      details,
    });
  }

  // --- API Routes (/api/v1) ---

  // Health check
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      status: 'UP',
      scheme: 'GFI Nasho 1',
      district: 'Kirehe District, Rwanda',
      timezone: 'Africa/Kigali',
      version: '1.0.0',
      database: 'PostgreSQL/DRF Specification Scaffolded (Runtime In-Memory State)',
      isDemoMode: true,
    });
  });

  // Auth: Current User & Switch Role
  app.get('/api/v1/auth/me', (_req, res) => {
    res.json({
      user: currentUser,
      availableUsers: INITIAL_USERS,
    });
  });

  app.post('/api/v1/auth/switch-role', (req, res) => {
    const { userId, role } = req.body;
    let target = INITIAL_USERS.find((u) => u.id === userId);
    if (!target && role) {
      target = INITIAL_USERS.find((u) => u.role === role);
    }
    if (target) {
      currentUser = target;
      recordAudit('ROLE_SWITCH', `Switched active user context to ${target.name} (${target.role})`);
      return res.json({ success: true, user: currentUser });
    }
    res.status(400).json({ error: 'User or role not found.' });
  });

  // Dashboard Metrics
  app.get('/api/v1/metrics', (_req, res) => {
    const activeFarmers = farmers.filter((f) => f.membershipStatus === 'ACTIVE').length;
    const registeredPlots = plots.length;
    const cultivatedHectares = plots
      .filter((p) => p.status === 'ACTIVE')
      .reduce((sum, p) => sum + p.areaHectares, 0);
    const upcomingSchedules = schedules.filter((s) => s.status === 'APPROVED' || s.status === 'SUBMITTED').length;
    const reportedInterruptions = complaints.filter((c) => c.category === 'WATER_SHORTAGE' && c.status !== 'RESOLVED').length;
    const outstandingInvoicesRwf = invoices.reduce((sum, i) => sum + i.balanceRwf, 0);
    const recordedPaymentsRwf = payments.reduce((sum, p) => sum + p.amountRwf, 0);
    const openMaintenanceJobs = workOrders.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED').length;

    res.json({
      activeFarmers,
      registeredPlots,
      cultivatedHectares: Math.round(cultivatedHectares * 10) / 10,
      upcomingSchedules,
      reportedInterruptions,
      outstandingInvoicesRwf,
      recordedPaymentsRwf,
      openMaintenanceJobs,
      isDemoData: true,
    });
  });

  // Farmers
  app.get('/api/v1/farmers', (_req, res) => {
    if (currentUser.role === 'FARMER' && currentUser.farmerId) {
      const self = farmers.filter((f) => f.id === currentUser.farmerId);
      return res.json(self);
    }
    res.json(farmers);
  });

  app.post('/api/v1/farmers', requirePermission('CREATE_FARMER'), (req, res) => {
    const { fullName, phone, nationalId, email, cooperativeName, totalHectares, notes } = req.body;
    if (!fullName || !phone) {
      return res.status(400).json({ error: 'Full name and phone number are required.' });
    }

    const newFarmer: Farmer = {
      id: `fmr-${Date.now()}`,
      farmerCode: `NSH-FMR-${String(farmers.length + 101).padStart(4, '0')}`,
      fullName,
      phone,
      nationalId,
      email,
      cooperativeName: cooperativeName || 'Koperative Twitezimbere Nasho',
      membershipStatus: 'ACTIVE',
      registrationDate: new Date().toISOString().split('T')[0],
      totalHectares: Number(totalHectares) || 1.0,
      assignedPlotIds: [],
      notes,
      isDemo: true,
    };

    farmers.unshift(newFarmer);
    recordAudit('CREATE_FARMER', `Registered new member ${fullName} (${newFarmer.farmerCode})`);
    res.status(201).json(newFarmer);
  });

  app.post('/api/v1/farmers/import-csv', requirePermission('IMPORT_FARMERS'), (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows provided for import.' });
    }

    const imported: Farmer[] = [];
    const errors: Array<{ row: number; reason: string }> = [];

    rows.forEach((row, idx) => {
      if (!row.fullName || !row.phone) {
        errors.push({ row: idx + 1, reason: 'Missing required full name or phone.' });
        return;
      }
      // Duplicate detection by phone
      if (farmers.some((f) => f.phone === row.phone) || imported.some((f) => f.phone === row.phone)) {
        errors.push({ row: idx + 1, reason: `Phone number ${row.phone} already registered.` });
        return;
      }

      const f: Farmer = {
        id: `fmr-${Date.now()}-${idx}`,
        farmerCode: `NSH-FMR-${String(farmers.length + imported.length + 101).padStart(4, '0')}`,
        fullName: row.fullName,
        phone: row.phone,
        nationalId: row.nationalId,
        email: row.email,
        cooperativeName: row.cooperativeName || 'Koperative Twitezimbere Nasho',
        membershipStatus: 'ACTIVE',
        registrationDate: new Date().toISOString().split('T')[0],
        totalHectares: Number(row.totalHectares) || 1.0,
        assignedPlotIds: [],
        notes: row.notes || 'Imported via CSV batch',
        isDemo: true,
      };
      imported.push(f);
    });

    farmers.unshift(...imported);
    recordAudit('IMPORT_FARMERS', `Imported ${imported.length} farmers (${errors.length} failed)`);
    res.json({ importedCount: imported.length, errorCount: errors.length, errors, imported });
  });

  // Plots
  app.get('/api/v1/plots', (_req, res) => {
    if (currentUser.role === 'FARMER' && currentUser.farmerId) {
      const myPlots = plots.filter((p) => p.currentFarmerId === currentUser.farmerId);
      return res.json(myPlots);
    }
    res.json(plots);
  });

  app.post('/api/v1/plots', requirePermission('MANAGE_PLOTS'), (req, res) => {
    const { plotCode, blockCode, areaHectares, irrigationType, currentCrop, currentFarmerId, flowRateM3PerHour } = req.body;
    if (!plotCode || !blockCode) {
      return res.status(400).json({ error: 'Plot code and block code are required.' });
    }
    if (plots.some((p) => p.plotCode.toUpperCase() === plotCode.toUpperCase())) {
      return res.status(400).json({ error: `Plot code "${plotCode}" already exists.` });
    }

    const farmer = farmers.find((f) => f.id === currentFarmerId);

    const newPlot: Plot = {
      id: `plt-${Date.now()}`,
      plotCode,
      blockCode,
      schemeName: 'GFI Nasho 1',
      areaHectares: Number(areaHectares) || 1.0,
      irrigationType: irrigationType || 'CENTER_PIVOT',
      currentCrop: currentCrop || 'Maize',
      status: 'ACTIVE',
      currentFarmerId,
      currentFarmerName: farmer?.fullName,
      flowRateM3PerHour: Number(flowRateM3PerHour) || 120,
      isDemo: true,
    };

    plots.unshift(newPlot);
    if (farmer) {
      farmer.assignedPlotIds.push(newPlot.id);
    }
    recordAudit('CREATE_PLOT', `Created plot ${plotCode} in ${blockCode}`);
    res.status(201).json(newPlot);
  });

  // Schedules
  app.get('/api/v1/schedules', (_req, res) => {
    if (currentUser.role === 'FARMER' && currentUser.farmerId) {
      const mySchedules = schedules.filter((s) => s.farmerId === currentUser.farmerId);
      return res.json(mySchedules);
    }
    res.json(schedules);
  });

  app.post('/api/v1/schedules', requirePermission('CREATE_SCHEDULE'), (req, res) => {
    const { plotId, plannedStartTime, plannedEndTime, plannedVolumeM3, allocationBasis, notes } = req.body;
    const plot = plots.find((p) => p.id === plotId);
    if (!plot) {
      return res.status(400).json({ error: 'Plot not found.' });
    }

    // Overlap conflict detection
    const conflicts = findScheduleConflicts({ plotId, plannedStartTime, plannedEndTime }, schedules);
    if (conflicts.length > 0) {
      return res.status(409).json({
        error: `Schedule conflict detected: Plot ${plot.plotCode} is already scheduled from ${new Date(conflicts[0].plannedStartTime).toLocaleTimeString()} to ${new Date(conflicts[0].plannedEndTime).toLocaleTimeString()}.`,
        conflictingSchedule: conflicts[0],
      });
    }

    const newSchedule: WaterSchedule = {
      id: `sch-${Date.now()}`,
      scheduleCode: `SCH-2026-${String(schedules.length + 401).padStart(4, '0')}`,
      plotId,
      plotCode: plot.plotCode,
      farmerId: plot.currentFarmerId || 'unknown',
      farmerName: plot.currentFarmerName || 'Unassigned Member',
      plannedStartTime,
      plannedEndTime,
      plannedVolumeM3: Number(plannedVolumeM3) || 350,
      status: 'SUBMITTED',
      operatorId: currentUser.id,
      operatorName: currentUser.name,
      allocationBasis: allocationBasis || 'TIME_HOURS',
      notes,
      isDemo: true,
    };

    schedules.unshift(newSchedule);
    recordAudit('DRAFT_SCHEDULE', `Created schedule ${newSchedule.scheduleCode} for ${plot.plotCode}`);
    res.status(201).json(newSchedule);
  });

  app.post('/api/v1/schedules/:id/approve', requirePermission('APPROVE_SCHEDULE'), (req, res) => {
    const schedule = schedules.find((s) => s.id === req.params.id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });

    if (!isValidScheduleStateTransition(schedule.status, 'APPROVED')) {
      return res.status(400).json({ error: `Cannot transition from ${schedule.status} to APPROVED.` });
    }

    schedule.status = 'APPROVED';
    schedule.approvedBy = currentUser.name;
    schedule.approvedAt = new Date().toISOString();

    // Trigger SMS notification
    const farmer = farmers.find((f) => f.id === schedule.farmerId);
    if (farmer) {
      const sms: SmsNotification = {
        id: `sms-${Date.now()}`,
        recipientPhone: farmer.phone,
        recipientName: farmer.fullName,
        farmerId: farmer.id,
        type: 'SCHEDULE_ALERT',
        language: 'rw',
        message: `GFI Nasho 1: Gahunda yo kuhira umurima wawe ${schedule.plotCode} yemerewe. Gutangira: ${new Date(schedule.plannedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} kugeza ${new Date(schedule.plannedEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        sentAt: new Date().toISOString(),
        status: 'DELIVERED',
        provider: 'MOCK_GW',
        isDemo: true,
      };
      notifications.unshift(sms);
    }

    recordAudit('APPROVE_SCHEDULE', `Approved water schedule ${schedule.scheduleCode}`);
    res.json({ success: true, schedule });
  });

  app.post('/api/v1/schedules/:id/deliver', requirePermission('RECORD_DELIVERY'), (req, res) => {
    const schedule = schedules.find((s) => s.id === req.params.id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });

    const { actualStartTime, actualEndTime, actualVolumeM3, status, interruptionReason } = req.body;
    schedule.actualStartTime = actualStartTime || new Date().toISOString();
    schedule.actualEndTime = actualEndTime || new Date().toISOString();
    schedule.actualVolumeM3 = Number(actualVolumeM3) || schedule.plannedVolumeM3;
    schedule.status = status || 'COMPLETED';
    schedule.interruptionReason = interruptionReason;

    recordAudit('RECORD_DELIVERY', `Recorded delivery for ${schedule.scheduleCode}: ${schedule.actualVolumeM3} m³`);
    res.json({ success: true, schedule });
  });

  // Tariffs
  app.get('/api/v1/tariffs', (_req, res) => {
    res.json(tariffs);
  });

  // Invoices
  app.get('/api/v1/billing/invoices', (_req, res) => {
    if (currentUser.role === 'FARMER' && currentUser.farmerId) {
      const myInvoices = invoices.filter((i) => i.farmerId === currentUser.farmerId);
      return res.json(myInvoices);
    }
    res.json(invoices);
  });

  app.post('/api/v1/billing/invoices', requirePermission('CREATE_INVOICE'), (req, res) => {
    const { farmerId, lineItems, season, dueDate } = req.body;
    const farmer = farmers.find((f) => f.id === farmerId);
    if (!farmer) return res.status(400).json({ error: 'Farmer not found.' });
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: 'Invoice must have at least one line item.' });
    }

    const subtotal = lineItems.reduce((acc, item) => addMoney(acc, Number(item.totalRwf) || 0), 0);

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-${String(invoices.length + 44).padStart(4, '0')}`,
      farmerId: farmer.id,
      farmerName: farmer.fullName,
      farmerCode: farmer.farmerCode,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: dueDate || '2026-11-15',
      lineItems,
      subtotalRwf: subtotal,
      taxRwf: 0,
      totalRwf: subtotal,
      amountPaidRwf: 0,
      balanceRwf: subtotal,
      status: 'ISSUED',
      season: season || '2026A',
      isDemo: true,
    };

    invoices.unshift(newInvoice);
    recordAudit('CREATE_INVOICE', `Created invoice ${newInvoice.invoiceNumber} for ${farmer.fullName} (${subtotal} RWF)`);
    res.status(201).json(newInvoice);
  });

  // Payments & Receipts
  app.get('/api/v1/billing/payments', (_req, res) => {
    if (currentUser.role === 'FARMER' && currentUser.farmerId) {
      const myPayments = payments.filter((p) => p.farmerId === currentUser.farmerId);
      return res.json(myPayments);
    }
    res.json(payments);
  });

  app.post('/api/v1/billing/payments', requirePermission('RECORD_PAYMENT'), (req, res) => {
    const { invoiceId, amountRwf, paymentMethod, transactionReference, idempotencyKey, notes } = req.body;
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return res.status(400).json({ error: 'Invoice not found.' });

    const payAmount = Number(amountRwf);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    }

    // Idempotency & duplicate check
    if (isDuplicatePaymentTransaction(idempotencyKey, transactionReference, processedIdempotencyKeys, processedTxRefs)) {
      return res.status(409).json({
        error: `Duplicate payment rejected: Idempotency key "${idempotencyKey}" or reference "${transactionReference}" was already processed.`,
      });
    }

    // Apply payment
    const { newAmountPaid, newBalance, newStatus } = applyPaymentToInvoice(inv.totalRwf, inv.amountPaidRwf, payAmount);
    inv.amountPaidRwf = newAmountPaid;
    inv.balanceRwf = newBalance;
    inv.status = newStatus;

    const receiptNumber = `REC-2026-${String(payments.length + 33).padStart(4, '0')}`;
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      receiptNumber,
      farmerId: inv.farmerId,
      farmerName: inv.farmerName,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amountRwf: payAmount,
      paymentMethod: paymentMethod || 'MTN_MOMO',
      transactionReference: transactionReference?.trim() || `MANUAL-${Date.now()}`,
      idempotencyKey: idempotencyKey || `IDEM-${Date.now()}`,
      recordedBy: currentUser.name,
      recordedAt: new Date().toISOString(),
      isVerified: true,
      notes,
      isDemo: true,
    };

    processedIdempotencyKeys.add(newPayment.idempotencyKey);
    processedTxRefs.add(newPayment.transactionReference.toUpperCase());
    payments.unshift(newPayment);

    // Trigger SMS receipt
    const farmer = farmers.find((f) => f.id === inv.farmerId);
    if (farmer) {
      const sms: SmsNotification = {
        id: `sms-${Date.now()}`,
        recipientPhone: farmer.phone,
        recipientName: farmer.fullName,
        farmerId: farmer.id,
        type: 'PAYMENT_RECEIPT',
        language: 'rw',
        message: `GFI Nasho 1: Twakiriye ubwishyu bwa ${payAmount.toLocaleString()} RWF (${receiptNumber}). Inyemezabwishyu: ${inv.invoiceNumber}. Asigaye: ${newBalance.toLocaleString()} RWF. Murakoze!`,
        sentAt: new Date().toISOString(),
        status: 'DELIVERED',
        provider: 'MOCK_GW',
        isDemo: true,
      };
      notifications.unshift(sms);
    }

    recordAudit('RECORD_PAYMENT', `Verified payment ${receiptNumber} of ${payAmount} RWF for invoice ${inv.invoiceNumber}`);
    res.status(201).json({ payment: newPayment, updatedInvoice: inv });
  });

  // Equipment
  app.get('/api/v1/equipment', (_req, res) => {
    res.json(equipment);
  });

  // Work Orders
  app.get('/api/v1/work-orders', (_req, res) => {
    res.json(workOrders);
  });

  app.post('/api/v1/work-orders', requirePermission('CREATE_WORK_ORDER'), (req, res) => {
    const { equipmentId, title, description, priority, assignedTechnicianName, estimatedCostRwf } = req.body;
    const eq = equipment.find((e) => e.id === equipmentId);
    if (!eq) return res.status(400).json({ error: 'Equipment asset not found.' });

    const newWO: WorkOrder = {
      id: `wo-${Date.now()}`,
      workOrderNumber: `WO-2026-${String(workOrders.length + 20).padStart(4, '0')}`,
      equipmentId: eq.id,
      equipmentCode: eq.assetCode,
      equipmentName: eq.name,
      title: title || 'Inspection and repair',
      description,
      priority: priority || 'MEDIUM',
      status: 'OPEN',
      assignedTechnicianName: assignedTechnicianName || 'Jean Claude Bizimana',
      reportedDate: new Date().toISOString().split('T')[0],
      estimatedCostRwf: Number(estimatedCostRwf) || 25000,
      downtimeHours: 0,
      isDemo: true,
    };

    workOrders.unshift(newWO);
    recordAudit('CREATE_WORK_ORDER', `Created work order ${newWO.workOrderNumber} for ${eq.assetCode}`);
    res.status(201).json(newWO);
  });

  app.put('/api/v1/work-orders/:id', requirePermission('UPDATE_MAINTENANCE'), (req, res) => {
    const wo = workOrders.find((w) => w.id === req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found.' });

    const { status, downtimeHours, actualCostRwf, sparePartsUsed, notes } = req.body;
    if (status) wo.status = status;
    if (downtimeHours !== undefined) wo.downtimeHours = Number(downtimeHours);
    if (actualCostRwf !== undefined) wo.actualCostRwf = Number(actualCostRwf);
    if (sparePartsUsed) wo.sparePartsUsed = sparePartsUsed;
    if (notes) wo.notes = notes;
    if (status === 'COMPLETED' && !wo.completedDate) {
      wo.completedDate = new Date().toISOString().split('T')[0];
    }

    recordAudit('UPDATE_WORK_ORDER', `Updated work order ${wo.workOrderNumber} to status ${wo.status}`);
    res.json({ success: true, workOrder: wo });
  });

  // Complaints / Water Interruption Tickets
  app.get('/api/v1/complaints', (_req, res) => {
    if (currentUser.role === 'FARMER' && currentUser.farmerId) {
      const myComplaints = complaints.filter((c) => c.farmerId === currentUser.farmerId);
      return res.json(myComplaints);
    }
    res.json(complaints);
  });

  app.post('/api/v1/complaints', (req, res) => {
    const { category, description, plotCode } = req.body;
    if (!description) return res.status(400).json({ error: 'Description is required.' });

    const farmer = farmers.find((f) => f.id === currentUser.farmerId) || farmers[0];

    const newTicket: Complaint = {
      id: `cmp-${Date.now()}`,
      ticketNumber: `CMP-2026-${String(complaints.length + 47).padStart(4, '0')}`,
      farmerId: farmer.id,
      farmerName: farmer.fullName,
      plotCode,
      category: category || 'WATER_SHORTAGE',
      description,
      submittedAt: new Date().toISOString(),
      status: 'PENDING',
      isDemo: true,
    };

    complaints.unshift(newTicket);
    recordAudit('SUBMIT_COMPLAINT', `Farmer ${farmer.fullName} filed ticket ${newTicket.ticketNumber}`);
    res.status(201).json(newTicket);
  });

  // SMS Notifications
  app.get('/api/v1/notifications', (_req, res) => {
    if (currentUser.role === 'FARMER' && currentUser.farmerId) {
      const mySms = notifications.filter((n) => n.farmerId === currentUser.farmerId);
      return res.json(mySms);
    }
    res.json(notifications);
  });

  app.post('/api/v1/notifications/send-sms', (req, res) => {
    const { phone, message, farmerId, type, language } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required.' });
    }

    const newSms: SmsNotification = {
      id: `sms-${Date.now()}`,
      recipientPhone: phone,
      recipientName: 'Scheme Member',
      farmerId,
      type: type || 'SCHEDULE_ALERT',
      language: language || 'rw',
      message,
      sentAt: new Date().toISOString(),
      status: 'DELIVERED',
      provider: 'MOCK_GW',
      isDemo: true,
    };

    notifications.unshift(newSms);
    res.status(201).json(newSms);
  });

  // Offline Synchronization Endpoint
  app.post('/api/v1/sync', (req, res) => {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'events array required.' });
    }

    const results: Array<{ id: string; status: 'SYNCED' | 'FAILED'; error?: string }> = [];

    for (const event of events) {
      const validation = validateOfflineEvent(event);
      if (!validation.valid) {
        results.push({ id: event.id, status: 'FAILED', error: validation.error });
        continue;
      }

      if (event.eventType === 'SUBMIT_COMPLAINT' || event.eventType === 'REPORT_INTERRUPTION') {
        const payload = event.payload;
        const newTicket: Complaint = {
          id: `cmp-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          ticketNumber: `CMP-2026-${String(complaints.length + 50).padStart(4, '0')}`,
          farmerId: currentUser.farmerId || 'fmr-001',
          farmerName: currentUser.name,
          plotCode: payload.plotCode as string,
          category: payload.category || 'WATER_SHORTAGE',
          description: payload.description || 'Offline recorded interruption',
          submittedAt: event.queuedAt || new Date().toISOString(),
          status: 'PENDING',
          isDemo: true,
        };
        complaints.unshift(newTicket);
        results.push({ id: event.id, status: 'SYNCED' });
      } else {
        results.push({ id: event.id, status: 'FAILED', error: 'Unhandled offline event type.' });
      }
    }

    res.json({ processed: results.length, results });
  });

  // Audit Logs
  app.get('/api/v1/audit-logs', requirePermission('VIEW_AUDIT_LOGS'), (_req, res) => {
    res.json(auditLogs);
  });

  // Mount Vite middleware in development with HMR disabled to prevent WebSocket dropped connection errors
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GFI Nasho 1 Irrigation Management Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
