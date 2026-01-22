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
import styles from "./TrafficChart.module.css";

type Props = {
  data: Aggregate[];
};

export function TrafficChart({ data }: Props) {
  const chartData = data.map((item) => {
    const date = new Date(item.hour_bucket);
    return {
      ...item,
      hour: date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
    };
  });

  if (chartData.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No traffic data available</p>
      </div>
    );
  }

  return (
    <div className={styles.chartWrapper}>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} data-color="requests" />
          <span>Requests</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} data-color="errors" />
          <span>5xx Errors</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              fontSize: "13px",
            }}
          />
          <Area
            type="monotone"
            dataKey="requests_count"
            name="Requests"
            stroke="#6366f1"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRequests)"
          />
          <Area
            type="monotone"
            dataKey="status_5xx"
            name="5xx Errors"
            stroke="#ef4444"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorErrors)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
