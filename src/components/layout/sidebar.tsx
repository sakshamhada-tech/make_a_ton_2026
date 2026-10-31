import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  Percent,
  Receipt,
  Repeat,
  Settings2,
  UserSquare2,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { logoutAction } from '@/actions/auth';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const STAFF_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Sales',
    items: [
      { href: '/subscriptions', label: 'Subscriptions', icon: Repeat },
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/payments', label: 'Payments', icon: CreditCard },
      { href: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    label: 'Billing',
    items: [{ href: '/billing', label: 'Run billing', icon: CalendarClock }],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/products', label: 'Products', icon: Package },
      { href: '/plans', label: 'Plans', icon: Layers },
      { href: '/templates', label: 'Quote templates', icon: ClipboardList },
      { href: '/taxes', label: 'Taxes', icon: Receipt },
      { href: '/discounts', label: 'Discounts', icon: Percent },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/outbox', label: 'Outbox', icon: Mail },
      { href: '/staff', label: 'Staff', icon: UserSquare2, adminOnly: true },
    ],
  },
];

const CUSTOMER_NAV: NavGroup[] = [
  {
    label: 'Portal',
    items: [
      { href: '/portal', label: 'Overview', icon: LayoutDashboard },
      { href: '/portal/subscriptions', label: 'Subscriptions', icon: Repeat },
      { href: '/portal/invoices', label: 'Invoices', icon: FileText },
      { href: '/portal/profile', label: 'Profile', icon: Settings2 },
    ],
  },
];

export async function Sidebar() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const nav = user.role === 'CUSTOMER' ? CUSTOMER_NAV : STAFF_NAV;
  const filtered = nav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || user.role === 'ADMIN'),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="no-print flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 text-zinc-300">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3.5">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-teal-700 text-xs font-bold text-white">
          B
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Brightloop</p>
          <p className="text-2xs text-zinc-500">Billing</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        {filtered.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-zinc-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500"
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-zinc-800 px-4 py-3">
        <p className="truncate text-xs font-medium text-white">{user.name}</p>
        <p className="truncate text-2xs text-zinc-500">{user.email}</p>
        <p className="mt-0.5 text-2xs uppercase tracking-wide text-teal-400">{user.role.toLowerCase()}</p>
        <form action={logoutAction} className="mt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-2xs text-zinc-400 hover:bg-zinc-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
