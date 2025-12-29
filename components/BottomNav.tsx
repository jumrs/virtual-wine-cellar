"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, Search, Camera, Wine, User, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCellar } from "@/components/CellarProvider";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  activeIcon?: React.ReactNode;
  requiresEdit?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/",
    icon: <Star className="w-6 h-6" strokeWidth={1.5} />,
    activeIcon: <Star className="w-6 h-6 fill-current" strokeWidth={1.5} />,
    label: "Cellar",
  },
  {
    href: "/search",
    icon: <Search className="w-6 h-6" strokeWidth={1.5} />,
    label: "Search",
  },
  {
    href: "/upload",
    icon: <Camera className="w-6 h-6" strokeWidth={1.5} />,
    label: "Scan",
    requiresEdit: true,
  },
  {
    href: "/pairings",
    icon: <Wine className="w-6 h-6" strokeWidth={1.5} />,
    label: "Pairings",
  },
  {
    href: "/profile",
    icon: <User className="w-6 h-6" strokeWidth={1.5} />,
    label: "Profile",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { canEdit } = useCellar();

  // Don't show on auth page
  if (pathname === "/auth" || pathname === "/auth/callback") {
    return null;
  }

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around max-w-4xl mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isDisabled = item.requiresEdit && !canEdit;
          
          if (isDisabled) {
            return (
              <div
                key={item.href}
                className={cn(
                  "bottom-nav-item opacity-40 cursor-not-allowed"
                )}
                title="View-only access"
              >
                <div className="relative">
                  {item.icon}
                  <Lock className="absolute -bottom-1 -right-1 w-3 h-3 text-muted-foreground" />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            );
          }
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "bottom-nav-item",
                isActive && "active"
              )}
            >
              {isActive && item.activeIcon ? item.activeIcon : item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}



