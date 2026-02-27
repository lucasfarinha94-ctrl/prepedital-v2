// ============================================================
// CARD — Design System V2
// Hierarquia: base | raised | interactive
// Máximo 5 elementos por card, 3 níveis de hierarquia
// ============================================================

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-lg border transition-all duration-200",
  {
    variants: {
      variant: {
        // Nível 1 — card padrão
        base: [
          "bg-[#111827] border-[#1F2937]",
          "hover:border-[rgba(91,140,255,0.25)] hover:-translate-y-px",
        ],

        // Nível 2 — card elevado / selecionado
        raised: [
          "bg-[#1E293B] border-[rgba(91,140,255,0.15)]",
          "shadow-[0_0_0_1px_rgba(91,140,255,0.06)]",
        ],

        // Nível 3 — card de métricas / hero
        hero: [
          "bg-[#111827] border-[#1F2937]",
          "hover:border-[rgba(91,140,255,0.30)] hover:-translate-y-px",
        ],

        // Transparente — sem fundo
        ghost: [
          "bg-transparent border-transparent",
          "hover:bg-[#1E293B]",
        ],
      },

      padding: {
        none: "p-0",
        sm:   "p-4",
        md:   "p-5",
        lg:   "p-6",
      },
    },

    defaultVariants: {
      variant: "base",
      padding: "md",
    },
  }
);

// ── CARD ROOT ────────────────────────────────────────────────

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  )
);
Card.displayName = "Card";

// ── CARD HEADER ──────────────────────────────────────────────

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

// ── CARD TITLE ───────────────────────────────────────────────

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-base font-semibold text-[#F8FAFC] leading-tight tracking-tight",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

// ── CARD DESCRIPTION ─────────────────────────────────────────

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[#94A3B8] leading-relaxed", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

// ── CARD CONTENT ─────────────────────────────────────────────

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-4", className)} {...props} />
));
CardContent.displayName = "CardContent";

// ── CARD FOOTER ──────────────────────────────────────────────

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center pt-4 mt-4 border-t border-[rgba(31,41,55,0.4)]",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
