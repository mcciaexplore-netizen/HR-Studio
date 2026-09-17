import type { Store } from "./store";
/** Shift breaks are deducted once per work date, even when a day has several clock periods. */
export async function attendanceSummary(
  store: Store,
  orgId: string,
  employeeId: string,
  month?: string,
) {
  const logs = (await store.list(orgId, "attendance")).filter(
    (log) =>
      log.employeeId === employeeId &&
      (!month || log.date.startsWith(month)) &&
      log.checkInAt &&
      log.checkOutAt,
  );
  const assignments = (await store.list(orgId, "shiftAssignments")).filter(
    (row) => row.employeeId === employeeId,
  );
  const grouped = new Map<string, number>();
  for (const log of logs)
    grouped.set(
      log.date,
      (grouped.get(log.date) || 0) +
        Math.max(
          0,
          (Date.parse(log.checkOutAt) - Date.parse(log.checkInAt)) / 3600000,
        ),
    );
  return [...grouped]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, total]) => {
      const shift = assignments.find(
        (row) => row.startDate <= date && row.endDate >= date,
      )?.shiftSnapshot;
      const paidHours = Math.max(0, total - (shift?.breakMinutes || 0) / 60);
      const overtime = shift ? Math.max(0, paidHours - shift.hours) : 0;
      const round = (n: number) => Math.round(n * 100) / 100;
      return {
        employeeId,
        date,
        shift: shift?.name || "No assigned shift",
        workedHours: round(total),
        paidHours: round(paidHours),
        scheduledHours: shift ? round(shift.hours) : null,
        overtimeHours: round(overtime),
      };
    });
}
