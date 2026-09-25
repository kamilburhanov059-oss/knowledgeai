import Image from "next/image";

export function AppLogo({ size, radius, margin }: { size: number; radius: number; margin?: string }) {
  return (
    <Image
      src="/icons/icon-192.png"
      alt="KnowledgeAI"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, display: "block", margin }}
    />
  );
}
