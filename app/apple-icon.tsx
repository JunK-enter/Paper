import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F7F5F0",
          color: "#25231F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 96,
          fontFamily: "Georgia, serif",
        }}
      >
        P
      </div>
    ),
    size,
  );
}
