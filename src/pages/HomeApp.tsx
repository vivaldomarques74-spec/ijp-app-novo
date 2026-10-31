import { useNavigate } from "react-router-dom";

export default function HomeApp() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #eef2f7 0%, #dbe6f3 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "24px", fontFamily: "'Segoe UI', system-ui, sans-serif"
    }}>
      <img src="/logo-ijp.png" alt="IJP" style={{ width: 140, height: 140, objectFit: "contain", marginBottom: 16 }} />
      <h1 style={{ color: "#1a2a4f", fontSize: 28, margin: 0, textAlign: "center" }}>
        Instituto Jovens<br/>Periféricos
      </h1>
      <p style={{ color: "#6b7a8f", marginTop: 8, marginBottom: 40, textAlign: "center", fontSize: 15 }}>
        Transformando vidas através da educação.
      </p>

      <button onClick={() => navigate("/publico")} style={{
        width: "100%", maxWidth: 340, padding: "16px", background: "#fff", color: "#1a2a4f",
        border: "2px solid #1a2a4f", borderRadius: 12, fontSize: 16, fontWeight: 700, marginBottom: 16,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>
        🌍 CONHECER O IJP
      </button>

      <button onClick={() => navigate("/portal")} style={{
        width: "100%", maxWidth: 340, padding: "16px", background: "#1a2a4f", color: "#fff",
        border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        boxShadow: "0 4px 12px rgba(26,42,79,0.2)"
      }}>
        🎓 SOU ALUNO
      </button>
    </div>
  );
}