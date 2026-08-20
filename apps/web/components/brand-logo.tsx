import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

const LOGO_SRC = "/LogoKranjang.png";
const LOGO_WIDTH = 677;
const LOGO_HEIGHT = 369;

const sizes = {
  sm: "h-10 w-auto",
  md: "h-14 w-auto",
  lg: "h-[5.5rem] w-auto",
} as const;

type BrandLogoProps = {
  href?: string | null;
  size?: keyof typeof sizes;
  className?: string;
  priority?: boolean;
  onClick?: () => void;
};

export function BrandLogo({ href = "/", size = "sm", className, priority = false, onClick }: BrandLogoProps) {
  const image = (
    <Image
      src={LOGO_SRC}
      alt="Kranjang"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={cn("object-contain object-left", sizes[size])}
    />
  );

  if (!href) {
    return <span className={cn("inline-flex", className)}>{image}</span>;
  }

  return (
    <Link href={href} className={cn("inline-flex shrink-0", className)} aria-label="Kranjang" onClick={onClick}>
      {image}
    </Link>
  );
}
