import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export default function QualityRadar({ qualities = [], height = 300 }) {
  const data = qualities.map((q) => ({ quality: q.quality, score: Number(q.score) || 0 }));

  if (!data.length) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border text-[13px] text-muted-foreground">
        The nine-qualities profile appears after the first audit.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="quality"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10.5 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Radar
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.18}
            strokeWidth={1.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}