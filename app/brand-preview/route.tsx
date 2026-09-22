import { ImageResponse } from "next/og";

export const runtime = "nodejs";

const brandIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="20" fill="#7D1F37"/><g fill="none" stroke="#FFF9F4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="23" width="36" height="25" rx="5" stroke-width="3.2"/><path d="M14 26 32 38 50 26" stroke-width="3.2"/><path d="m25 36-9 9m23-9 9 9" stroke-width="2.8"/></g><path d="m48 10 2.2 5.8L56 18l-5.8 2.2L48 26l-2.2-5.8L40 18l5.8-2.2L48 10Z" fill="#F0C88C"/></svg>`;
const brandIconData = `data:image/svg+xml;base64,${Buffer.from(brandIcon).toString("base64")}`;

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
          background: "linear-gradient(112deg, #FFFDFB 0%, #FBF5F1 64%, #F4E7E0 100%)",
          color: "#351820",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", position: "absolute", top: -220, right: -170, width: 570, height: 570, borderRadius: 570, backgroundColor: "#F0DBDC" }} />
        <div style={{ display: "flex", position: "absolute", right: 30, bottom: -290, width: 610, height: 610, borderRadius: 610, backgroundColor: "#F8EAE0" }} />
        <div style={{ display: "flex", position: "absolute", top: 58, left: 62, alignItems: "center" }}>
          <img src={brandIconData} width="68" height="68" alt="" />
          <div style={{ display: "flex", marginLeft: 15, alignItems: "baseline", fontSize: 47, fontWeight: 700, letterSpacing: -2, color: "#51202F" }}>
            convidata<span style={{ color: "#BA795A" }}>.</span>
          </div>
        </div>

        <div style={{ display: "flex", position: "absolute", left: 62, top: 171, width: 690, flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1, color: "#351820" }}>
            Um convite especial
          </div>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1, color: "#7D1F37" }}>
            para reunir quem importa.
          </div>
          <div style={{ display: "flex", maxWidth: 620, marginTop: 26, fontSize: 26, lineHeight: 1.38, color: "#725F63" }}>
            Personalize seu convite, acompanhe as confirmações de presença e organize sua lista de presentes.
          </div>
          <div style={{ display: "flex", marginTop: 30, gap: 10 }}>
            {["Convites digitais", "Confirmações", "Presentes"].map((item) => (
              <div key={item} style={{ display: "flex", background: "#F4E7E0", border: "1px solid #E5CDC8", borderRadius: 40, padding: "11px 15px", color: "#7D1F37", fontSize: 18, fontWeight: 700 }}>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", position: "absolute", right: 85, top: 135, width: 286, height: 342, background: "#BA795A", borderRadius: 20, transform: "rotate(9deg)", boxShadow: "0 20px 50px rgba(81,32,47,.14)" }} />
        <div style={{ display: "flex", position: "absolute", right: 109, top: 109, width: 286, height: 342, padding: 27, background: "#FFFCF8", borderRadius: 18, border: "2px solid #DEC5B2", transform: "rotate(3deg)", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 15px 38px rgba(81,32,47,.13)" }}>
          <div style={{ display: "flex", color: "#967A6E", fontSize: 15, letterSpacing: 2 }}>VOCÊ ESTÁ CONVIDADO(A)</div>
          <div style={{ display: "flex", fontSize: 47, color: "#BA795A", marginTop: 22 }}>♡</div>
          <div style={{ display: "flex", color: "#51202F", fontSize: 32, fontWeight: 700, textAlign: "center", lineHeight: 1.15, marginTop: 13 }}>Momentos especiais</div>
          <div style={{ display: "flex", color: "#886A72", fontSize: 16, textAlign: "center", marginTop: 22 }}>começam com pessoas especiais</div>
          <div style={{ display: "flex", width: 70, height: 2, marginTop: 21, background: "#F0C88C" }} />
        </div>

        <div style={{ display: "flex", position: "absolute", bottom: 0, left: 0, right: 0, height: 71, paddingLeft: 62, paddingRight: 62, alignItems: "center", background: "#7D1F37" }}>
          <div style={{ display: "flex", color: "#FFF9F4", fontSize: 23, fontWeight: 700 }}>Seu momento especial, do seu jeito.</div>
          <div style={{ display: "flex", marginLeft: "auto", color: "#F0C88C", fontSize: 17, letterSpacing: 1.5 }}>CONVITES QUE APROXIMAM</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
