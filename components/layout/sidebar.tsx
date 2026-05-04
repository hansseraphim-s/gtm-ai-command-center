'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Table2,
  Brain,
  DollarSign,
  Calculator,
  BarChart3,
  Users,
  FileText,
  Settings,
  Database,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Portfolio', href: '/portfolio', icon: Table2 },
  { label: 'Feasibility', href: '/feasibility', icon: Brain },
  { label: 'ROI', href: '/roi', icon: DollarSign },
  { label: 'ROI Calculator', href: '/roi/calculator', icon: Calculator },
  { label: 'Prioritization', href: '/prioritization', icon: BarChart3 },
  { label: 'Adoption', href: '/adoption', icon: Users },
  { label: 'Reports', href: '/reports/executive', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Data', href: '/data', icon: Database },
];

const functions = [
  { label: 'Sales', href: '/functions/sales' },
  { label: 'Marketing', href: '/functions/marketing' },
  { label: 'Customer Success', href: '/functions/customer_success' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-navy h-screen sticky top-0 overflow-y-auto">
      {/* Wordmark */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-brand-accent" />
          <div>
            <p className="text-xs font-semibold text-sidebar-foreground leading-tight">
              GTM AI Command
            </p>
            <p className="text-[10px] text-sidebar-foreground/60 leading-tight">
              Portfolio Center
            </p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* Functions sub-section */}
        <div className="pt-3">
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Functions
          </p>
          {functions.map(({ label, href }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Debug link (Phase 1 only) */}
        <div className="pt-3">
          <Link
            href="/debug"
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors',
              pathname === '/debug'
                ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                : 'text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70'
            )}
          >
            Debug / Data
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-[10px] text-sidebar-foreground/40">
          v1.0 · Local-first · Single user
        </p>
      </div>
    </aside>
  );
}
