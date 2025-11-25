import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center whitespace-nowrap rounded-forge text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forge-ember/50 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-forge-ember text-white hover:bg-forge-ember-bright hover:shadow-ember active:scale-[0.98]",
      destructive: "bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]",
      outline: "border border-forge-iron bg-transparent text-forge-silver hover:bg-forge-iron/50 hover:text-stone-100",
      secondary: "bg-forge-iron text-forge-silver hover:bg-forge-iron/80 hover:text-stone-100",
      ghost: "hover:bg-forge-iron/50 hover:text-stone-100 text-forge-silver",
      link: "text-forge-ember underline-offset-4 hover:underline hover:text-forge-ember-bright",
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-forge px-3",
      lg: "h-11 rounded-forge px-8",
      icon: "h-10 w-10",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
