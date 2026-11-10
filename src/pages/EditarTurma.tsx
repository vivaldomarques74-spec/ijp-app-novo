import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";

interface Professor {
  id: string;
  nome: string;
  profissao?: string;
  numeroRegistro?: string;
  tipoRegistro?: string;
  situacao: "ativo" | "inativo";
}

export default function EditarTurma() {
  const { id: cursoId, turmaId } = useParams<{ id: string; turmaId: string }>();
  const navigate = useNavigate();
  
  // 👇 A MÁGICA ACONTECE AQUI: Identifica se é nova ou edição
  const isNovaTurma = turmaId === "nova";

  const [carregando, setCarregando] = useState(!isNovaTurma);
  const [salvando, setSalvando] = useState(false);
  const [alunos, setAlunos] = useState<string[]>([]);
  const [camposExtras, setCamposExtras] = useState<Record<string, any>>({});

  // Professores
  const [todosProfessores, setTodosProfessores] = useState<Professor[]>([]);
  const [professoresSelecionados, setProfessoresSelecionados] = useState<string[]>([]);

  const [form, setForm] = useState({
    nome: "",
    vagasTotais: 30,
    cargaHoraria: 0,
    totalAulas: 0,
    status: "ativa",
    dataInicio: "",
    dataFim: "",
    modalidade: "presencial",
    diasSemana: [] as string[],
    horario: "",
    descricao: "",
  });

  useEffect(() => {
    // 👇 Só busca no banco se NÃO for uma nova turma
    if (!isNovaTurma) {
      carregar();
    }
    carregarProfessores();
  }, [cursoId, turmaId]);

  const carregarProfessores = async () => {
    try {
      const snap = await getDocs(collection(db, "professores"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as Professor));
      lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setTodosProfessores(lista);
    } catch (e: any) {
      console.error("Erro ao carregar professores:", e);
    }
  };

  const carregar = async () => {
    if (!cursoId || !turmaId) return;
    setCarregando(true);
    try {
      const snap = await getDoc(doc(db, "cursos", cursoId, "turmas", turmaId));
      if (!snap.exists()) {
        alert("Turma não encontrada");
        navigate(`/cursos/${cursoId}`);
        return;
      }
      const data = snap.data();
      const alunosArr = data.alunos || [];
      setAlunos(alunosArr);

      setProfessoresSelecionados(data.professoresIds || []);

      const capacidade =
        data.vagasTotais ||
        data.totalVagas ||
        data.vagas ||
        data.capacidade ||
        (data.vagasDisponiveis || 0) + alunosArr.length;

      const camposConhecidos = [
        "nome", "vagasTotais", "totalVagas", "vagas", "capacidade", "vagasDisponiveis",
        "cargaHoraria", "totalAulas", "status", "dataInicio", "dataFim", "alunos",
        "modalidade", "diasSemana", "horario", "descricao", "professoresIds",
        "createdAt", "updatedAt",
      ];
      const extras: Record<string, any> = {};
      Object.keys(data).forEach(k => {
        if (!camposConhecidos.includes(k)) extras[k] = data[k];
      });
      setCamposExtras(extras);

      setForm({
        nome: data.nome || "",
        vagasTotais: capacidade,
        cargaHoraria: data.cargaHoraria || 0,
        totalAulas: data.totalAulas || 0,
        status: data.status || "ativa",
        dataInicio: data.dataInicio?.toDate?.()?.toISOString?.().split("T")[0] || "",
        dataFim: data.dataFim?.toDate?.()?.toISOString?.().split("T")[0] || "",
        modalidade: data.modalidade || "presencial",
        diasSemana: data.diasSemana || [],
        horario: data.horario || "",
        descricao: data.descricao || "",
      });
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const salvar = async () => {
    if (!cursoId || !turmaId) return;
    if (!form.nome.trim()) return alert("Informe o nome da turma");
    if (form.vagasTotais < alunos.length) {
      return alert(`Capacidade (${form.vagasTotais}) não pode ser menor que alunos matriculados (${alunos.length})`);
    }

    setSalvando(true);
    try {
      const dadosSalvar: any = {
        ...camposExtras,
        nome: form.nome,
        vagasTotais: form.vagasTotais,
        cargaHoraria: form.cargaHoraria,
        totalAulas: form.totalAulas,
        status: form.status,
        modalidade: form.modalidade,
        diasSemana: form.diasSemana,
        horario: form.horario,
        descricao: form.descricao,
        professoresIds: professoresSelecionados,
        updatedAt: new Date(),
      };

      if (form.dataInicio) dadosSalvar.dataInicio = new Date(form.dataInicio);
      if (form.dataFim) dadosSalvar.dataFim = new Date(form.dataFim);

      // 👇 AQUI ELE DECIDE SE CRIA OU SE ATUALIZA
      if (isNovaTurma) {
        await addDoc(collection(db, "cursos", cursoId, "turmas"), {
          ...dadosSalvar,
          alunos: [],
          createdAt: new Date(),
        });
        alert("Turma criada com sucesso!");
      } else {
        await updateDoc(doc(db, "cursos", cursoId, "turmas", turmaId), dadosSalvar);
        alert("Turma atualizada!");
      }
      
      navigate(`/cursos/${cursoId}`);
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleChange = (campo: string, valor: any) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const toggleDia = (dia: string) => {
    setForm(prev => ({
      ...prev,
      diasSemana: prev.diasSemana.includes(dia)
        ? prev.diasSemana.filter(d => d !== dia)
        : [...prev.diasSemana, dia],
    }));
  };

  const toggleProfessor = (professorId: string) => {
    setProfessoresSelecionados(prev =>
      prev.includes(professorId)
        ? prev.filter(id => id !== professorId)
        : [...prev, professorId]
    );
  };

  const sInput = { width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8, marginBottom: 12 };
  const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  if (carregando) return <div style={{ padding: 20 }}>Carregando...</div>;

  const professoresAtivos = todosProfessores.filter(p => p.situacao === "ativo");

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        {/* 👇 O TÍTULO MUDA BASEADO NA AÇÃO */}
        <h1 style={{ color: "#1a2a4f", margin: 0 }}>{isNovaTurma ? "Criar Nova Turma" : "Editar Turma"}</h1>
        <button onClick={() => navigate(`/cursos/${cursoId}`)} style={{ padding: "8px 16px", background: "#6c757d", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          ← Voltar
        </button>
      </div>

      {!isNovaTurma && (
        <div style={{ background: "#e8f0ff", border: "1px solid #0070f3", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: 0, color: "#1a2a4f", fontSize: 14 }}>
            <strong>Alunos matriculados:</strong> {alunos.length} &nbsp;•&nbsp;
            <strong>Capacidade:</strong> {form.vagasTotais} &nbsp;•&nbsp;
            <strong style={{ color: (form.vagasTotais - alunos.length) > 0 ? "#28a745" : "#dc3545" }}>
              {Math.max(0, form.vagasTotais - alunos.length)} vagas disponíveis
            </strong>
          </p>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Nome da turma *</label>
          <input type="text" value={form.nome} onChange={e => handleChange("nome", e.target.value)} style={sInput} placeholder="Ex: Turma 01 - Manhã" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Capacidade total (vagas) *</label>
            <input type="number" min={0} value={form.vagasTotais} onChange={e => handleChange("vagasTotais", parseInt(e.target.value) || 0)} style={sInput} />
          </div>
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Total de aulas</label>
            <input type="number" min={0} value={form.totalAulas} onChange={e => handleChange("totalAulas", parseInt(e.target.value) || 0)} style={sInput} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Carga horária (horas)</label>
            <input type="number" min={0} value={form.cargaHoraria} onChange={e => handleChange("cargaHoraria", parseInt(e.target.value) || 0)} style={sInput} />
          </div>
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Status</label>
            <select value={form.status} onChange={e => handleChange("status", e.target.value)} style={sInput}>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
              <option value="encerrada">Encerrada</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Modalidade</label>
            <select value={form.modalidade} onChange={e => handleChange("modalidade", e.target.value)} style={sInput}>
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
              <option value="hibrido">Híbrido</option>
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Horário</label>
            <input type="text" value={form.horario} onChange={e => handleChange("horario", e.target.value)} placeholder="Ex: 14:00 - 16:00" style={sInput} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Dias da semana</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dias.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDia(d)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: form.diasSemana.includes(d) ? "2px solid #0070f3" : "1px solid #ccc",
                  background: form.diasSemana.includes(d) ? "#e6f0ff" : "#fff",
                  color: "#1a2a4f",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Data de início</label>
            <input type="date" value={form.dataInicio} onChange={e => handleChange("dataInicio", e.target.value)} style={sInput} />
          </div>
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Data de fim</label>
            <input type="date" value={form.dataFim} onChange={e => handleChange("dataFim", e.target.value)} style={sInput} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Descrição / Observações</label>
          <textarea
            value={form.descricao}
            onChange={e => handleChange("descricao", e.target.value)}
            style={{ ...sInput, minHeight: 80 }}
            placeholder="Informações adicionais sobre a turma..."
          />
        </div>

        {/* PROFESSORES DA TURMA */}
        <div style={{ marginTop: 20, marginBottom: 20, borderTop: "2px solid #e0e4e8", paddingTop: 20 }}>
          <label style={{ fontWeight: 700, display: "block", marginBottom: 6, fontSize: 15, color: "#1a2a4f" }}>
            👨‍🏫 Professores da turma
          </label>
          <p style={{ fontSize: 13, color: "#6b7a8f", margin: "0 0 12px" }}>
            Selecione os professores que assinarão os certificados desta turma.
          </p>

          {professoresAtivos.length === 0 && (
            <div style={{ background: "#fff8e1", border: "1px solid #ffc107", borderRadius: 8, padding: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#856404" }}>
                ⚠️ Nenhum professor ativo cadastrado.{" "}
                <a href="/professores" style={{ color: "#0070f3", fontWeight: 600 }}>
                  Cadastrar professor →
                </a>
              </p>
            </div>
          )}

          {professoresAtivos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {professoresAtivos.map(p => {
                const selecionado = professoresSelecionados.includes(p.id);
                return (
                  <label
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      border: selecionado ? "2px solid #0070f3" : "1px solid #e0e4e8",
                      background: selecionado ? "#e6f0ff" : "#fff",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={() => toggleProfessor(p.id)}
                      style={{ cursor: "pointer" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "#1a2a4f" }}>{p.nome}</div>
                      <div style={{ fontSize: 12, color: "#6b7a8f" }}>
                        {p.profissao && <span>{p.profissao}</span>}
                        {p.numeroRegistro && (
                          <span>
                            {p.profissao ? " • " : ""}
                            {p.tipoRegistro ? p.tipoRegistro + " " : ""}{p.numeroRegistro}
                          </span>
                        )}
                      </div>
                    </div>
                    {selecionado && <span style={{ color: "#28a745", fontSize: 18 }}>✓</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button
            onClick={salvar}
            disabled={salvando}
            style={{
              flex: 1,
              padding: "12px 20px",
              background: salvando ? "#999" : "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: salvando ? "wait" : "pointer",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {/* O BOTÃO MUDA BASEADO NA AÇÃO */}
            {salvando ? "Salvando..." : isNovaTurma ? "💾 Criar Turma" : "💾 Salvar Alterações"}
          </button>
          <button
            onClick={() => navigate(`/cursos/${cursoId}`)}
            style={{
              padding: "12px 20px",
              background: "#6c757d",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}