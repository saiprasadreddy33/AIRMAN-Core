import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  positive?: boolean;
  icon: LucideIcon;
  iconColor?: string;
}

export function StatCard({ title, value, change, positive, icon: Icon, iconColor = 'text-primary' }: StatCardProps) {
  return (
    <div className="stat-card rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        {change && (
          <div className={`flex items-center gap-1 text-xs font-medium ${positive ? 'text-success' : 'text-destructive'}`}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {change}
          </div>
        )}
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{title}</div>
    </div>
  );
}
