import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-white text-black hover:bg-neutral-200",
        outline: "border border-white/20 bg-transparent hover:bg-white/5",
        ghost: "hover:bg-white/8",
        paper: "bg-[#12141a] text-[#eef1f6] hover:bg-[#1c2028]",
        paperOutline:
          "border border-black/15 bg-transparent text-[#12141a] hover:bg-black/5",
        currentOutline:
          "border border-current/15 bg-transparent hover:bg-current/5",
        subtle: "bg-transparent text-neutral-500 hover:text-current",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
        pill: "px-6 py-3",
        "pill-sm": "px-5 py-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
