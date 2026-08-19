"use client";

import * as React from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      toastOptions={{
        style: {
          borderRadius: "16px",
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          color: "#212121",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
