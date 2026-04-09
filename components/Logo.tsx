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

  const width = iconOnly ? size : size;
  const height = iconOnly ? size : Math.round(size * 0.26);

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority
      style={{
        width: iconOnly ? `${size}px` : `${size}px`,
        height: iconOnly ? `${size}px` : "auto",
      }}
    />
  );
}