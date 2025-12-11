"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, Search, Camera, Wine, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  activeIcon?: React.ReactNode;
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

  // Don't show on auth page
  if (pathname === "/auth") {
    return null;
  }

  return (
    <nav className="bottom-nav md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
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


