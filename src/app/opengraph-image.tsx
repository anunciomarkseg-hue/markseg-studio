import { ImageResponse } from "next/og";

export const alt = "MarkSeg Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "linear-gradient(135deg, #1c6fce 0%, #2a82e4 45%, #f26a2c 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 118, fontWeight: 700, letterSpacing: -2, display: "flex" }}>
          MarkSeg Studio
        </div>
        <div style={{ fontSize: 44, marginTop: 6, opacity: 0.95, display: "flex" }}>
          Agende e publique nas redes sociais
        </div>
        <div style={{ fontSize: 28, marginTop: 44, opacity: 0.85, display: "flex" }}>
          studio.markseg.com.br
        </div>
      </div>
    ),
    size,
  );
}
