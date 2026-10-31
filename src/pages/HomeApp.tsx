import { useNavigate } from "react-router-dom";

export default function HomeApp() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100vh",
      width: "100vw",
      // O fundo agora é a imagem vertical. 
      // Você precisará salvar a imagem como 'home-bg.jpg' na pasta 'public' do projeto.
      backgroundImage: "url('/home-bg.jpg')", 
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-end", // Joga os botões para a parte de baixo
      padding: "40px 24px 60px", // Espaço extra embaixo para não colar na borda
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      boxSizing: "border-box"
    }}>
      
      {/* A logo não é mais necessária aqui no código, pois já está na imagem de fundo */}

      {/* Container dos Botões */}
      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 16 }}>
        
        <button onClick={() => navigate("/publico")} style={{
          width: "100%", padding: "16px", 
          background: "rgba(255, 255, 255, 0.9)", // Branco translúcido
          color: "#1a2a4f",
          border: "2px solid #1a2a4f", borderRadius: 12, fontSize: 16, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          backdropFilter: "blur(4px)" // Efeito de vidro
        }}>
          🌍 CONHECER O IJP
        </button>

        <button onClick={() => navigate("/portal")} style={{
          width: "100%", padding: "16px", 
          background: "rgba(26, 42, 79, 0.95)", // Azul escuro translúcido
          color: "#fff",
          border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          backdropFilter: "blur(4px)"
        }}>
          🎓 SOU ALUNO
        </button>

      </div>
    </div>
  );
}