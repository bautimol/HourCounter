"use client";

import { motion } from "motion/react";
import { type ReactNode } from "react";
import {
  MockClockCard,
  MockGroupCard,
  MockInvitationCard,
  MockMemberRow,
  MockMembersCount,
  MockPaymentCard,
  MockPositionCard,
  MockShiftRow,
} from "./mock-cards";

/**
 * 3D-tilted marquee of mock product cards. Multiple columns drift upward
 * at different speeds; the parent container has a CSS perspective rotation
 * so the whole thing reads as panels flying past at an angle.
 *
 * Inspired by lightswind.com/components/3d-marquee, built from scratch
 * with motion + CSS transforms (no extra deps, no three.js).
 */

const COLUMN_DURATION_BASE_S = 38;

// Build columns from the mock-card pool. Each column has different content
// and a unique speed so adjacent columns don't sync.
const columns: ReactNode[][] = [
  [
    <MockClockCard key="clock-a" />,
    <MockGroupCard key="group-a" />,
    <MockShiftRow key="shift-a" />,
    <MockInvitationCard key="invite-a" />,
    <MockMemberRow key="member-a" />,
  ],
  [
    <MockMemberRow key="member-b" />,
    <MockPositionCard key="pos-b" />,
    <MockPaymentCard key="pay-b" />,
    <MockShiftRow key="shift-b" />,
    <MockGroupCard key="group-b" />,
  ],
  [
    <MockPaymentCard key="pay-c" />,
    <MockClockCard key="clock-c" />,
    <MockMembersCount key="count-c" />,
    <MockMemberRow key="member-c" />,
    <MockPositionCard key="pos-c" />,
  ],
  [
    <MockPositionCard key="pos-d" />,
    <MockShiftRow key="shift-d" />,
    <MockGroupCard key="group-d" />,
    <MockClockCard key="clock-d" />,
    <MockMembersCount key="count-d" />,
  ],
  [
    <MockMembersCount key="count-e" />,
    <MockMemberRow key="member-e" />,
    <MockInvitationCard key="invite-e" />,
    <MockPaymentCard key="pay-e" />,
    <MockShiftRow key="shift-e" />,
  ],
];

export function Marquee3D() {
  return (
    <div
      className="pointer-events-none relative h-[640px] w-full select-none overflow-hidden"
      style={{ perspective: "1400px" }}
    >
      {/* Edge fade so cards don't appear/disappear with hard cuts. */}
      <div
        aria-hidden
        className="absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(to bottom, var(--color-background) 0%, transparent 18%, transparent 82%, var(--color-background) 100%), linear-gradient(to right, var(--color-background) 0%, transparent 12%, transparent 88%, var(--color-background) 100%)",
        }}
      />

      <div
        className="absolute inset-0 flex items-center justify-center gap-6"
        style={{
          transform:
            "rotateX(45deg) rotateY(0deg) rotateZ(-30deg) translateZ(-40px) scale(1.4)",
          transformOrigin: "center center",
          transformStyle: "preserve-3d",
        }}
      >
        {columns.map((col, i) => {
          // Alternate direction (up / down) so the eye keeps moving.
          const direction = i % 2 === 0 ? -1 : 1;
          const duration = COLUMN_DURATION_BASE_S + i * 6;
          const items = [...col, ...col]; // doubled for seamless wrap

          return (
            <motion.div
              key={i}
              className="flex flex-col gap-4"
              animate={{ y: direction === -1 ? ["0%", "-50%"] : ["-50%", "0%"] }}
              transition={{
                duration,
                ease: "linear",
                repeat: Infinity,
              }}
            >
              {items.map((card, j) => (
                <div key={j}>{card}</div>
              ))}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
