import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "../services/firebase";

export default function AdminComunicados() {
  const [comunicados, setComunicados] = useState<any[]>([]);
  const [cursos, setCursos] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [statusEnvio, setStatusEnvio] = useState("");

  const [form, setForm] = useState({
    titulo: "",
    mensagem: "",
    categoria: "Geral",
    publicoAlvo: "todos", // todos | alunos | turma
    cursoId: "",
    turmaId: "",
    notificarPush: true, // 👈 Checkbox para disparar push
  });

  useEffect(() => {
    carregarComunicados();
    const carregarCursos = async () => {
      const c = await getDocs(collection(db, "cursos"));
      setCursos(c.docs.map(d => ({ id: d.id, nome: d.data().nome })));
    };
    carregarCursos();
  }, []);

  useEffect(() => {
    if (!form.cursoId) { setTurmas([]); return; }
    const carregarTurmas = async () => {
      const snap = await getDocs(collection(db, "cursos", form.cursoId, "turmas"));
      setTurmas(snap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
    };
    carregarTurmas();
  }, [form.cursoId]);

  const carregarComunicados = async () => {
    const snap = await getDocs(collection(db, "comunicados"));
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a: any, b: any) => (b.dataPublicacao?.toMillis() || 0) - (a.dataPublicacao?.toMillis() || 0));
    setComunicados(lista);
  };

  const handleChange = (campo: string, valor: any) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const enviarComunicado = async () => {
    if (!form.titulo.trim() || !form.mensagem.trim()) return alert("Preencha título e mensagem.");
    if (form.publicoAlvo === "turma" && (!form.cursoId || !form.turmaId)) return alert("Selecione o curso e a turma.");

    setSalvando(true);
    setStatusEnvio("Salvando no mural...");

    try {
      let nomeTurma = "";
      if (form.publicoAlvo === "turma") {
        const t = turmas.find(t => t.id === form.turmaId);
        nomeTurma = t ? t.nome : "";
      }

      // 1. Salva no Firestore
      await addDoc(collection(db, "comunicados"), {
        titulo: form.titulo,
        mensagem: form.mensagem,
        categoria: form.categoria,
        publicoAlvo: form.publicoAlvo,
        cursoId: form.publicoAlvo === "turma" ? form.cursoId : null,
        turmaId: form.publicoAlvo === "turma" ? form.turmaId : null,
        nomeTurma: nomeTurma,
        dataPublicacao: serverTimestamp(),
        status: "publicado"
      });

      // 2. Dispara Push se o checkbox estiver marcado
      if (form.notificarPush) {
        setStatusEnvio("Disparando notificações push...");
        
        try {
          const response = await fetch('/api/notificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titulo: form.titulo,
              mensagem: form.mensagem,
              publicoAlvo: form.publicoAlvo,
              cursoId: form.cursoId,
              turmaId: form.turmaId
            })
          });

          const data = await response.json();
          
          if (response.ok) {
            alert(`✅ Comunicado salvo e notificação enviada! Entregues: ${data.enviados} celulares.`);
          } else {
            alert(`⚠️ Comunicado salvo, mas houve um erro no push: ${data.error}`);
          }
        } catch (err) {
          console.error("Erro na API:", err);
          alert("⚠️ Comunicado salvo, mas não foi possível conectar à API de notificação.");
        }
      } else {
        alert("✅ Comunicado salvo no mural (sem push).");
      }

      // Limpa o formulário
      setForm({ titulo: "", mensagem: "", categoria: "Geral", publicoAlvo: "todos", cursoId: "", turmaId: "", notificarPush: true });
      carregarComunicados();
    } catch (e: any) {
      alert("Erro: " + e.message);
    } finally {
      setSalvando(false);
      setStatusEnvio("");
    }
  };

  const excluir = async (id: string) => {
    if (!window.confirm("Apagar este comunicado do mural?")) return;
    await deleteDoc(doc(db, "comunicados", id));
    carregarComunicados();
  };

  const sInput = { width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8, marginBottom: 12 };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <h2>Central de Comunicação</h2>
      
      <div style={{ background: "#fff", padding: 20, borderRadius: 12, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <h3 style={{ marginTop: 0, color: "#1a2a4f" }}>Novo Comunicado</h3>
        
        <label style={{ fontWeight: 600 }}>Título:</label>
        <input type="text" value={form.titulo} onChange={e => handleChange("titulo", e.target.value)} style={sInput} placeholder="Ex: Aviso Importante" />

        <label style={{ fontWeight: 600 }}>Mensagem:</label>
        <textarea value={form.mensagem} onChange={e => handleChange("mensagem", e.target.value)} style={{ ...sInput, minHeight: 100 }} placeholder="Digite o conteúdo do aviso..." />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontWeight: 600 }}>Categoria:</label>
            <select value={form.categoria} onChange={e => handleChange("categoria", e.target.value)} style={sInput}>
              <option value="Geral">Geral</option>
              <option value="Aula Cancelada">Aula Cancelada</option>
              <option value="Matrículas">Matrículas</option>
              <option value="Evento">Evento</option>
              <option value="Saúde">Saúde</option>
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Público-Alvo:</label>
            <select value={form.publicoAlvo} onChange={e => handleChange("publicoAlvo", e.target.value)} style={sInput}>
              <option value="todos">Todos (Visitantes e Alunos)</option>
              <option value="alunos">Todos os Alunos</option>
              <option value="turma">Turma Específica</option>
            </select>
          </div>
        </div>

        {form.publicoAlvo === "turma" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontWeight: 600 }}>Curso:</label>
              <select value={form.cursoId} onChange={e => handleChange("cursoId", e.target.value)} style={sInput}>
                <option value="">Selecione</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 600 }}>Turma:</label>
              <select value={form.turmaId} onChange={e => handleChange("turmaId", e.target.value)} style={sInput} disabled={!form.cursoId}>
                <option value="">Selecione</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          </div>
        )}

        <div style={{ background: "#eef2f7", padding: 12, borderRadius: 8, marginTop: 8, marginBottom: 16, border: "1px solid #dbe6f3" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, color: "#1a2a4f" }}>
            <input 
              type="checkbox" 
              checked={form.notificarPush} 
              onChange={e => handleChange("notificarPush", e.target.checked)} 
              style={{ width: 18, height: 18, cursor: "pointer" }}
            />
            📱 Disparar notificação push nos celulares agora
          </label>
          <p style={{ margin: "4px 0 0 26px", fontSize: 12, color: "#6b7a8f" }}>
            Se desmarcado, o aviso ficará apenas no Mural do app.
          </p>
        </div>

        <button 
          onClick={enviarComunicado} 
          disabled={salvando} 
          style={{ 
            padding: "12px 24px", 
            background: salvando ? "#6c757d" : "#0070f3", 
            color: "#fff", 
            border: "none", 
            borderRadius: 8, 
            fontWeight: 600, 
            cursor: salvando ? "wait" : "pointer",
            width: "100%",
            fontSize: 16,
            transition: "all 0.2s"
          }}
        >
          {salvando ? statusEnvio : "🚀 Publicar Comunicado"}
        </button>
      </div>

      <h3 style={{ color: "#1a2a4f" }}>Comunicados Anteriores</h3>
      {comunicados.length === 0 && <p style={{ color: "#6b7a8f" }}>Nenhum comunicado enviado ainda.</p>}
      
      {comunicados.map(c => (
        <div key={c.id} style={{ background: "#fff", padding: 16, borderRadius: 12, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ flex: 1 }}>
            <strong style={{ color: "#1a2a4f", fontSize: 16 }}>{c.titulo}</strong>
            <p style={{ margin: "4px 0", fontSize: 14, color: "#4a5a6f" }}>{c.mensagem}</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 11, background: "#e6f0ff", color: "#0070f3", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>
                {c.categoria}
              </span>
              <span style={{ fontSize: 11, background: "#f4f6f9", color: "#6b7a8f", padding: "4px 8px", borderRadius: 6 }}>
                {c.publicoAlvo === "turma" ? `Turma: ${c.nomeTurma}` : c.publicoAlvo === "alunos" ? "Todos os Alunos" : "Todos"}
              </span>
            </div>
          </div>
          <button onClick={() => excluir(c.id)} style={{ background: "#fff", color: "#dc3545", border: "1px solid #dc3545", padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 600, marginLeft: 16 }}>
            Excluir
          </button>
        </div>
      ))}
    </div>
  );
}