import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf8f4",
          borderRadius: 6,
        }}
      >
        <svg width="18" height="24" viewBox="0 0 120 160">
          <path
            fill="#86641f"
            d="M60 4 112 80 60 156 8 80 60 4Zm0 26L34 80l26 50 26-50L60 30Z"
          />
          <circle cx="60" cy="80" r="12" fill="#86641f" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
