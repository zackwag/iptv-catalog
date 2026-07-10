import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface Props {
  streamUrl: string;
}

export default function StreamPreview({ streamUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setLoading(true);

    const proxied = `/api/stream-proxy?url=${encodeURIComponent(streamUrl)}`;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hlsRef.current = hls;
      hls.loadSource(proxied);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError("Stream unavailable or unsupported format.");
          setLoading(false);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = proxied;
      video.addEventListener("loadedmetadata", () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      video.addEventListener("error", () => {
        setError("Stream unavailable or unsupported format.");
        setLoading(false);
      });
    } else {
      setError("HLS playback is not supported in this browser.");
      setLoading(false);
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.src = "";
    };
  }, [streamUrl]);

  return (
    <div style={{ marginBottom: 16, borderRadius: 8, overflow: "hidden", background: "#000", position: "relative" }}>
      {loading && !error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 13 }}>
          Loading stream…
        </div>
      )}
      {error ? (
        <div style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
          {error}
        </div>
      ) : (
        <video
          ref={videoRef}
          controls
          muted
          style={{ width: "100%", display: "block", maxHeight: 220 }}
        />
      )}
    </div>
  );
}
