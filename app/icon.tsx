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
          background: "#F8FAFC",
          borderRadius: 8,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <rect x="5" y="6" width="16" height="11" rx="2.5" stroke="#1E293B" strokeWidth="1.6" />
          <path d="M9 19.5h8" stroke="#1E293B" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M10 8.5c4 0 7.5 2 10 5"
            stroke="url(#g)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="g" x1="10" y1="8.5" x2="20.5" y2="13.5" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F97316" />
              <stop offset="0.25" stopColor="#FACC15" />
              <stop offset="0.5" stopColor="#22C55E" />
              <stop offset="0.75" stopColor="#3B82F6" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    ),
    size
  );
}

