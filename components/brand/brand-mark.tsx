import { cn } from "@/lib/utils";
import Image from "next/image";

type BrandMarkProps = {
  className?: string;
  title?: string;
};

export function BrandMark({ className, title = "Hey Bud" }: BrandMarkProps) {
  return (
    <img
      src="/heybud-logo.png"
      alt={title}
      title={title}
      className={cn("inline-block object-contain")}
      style={{ width: "200px", height: "50px" }}
    
      // width={200}
      // height={200}
    />
  );
}
