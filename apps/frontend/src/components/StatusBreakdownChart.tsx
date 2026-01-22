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

export function StatusBreakdownChart({ data }: Props) {
  const chartData = data.map((item) => ({
    ...item,
    hour: new Date(item.hour_bucket).toLocaleString(),
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
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Area type="monotone" dataKey="status_2xx" stackId="1" stroke="#22c55e" fill="#22c55e" />
          <Area type="monotone" dataKey="status_3xx" stackId="1" stroke="#38bdf8" fill="#38bdf8" />
          <Area type="monotone" dataKey="status_4xx" stackId="1" stroke="#f97316" fill="#f97316" />
          <Area type="monotone" dataKey="status_5xx" stackId="1" stroke="#ef4444" fill="#ef4444" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
