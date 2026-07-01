"use client";

// Renders an avatar which is either an emoji (built-in) or an uploaded image
// (custom avatar key -> image map). Falls back to a detective emoji.

export interface CustomAvatar {
  key: string;
  name: string;
  image: string;
  price: number;
}

export function AvatarView({
  value,
  map,
  className = "",
  size = "1.75rem",
}: {
  value: string | null | undefined;
  map?: Record<string, string>;
  className?: string;
  size?: string;
}) {
  const img = value && map ? map[value] : undefined;
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={img}
        alt="avatar"
        className={`inline-block rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span className={className} style={{ fontSize: size, lineHeight: 1 }}>
      {value || "🕵️"}
    </span>
  );
}
