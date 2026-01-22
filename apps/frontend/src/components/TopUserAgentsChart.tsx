import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./ChartContainer.module.css";

type Item = {
  label: string;
  count: number;
};

type Props = {
  data: Item[];
};

function truncateLabel(value: string, max = 32): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function TopUserAgentsChart({ data }: Props) {
  if (!data.length) {
    return <div className={styles.empty}>No user agent data yet.</div>;
  }

  const chartData = data.map((item) => ({
    ...item,
    label: truncateLabel(item.label),
  }));

  return (
    <div className={styles.chartWrapper}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => [value, "Requests"]} />
          <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 6, 6]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
