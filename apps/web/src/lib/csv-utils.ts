import { ColumnDefinition, TrackerDataRow } from "@packages/backend/convex/types/tracker";

export function exportTrackerToCSV(
  trackerSlug: string,
  columns: ColumnDefinition[],
  data: TrackerDataRow[]
) {
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
  const headers = sortedColumns.map(col => col.name).join(",");
  const rows = data.map(row =>
    sortedColumns.map(col => {
      const value = row.data[col.key];
      // Escape commas and quotes in values
      const escaped = String(value || "").replace(/"/g, '""');
      return escaped.includes(",") ? `"${escaped}"` : escaped;
    }).join(",")
  );

  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${trackerSlug}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}