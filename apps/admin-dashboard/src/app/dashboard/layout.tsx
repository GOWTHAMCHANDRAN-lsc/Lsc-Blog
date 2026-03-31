'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  MessageSquare,
  Users,
  Folder,
  Tag,
  Image,
  BarChart3,
  Mail,
  Key,
  Settings,
  Building,
  LogOut,
  ChevronDown,
  Search,
  Bell,
  Menu,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/posts', label: 'Content', icon: FileText },
  { href: '/dashboard/approval', label: 'Review', icon: CheckCircle },
  { href: '/dashboard/comments', label: 'Feedback', icon: MessageSquare },
  { href: '/dashboard/users', label: 'Team', icon: Users },
  { href: '/dashboard/categories', label: 'Organize', icon: Folder },
  { href: '/dashboard/tags', label: 'Tags', icon: Tag },
  { href: '/dashboard/media', label: 'Media', icon: Image },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/subscribers', label: 'Audience', icon: Mail },
  { href: '/dashboard/api-tokens', label: 'API', icon: Key },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  {
    href: '/dashboard/tenants',
    label: 'Platform',
    icon: Building,
    superAdminOnly: true,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{
    name: string;
    email: string;
    systemRole: string;
    tenantId?: string;
    tenantName?: string;
    tenantRole?: string;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      if (parsedUser.systemRole === 'super_admin') {
        api
          .listTenants(token)
          .then((res: any) => {
            setTenants(res.data || []);
          })
          .catch(() => {});
      }
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    if (!window.confirm('Sign out from your account?')) return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);
  const closeDropdown = () => setDropdownOpen(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-dropdown')) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const visibleItems = NAV_ITEMS.filter(
    item => !item.superAdminOnly || user?.systemRole === 'super_admin'
  );

  return (
    <div className="admin-wrapper">
      <button
        className="mobile-menu-toggle"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
          role="presentation"
          aria-hidden="true"
        />
      )}

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-brand">
          <div className="admin-brand-logo">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="admin-brand-name">
              {user?.systemRole === 'super_admin'
                ? 'Super Admin'
                : user?.tenantName || 'Blog Admin'}
            </div>
            <div className="admin-brand-tag">
              {user?.systemRole === 'super_admin'
                ? 'Platform Manager'
                : user?.tenantRole
                  ? user.tenantRole.replace('_', ' ')
                  : 'Dashboard'}
            </div>
          </div>
          <button
            className="sidebar-close"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {user?.systemRole === 'super_admin' && tenants.length > 0 && (
          <div className="tenant-switcher">
            <select
              className="tenant-select"
              value={user.tenantId || ''}
              onChange={async e => {
                const newTenantId = e.target.value;
                const token = localStorage.getItem('access_token');
                const refreshToken = localStorage.getItem('refresh_token');
                if (!token || !newTenantId || !refreshToken) {
                  console.error('Missing token or refresh token');
                  return;
                }
                try {
                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/admin/v1/auth/switch-tenant`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        tenantId: newTenantId,
                        refreshToken: refreshToken,
                      }),
                    }
                  );
                  const data = await res.json();
                  if (data.success) {
                    localStorage.setItem('access_token', data.data.accessToken);
                    localStorage.setItem(
                      'refresh_token',
                      data.data.refreshToken
                    );
                    localStorage.setItem(
                      'user',
                      JSON.stringify(data.data.user)
                    );
                    setUser(data.data.user);
                    window.location.reload();
                  } else {
                    console.error('Failed to switch tenant:', data.error);
                  }
                } catch (err) {
                  console.error('Failed to switch tenant:', err);
                }
              }}
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="admin-nav" aria-label="Main navigation">
          <ul>
            {visibleItems.map(item => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`admin-nav-item ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="admin-nav-icon">
                    {item.icon && <item.icon size={20} />}
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {user && (
          <div className="admin-user">
            <div className={`user-dropdown ${dropdownOpen ? 'open' : ''}`}>
              <button
                className="user-dropdown-trigger"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className="admin-user-avatar">
                  {user.name
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="admin-user-details">
                  <div className="admin-user-name">{user.name}</div>
                  <div className="admin-user-email">{user.email}</div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="dropdown-arrow"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className="user-dropdown-menu">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">
                    {user.name
                      .split(' ')
                      .map(n => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div className="dropdown-user-info">
                    <div className="dropdown-user-name">{user.name}</div>
                    <div className="dropdown-user-email">{user.email}</div>
                    <span
                      className={`badge ${user.systemRole === 'super_admin' ? 'badge-danger' : user.tenantRole === 'admin' ? 'badge-primary' : user.tenantRole === 'editor' ? 'badge-warning' : 'badge-info'}`}
                    >
                      {user.systemRole === 'super_admin'
                        ? 'Super Admin'
                        : user.tenantRole?.replace('_', ' ') || 'User'}
                    </span>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <Link
                  href="/dashboard/settings"
                  className="dropdown-item"
                  onClick={closeSidebar}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  My Profile
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="dropdown-item"
                  onClick={closeSidebar}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Settings
                </Link>
                <div className="dropdown-divider"></div>
                <button
                  onClick={handleLogout}
                  className="dropdown-item logout-item"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
