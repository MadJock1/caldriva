import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Breadcrumb(props: React.ComponentProps<"nav">) {
  return <nav aria-label="Breadcrumb" {...props} />;
}
export function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol className={cn("flex flex-wrap items-center gap-2 text-sm", className)} {...props} />;
}
export function BreadcrumbItem(props: React.ComponentProps<"li">) { return <li {...props} />; }
export function BreadcrumbLink({ asChild, ...props }: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "a";
  return <Component {...props} />;
}
export function BreadcrumbPage(props: React.ComponentProps<"span">) { return <span aria-current="page" {...props} />; }
export function BreadcrumbSeparator(props: React.ComponentProps<"li">) { return <li aria-hidden="true" {...props}><ChevronRight size={14} /></li>; }
