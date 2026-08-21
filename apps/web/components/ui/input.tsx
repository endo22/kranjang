import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-[#d9d9dd] bg-white px-3 py-2 text-sm text-[#212121] outline-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#75758a] focus-visible:border-[#9b60aa] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
