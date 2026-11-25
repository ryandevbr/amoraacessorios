import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  centered?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: {
    gap: "gap-2.5",
    icon: "h-7 w-7",
    wordmark: "text-xl sm:text-2xl tracking-[0.22em]",
    subtitle: "text-[8px] tracking-[0.36em] mt-0.5",
  },
  md: {
    gap: "gap-3",
    icon: "h-8 w-8 sm:h-9 sm:w-9",
    wordmark: "text-2xl sm:text-[26px] tracking-[0.22em]",
    subtitle: "text-[8.5px] sm:text-[9px] tracking-[0.38em] mt-0.5",
  },
  lg: {
    gap: "gap-3.5",
    icon: "h-10 w-10 sm:h-11 sm:w-11",
    wordmark: "text-3xl sm:text-4xl tracking-[0.24em]",
    subtitle: "text-[10px] tracking-[0.4em] mt-1",
  },
} as const;

export function BrandLogo({ size = "md", centered = false, className }: BrandLogoProps) {
  const styles = SIZE_CLASSES[size];

  return (
    <span
      className={cn(
        "inline-flex items-center select-none shrink-0",
        centered && "justify-center",
        styles.gap,
        className,
      )}
    >
      <svg
        viewBox="0 0 48 44"
        fill="none"
        aria-hidden="true"
        className={cn("shrink-0 text-gold", styles.icon)}
      >
        <path
          d="M24 40L4 17.5L11.5 7.5L18.5 5L24 9.5L29.5 5L36.5 7.5L44 17.5L24 40Z"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path
          d="M4 17.5H44M11.5 7.5L15 17.5L24 40L33 17.5L36.5 7.5M24 9.5L15 17.5M24 9.5L33 17.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M41.5 3.5L42.3 5.7L44.5 6.5L42.3 7.3L41.5 9.5L40.7 7.3L38.5 6.5L40.7 5.7L41.5 3.5Z"
          fill="currentColor"
        />
      </svg>
      <span className={cn("flex flex-col leading-none", centered ? "items-center" : "items-start")}>
        <span
          className={cn(
            "font-display font-semibold uppercase text-primary leading-none",
            styles.wordmark,
          )}
        >
          AMORA
        </span>
        <span
          className={cn(
            "font-sans font-medium uppercase text-gold inline-flex items-center gap-1.5 leading-none",
            styles.subtitle,
          )}
        >
          <span aria-hidden="true" className="h-px w-2.5 bg-gold-light" />
          ACESSÓRIOS
          <span aria-hidden="true" className="h-px w-2.5 bg-gold-light" />
        </span>
      </span>
    </span>
  );
}
