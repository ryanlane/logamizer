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
  status: number;
  count: number;
};

type Props = {
  data: Item[];
};

export function TopStatusCodesChart({ data }: Props) {
  if (!data.length) {
    return <div className={styles.empty}>No status code data yet.</div>;
  }

  const chartData = data.map((item) => ({
    label: String(item.status),
    count: item.count,
  }));

  return (
    <div className={styles.chartWrapper}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => [value, "Requests"]} />
          <Bar dataKey="count" fill="#f97316" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
