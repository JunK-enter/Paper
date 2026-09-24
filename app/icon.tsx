import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 280,
          fontFamily: "Georgia, serif",
          letterSpacing: "-0.06em",
        }}
      >
        P
      </div>
    ),
    size,
  );
}
