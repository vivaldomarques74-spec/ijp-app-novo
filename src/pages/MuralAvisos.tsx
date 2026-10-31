import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { useNavigate } from "react-router-dom";

export default function MuralAvisos() {
  const navigate = useNavigate();
  const [avisos, setAvisos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      try {
        const alunoSalvo = localStorage.getItem("portalAluno") || sessionStorage.getItem("portalAluno");
        const aluno = alunoSalvo ? JSON.parse(alunoSalvo) : null;

        const snap = await getDocs(collection(db, "comunicados"));
        // 👇 AQUI ESTAVA O ERRO: Adicionado o ": any[]" para o TS parar de reclamar
        const todosAvisos: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const filtrados = todosAvisos.filter((aviso: any) => {
          if (aviso.publicoAlvo === "todos") return true;
          if (aviso.publicoAlvo === "alunos" && aluno) return true;
          if (aviso.publicoAlvo === "turma" && aluno) return true; 
          return false;
        });

        filtrados.sort((a, b) => (b.dataPublicacao?.toMillis() || 0) - (a.dataPublicacao?.toMillis() || 0));
        setAvisos(filtrados);
      } catch (e) {
        console.error(e);
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, []);

  const formatarData = (ts: any) => {
    if (!ts) return "Agora";
    return new Date(ts.toMillis()).toLocaleDateString("pt-BR");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", paddingBottom: 40 }}>
      <div style={{ background: "#1a2a4f", padding: "20px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 24, cursor: "pointer" }}>←</button>
        <h1 style={{ color: "#fff", fontSize: 20, margin: 0 }}>Mural de Avisos</h1>
      </div>

      <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
        {carregando && <p style={{ textAlign: "center", color: "#6b7a8f" }}>Carregando avisos...</p>}
        
        {!carregando && avisos.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#6b7a8f" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
            <p>Nenhum aviso novo no momento.</p>
          </div>
        )}

        {avisos.map(aviso => (
          <div key={aviso.id} style={{ background: "#fff", padding: 20, borderRadius: 16, marginBottom: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", borderLeft: "4px solid #0070f3" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: "#e6f0ff", color: "#0070f3", padding: "4px 8px", borderRadius: 6 }}>{aviso.categoria}</span>
              <span style={{ fontSize: 12, color: "#8a99ad" }}>{formatarData(aviso.dataPublicacao)}</span>
            </div>
            <h3 style={{ margin: "0 0 8px", color: "#1a2a4f", fontSize: 16 }}>{aviso.titulo}</h3>
            <p style={{ margin: 0, color: "#4a5a6f", fontSize: 14, lineHeight: 1.5 }}>{aviso.mensagem}</p>
          </div>
        ))}
      </div>
    </div>
  );
}