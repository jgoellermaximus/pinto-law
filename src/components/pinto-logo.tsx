import Image from "next/image";

export function PintoLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Pinto Law"
      width={size}
      height={Math.round(size * 1.2)}
      className={className ?? "object-contain"}
      unoptimized
    />
  );
}