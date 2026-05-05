"use client";

import { motion } from "motion/react";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A list with staggered fade-in / slide-up animation on first paint.
 *
 *   <MotionList className="grid gap-3 sm:grid-cols-2">
 *     {items.map((it) => (
 *       <MotionListItem key={it.id}>...</MotionListItem>
 *     ))}
 *   </MotionList>
 */
export function MotionList({
  children,
  className,
  as: Tag = "ul",
  delayChildren = 0.05,
  staggerChildren = 0.05,
}: {
  children: ReactNode;
  className?: string;
  as?: "ul" | "ol" | "div";
  delayChildren?: number;
  staggerChildren?: number;
}) {
  const Component = motion[Tag] as typeof motion.ul;
  return (
    <Component
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren,
            delayChildren,
          },
        },
      }}
    >
      {children}
    </Component>
  );
}

export function MotionListItem({
  children,
  className,
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={hover ? { y: -2 } : undefined}
      className={cn(className)}
    >
      {children}
    </motion.li>
  );
}
