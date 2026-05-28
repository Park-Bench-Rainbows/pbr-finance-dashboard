import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  title?: string;
};

export function BrandMark({ className, title = "Hey Bud" }: BrandMarkProps) {
  return (
    <img
      // src="/heybud-logo.png"
      src="/brand-mark2.png"
      alt={title}
      title={title}
      className={cn("block h-10 w-auto object-contain", className)}
    
      // width={200}
      // height={200}
    />
  );
}
