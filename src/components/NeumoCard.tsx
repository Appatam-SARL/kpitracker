import type { ReactNode } from "react";
import clsx from "clsx";

interface NeumoCardProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export default function NeumoCard({ children, className, id }: NeumoCardProps) {
  return (
    <div
      id={id}
      className={clsx(
        "rounded-3xl bg-[#f5f5ff] shadow-neu-soft border border-white/50",
        "backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
