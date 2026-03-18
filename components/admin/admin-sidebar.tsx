"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Mic,
  Code2,
  GitCompareArrows,
  FileText,
  ArrowLeft,
  Users,
  DollarSign,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Allmänt", href: "/admin", icon: LayoutDashboard },
  { title: "Personer", href: "/admin/personer", icon: Users },
  { title: "OpenClaw", href: "/admin/openclaw", icon: Bot },
  { title: "D-ID", href: "/admin/did", icon: Mic },
  { title: "API", href: "/admin/api", icon: Code2 },
  { title: "Jämförelser", href: "/admin/comparisons", icon: GitCompareArrows },
  { title: "SKV", href: "/admin/skv", icon: FileText },
  { title: "Kostnader", href: "/admin/kostnader", icon: DollarSign },
];

export function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="py-4">
        <Link href="/admin" className="flex items-center gap-2 px-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            F
          </div>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Flytt.io Admin
          </span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Tillbaka till sajten">
              <Link href="/">
                <ArrowLeft />
                <span>Tillbaka till sajten</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
