import { useNavigate } from "react-router-dom";

export default function AreaPublica() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", paddingBottom: 40 }}>
      <div style={{ background: "#1a2a4f", padding: "20px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 24, cursor: "pointer" }}>
          ←
        </button>
        <h1 style={{ color: "#fff", fontSize: 20, margin: 0 }}>Conheça o IJP</h1>
      </div>
      <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <h2 style={{ color: "#1a2a4f", marginTop: 0 }}>Quem Somos</h2>
          <p style={{ color: "#4a5a6f", lineHeight: 1.6, fontSize: 15 }}>
            O Instituto Jovens Periféricos é uma organização dedicada a transformar a realidade de jovens através da educação, cultura e profissionalização. Acreditamos no potencial da periferia e trabalhamos para abrir portas e criar oportunidades.
          </p>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <h2 style={{ color: "#1a2a4f", marginTop: 0 }}>Oportunidades Abertas</h2>
          <p style={{ color: "#6b7a8f", fontSize: 14 }}>
            Em breve, você poderá acompanhar aqui nossos cursos, oficinas e eventos com inscrições abertas.
          </p>
        </div>
      </div>
    </div>
  );
}