import {
  CartesianGrid,
  Line,
  LineChart,
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

export function ErrorRateChart({ data }: Props) {
  const chartData = data.map((item) => {
    const errors = item.status_4xx + item.status_5xx;
    const rate = item.requests_count > 0 ? (errors / item.requests_count) * 100 : 0;
    return {
      hour: new Date(item.hour_bucket).toLocaleString(),
      error_rate: Number(rate.toFixed(2)),
    };
  });

  if (!chartData.length) {
    return <div className={styles.empty}>No data for selected range.</div>;
  }

  return (
    <div className={styles.chartWrapper}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" tick={{ fontSize: 12 }} hide={chartData.length > 24} />
          <YAxis tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={(value: number) => [`${value}%`, "Error rate"]} />
          <Line type="monotone" dataKey="error_rate" stroke="#ef4444" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
