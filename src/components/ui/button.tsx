// ============================================================
// BUTTON — Design System V2
// Variantes: primary | secondary | ghost | danger
// Tamanhos: sm | md | lg
// ============================================================

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base — compartilhada por todas as variantes
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium rounded-md whitespace-nowrap",
    "transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B8CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]",
    "disabled:pointer-events-none disabled:opacity-40",
    "select-none",
  ],
  {
    variants: {
      variant: {
        // Ação principal — só aparece em CTAs
        primary: [
          "bg-[#5B8CFF] text-white",
          "hover:bg-[#4A7AEE] hover:-translate-y-px",
          "active:translate-y-0 active:bg-[#3D6ADD]",
        ],

        // Ação secundária — bordas, sem preenchimento
        secondary: [
          "bg-transparent border border-[#1F2937] text-[#94A3B8]",
          "hover:border-[#94A3B8] hover:text-[#F8FAFC]",
          "active:bg-[#1E293B]",
        ],

        // Ação terciária — sem borda
        ghost: [
          "bg-transparent text-[#94A3B8]",
          "hover:bg-[#1E293B] hover:text-[#F8FAFC]",
          "active:bg-[#1F2937]",
        ],

        // Ação destrutiva
        danger: [
          "bg-[rgba(239,68,68,0.10)] text-[#EF4444]",
          "hover:bg-[#EF4444] hover:text-white",
          "active:bg-[#DC2626]",
        ],

        // Link inline
        link: [
          "bg-transparent text-[#5B8CFF] underline-offset-4",
          "hover:underline hover:text-[#4A7AEE]",
          "h-auto p-0",
        ],
      },

      size: {
        sm: "h-[36px] px-4 text-[13px]",
        md: "h-[40px] px-5 text-[13px]",
        lg: "h-[44px] px-6 text-[14px]",
        icon: "h-[36px] w-[36px] p-0",
        "icon-sm": "h-[28px] w-[28px] p-0",
      },
    },

    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            {/* Spinner minimalista */}
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
