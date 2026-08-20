"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[32px] text-[0.875rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4c6ee6] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#17171c] px-6 py-3 !text-[#ffffff] hover:bg-[#212121] hover:!text-[#ffffff]",
        outline: "border border-[#17171c] bg-transparent px-6 py-3 !text-[#17171c] hover:bg-[#17171c]/5",
        secondary:
          "h-auto bg-transparent px-0 py-0 text-[1rem] font-normal !text-[#212121] underline underline-offset-4 shadow-none hover:bg-transparent hover:!text-[#17171c]",
        ghost: "rounded-xl px-4 py-2 !text-[#17171c] hover:bg-[#17171c]/5",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-4 text-[0.8125rem]",
        lg: "h-12 px-7 text-[1rem]",
        icon: "h-10 w-10 rounded-full",
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
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
