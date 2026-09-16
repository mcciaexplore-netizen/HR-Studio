import { useEffect, useState } from "react";

export function PersonAvatar({
  name,
  src,
  large = false,
}: {
  name: string;
  src?: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials = name
    .replace(/\(Demo\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  const tint = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  return (
    <span
      className={`person-avatar avatar-tint-${tint}${large ? " person-avatar-large" : ""}`}
      aria-hidden="true"
    >
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        initials
      )}
    </span>
  );
}
