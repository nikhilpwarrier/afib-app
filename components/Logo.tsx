import Image from "next/image";

type LogoProps = {
  size?: number;
  dark?: boolean;
  iconOnly?: boolean;
  alt?: string;
};

export default function Logo({
  size = 180,
  dark = false,
  iconOnly = false,
  alt = "AtriaCare",
}: LogoProps) {
  const src = iconOnly
    ? dark
      ? "/icon-dark.svg"
      : "/icon.svg"
    : dark
    ? "/logo-dark.svg"
    : "/logo.svg";

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size} // safe fallback, overridden by style
      priority
      style={{
        width: size,
        height: "auto", // preserves aspect ratio automatically
      }}
    />
  );
}