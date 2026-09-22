import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "linear-gradient(120deg, #ffffff 0%, #f7fbf6 76%, #e8f4e9 100%)",
          color: "#16382e",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            width: 370,
            height: 370,
            top: -245,
            right: -85,
            borderRadius: "100%",
            backgroundColor: "#e1f1e3",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            width: 450,
            height: 450,
            right: -170,
            bottom: -285,
            borderRadius: "100%",
            backgroundColor: "#e4f4e5",
          }}
        />

        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 54,
            top: 42,
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 62,
              height: 62,
              borderRadius: 20,
              backgroundColor: "#e2f3e6",
              color: "#2f7956",
              fontSize: 44,
            }}
          >
            ♡
          </div>
          <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>
            Convidata
          </div>
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 156,
            left: 56,
            width: 690,
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", fontSize: 62, lineHeight: 1.08, fontWeight: 700, letterSpacing: -2 }}>
            Convites digitais para
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 62,
              lineHeight: 1.09,
              fontWeight: 700,
              letterSpacing: -2,
              color: "#548766",
            }}
          >
            momentos especiais
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: 610,
              marginTop: 29,
              fontSize: 27,
              lineHeight: 1.4,
              color: "#486158",
            }}
          >
            Crie convites personalizados, acompanhe as confirmações de presença e organize sua lista de presentes.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 31 }}>
            {["Convites", "Confirmações", "Presentes"].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 99,
                  backgroundColor: "#e9f5e9",
                  border: "1px solid #c9e6d0",
                  padding: "10px 16px",
                  color: "#286345",
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 112,
            right: 82,
            width: 300,
            height: 385,
            borderRadius: 20,
            backgroundColor: "#b9d4c0",
            transform: "rotate(8deg)",
            boxShadow: "0 22px 45px rgba(23,65,43,0.12)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 92,
            right: 103,
            width: 300,
            height: 385,
            padding: "32px 27px",
            border: "2px solid #e7d9b8",
            borderRadius: 17,
            backgroundColor: "#fffefb",
            transform: "rotate(3deg)",
            boxShadow: "0 16px 34px rgba(23,65,43,0.10)",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", color: "#648674", fontSize: 16, letterSpacing: 3 }}>
            VOCÊ ESTÁ CONVIDADO(A)
          </div>
          <div style={{ display: "flex", marginTop: 25, fontSize: 64, color: "#b89a61" }}>♡</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 36, lineHeight: 1.18, fontWeight: 700, textAlign: "center" }}>
            Momentos especiais
          </div>
          <div style={{ display: "flex", marginTop: 26, color: "#648674", fontSize: 17, textAlign: "center" }}>
            começam com pessoas especiais
          </div>
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            paddingLeft: 57,
            paddingRight: 57,
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#e6f4e8",
            color: "#315b46",
          }}
        >
          <div style={{ display: "flex", fontSize: 23, fontWeight: 700 }}>
            convidata.netlify.app
          </div>
          <div style={{ display: "flex", fontSize: 17, letterSpacing: 2 }}>
            MAIS MOMENTOS ESPECIAIS, JUNTOS
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
