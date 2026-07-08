"use client";

import { type ReactNode } from "react";
import { PackageOpen, Plus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  const prefersReduced = useReducedMotion();

  return (
    <div
      className={`relative flex w-full min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-12 ${className}`}
    >
      {/* Dots pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
        style={{
          backgroundImage: "radial-gradient(rgba(59, 130, 246, 0.35) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Glass container */}
      <div
        className="relative flex flex-col items-center gap-6 px-8 py-10 sm:px-12 sm:py-12 max-w-md w-full rounded-2xl"
        style={{
          background: "rgba(var(--card-rgb, 255, 255, 255), 0.75)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(var(--border-rgb, 148, 163, 184), 0.2)",
          boxShadow: "0 8px 32px -8px rgba(0,0,0,0.1), 0 0 0 1px rgba(59, 130, 246, 0.06)",
        }}
      >
        {/* Animated icon container */}
        <motion.div
          animate={
            prefersReduced
              ? undefined
              : { y: [0, -8, 0] }
          }
          transition={
            prefersReduced
              ? undefined
              : { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
          }
          className="flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.15)",
          }}
        >
          {icon ?? (
            <PackageOpen size={36} strokeWidth={1.5} color="#3b82f6" />
          )}
        </motion.div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-foreground">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-muted max-w-xs">
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {actionLabel && onAction && (
            <Button onClick={onAction} className="gap-2">
              <Plus size={15} strokeWidth={2.5} />
              {actionLabel}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
