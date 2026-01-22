import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Aggregate } from "../types";
import styles from "./ChartContainer.module.css";

type Props = {
  data: Aggregate[];
};

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function BandwidthChart({ data }: Props) {
  const chartData = data.map((item) => ({
    hour: new Date(item.hour_bucket).toLocaleString(),
    total_bytes: item.total_bytes,
  }));

  if (!chartData.length) {
    return <div className={styles.empty}>No data for selected range.</div>;
  }

  return (
    <div className={styles.chartWrapper}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" tick={{ fontSize: 12 }} hide={chartData.length > 24} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={formatBytes} />
          <Tooltip formatter={(value: number) => [formatBytes(value), "Bytes"]} />
          <Area type="monotone" dataKey="total_bytes" stroke="#6366f1" fill="#c7d2fe" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
