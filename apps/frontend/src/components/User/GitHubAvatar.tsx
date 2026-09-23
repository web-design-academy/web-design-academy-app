import {type CSSProperties, useState} from "react";
import {User} from "lucide-react";

interface UserAvatarProps {
  url?: string | null;
  className?: string;
  style?: CSSProperties;
  imageSize?: number;
}

export default function GitHubAvatar({
  url,
  className = "",
  style,
  imageSize = 40,
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const sizedUrl = url
    ? `${url}${url.includes("?") ? "&" : "?"}s=${imageSize * 2}`
    : null;

  if (!sizedUrl || hasError) {
    return (
      <div
        className={className}
        style={{
          width: imageSize,
          height: imageSize,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          ...style
        }}
        aria-label="GitHub Avatar"
      >
        <User style={{ width: "60%", height: "60%" }} />
      </div>
    );
  }

  return (
    <img
      src={sizedUrl}
      alt={`GitHub Avatar`}
      width={imageSize}
      height={imageSize}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
      style={{
        aspectRatio: "1 / 1",
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        ...style
      }}
      className={className}
    />
  );
}