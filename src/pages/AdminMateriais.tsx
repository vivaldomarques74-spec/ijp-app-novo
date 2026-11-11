import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../services/firebase";

export default function AdminMateriais() {
  const [cursos, setCursos] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ titulo: "", cursoId: "", turmaId: "" });

  useEffect(() => {
    getDocs(collection(db, "cursos")).then(snap => {
      setCursos(snap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
    });
  }, []);

  useEffect(() => {
    if (!form.cursoId) { setTurmas([]); return; }
    getDocs(collection(db, "cursos", form.cursoId, "turmas")).then(snap => {
      setTurmas(snap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
    });
  }, [form.cursoId]);

  const handleUpload = async () => {
    if (!form.titulo || !form.cursoId || !form.turmaId || !arquivo) {
      return alert("Preencha todos os campos e selecione um arquivo.");
    }
    setEnviando(true);
    try {
      const storageRef = ref(storage, `materiais/${form.cursoId}_${form.turmaId}/${Date.now()}_${arquivo.name}`);
      await uploadBytes(storageRef, arquivo);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, "materiais"), {
        titulo: form.titulo,
        cursoId: form.cursoId,
        turmaId: form.turmaId,
        arquivoUrl: url,
        arquivoNome: arquivo.name,
        arquivoTipo: arquivo.type,
        criadoEm: serverTimestamp(),
      });

      alert("Material enviado com sucesso!");
      setForm({ titulo: "", cursoId: "", turmaId: "" });
      setArquivo(null);
    } catch (e: any) {
      alert("Erro ao enviar: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const sInput = { width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8, marginBottom: 12 };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <h2>📚 Enviar Materiais e Apostilas</h2>
      <div style={{ background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <label>Título do Material:</label>
        <input type="text" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} style={sInput} placeholder="Ex: Apostila de Libras - Aula 1" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>Curso:</label>
            <select value={form.cursoId} onChange={e => setForm({...form, cursoId: e.target.value, turmaId: ""})} style={sInput}>
              <option value="">Selecione</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label>Turma:</label>
            <select value={form.turmaId} onChange={e => setForm({...form, turmaId: e.target.value})} style={sInput} disabled={!form.cursoId}>
              <option value="">Selecione</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        </div>

        <label>Arquivo (PDF ou Imagem):</label>
        <input type="file" accept=".pdf,image/*" onChange={e => setArquivo(e.target.files ? e.target.files[0] : null)} style={{ display: "block", marginBottom: 16 }} />

        <button onClick={handleUpload} disabled={enviando} style={{ padding: "12px 24px", background: "#28a745", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          {enviando ? "Enviando arquivo..." : "Enviar Material"}
        </button>
      </div>
    </div>
  );
}