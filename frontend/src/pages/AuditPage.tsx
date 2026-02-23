import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, ClipboardList } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl } from '../lib/api';

export default function AuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.token) return;

    fetch(apiUrl('/audit-logs?limit=50'), {
      headers: { Authorization: `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        setLogs(data.data || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch audit logs:', err);
        setIsLoading(false);
      });
  }, [user]);

  if (!user) return null;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Audit Logs" subtitle="Aviation-grade activity tracking" />

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="border-b border-border px-5 py-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{logs.length} events</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground animate-pulse">Loading logs via API...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No audit logs found.</div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="px-5 py-4 flex items-start gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="text-sm font-mono text-primary">{log.action || 'ACTION'}</code>
                    <span className="text-xs text-muted-foreground font-mono">{log.correlation_id || log.correlationId}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Resource: <span className="text-foreground">{log.entity_type || log.resource}</span>
                    {' · '}Entity ID: <span className="text-foreground">{log.entity_id}</span>
                    <br />
                    User: <span className="text-foreground">{log.user_id || log.userId}</span>
                    {' · '}Tenant: <span className="text-foreground">{log.tenant_id || log.tenantId}</span>
                  </div>
                  {(log.before_state || log.after_state || log.before || log.after) && (
                    <div className="mt-2 flex gap-2">
                      {(log.before_state || log.before) && (
                        <div className="text-xs bg-destructive/10 border border-destructive/20 rounded px-2 py-1 font-mono">
                          before: {JSON.stringify(log.before_state || log.before)}
                        </div>
                      )}
                      {(log.after_state || log.after) && (
                        <div className="text-xs bg-success/10 border border-success/20 rounded px-2 py-1 font-mono">
                          after: {JSON.stringify(log.after_state || log.after)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(log.created_at || log.timestamp).toLocaleString()}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
