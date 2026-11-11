import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, addDoc, doc, updateDoc, arrayUnion, runTransaction, getCountFromServer } from "firebase/firestore";
import { db } from "../services/firebase";
import { verificarCpfDuplicado } from "../services/validarCpf";

export default function AlunosCadastrar() {
  const navigate = useNavigate();

  const [dadosAluno, setDadosAluno] = useState({
    nomeCompleto: "", cpf: "", endereco: "", email: "", telefone: "", nascimento: "", menor: false,
    responsavelNome: "", responsavelEmail: "", responsavelTelefone: "", responsavelCpf: "",
    status: "ativo", observacoes: "",
  });

  const [cursos, setCursos] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [tiposAtendimento, setTiposAtendimento] = useState<any[]>([]);
  const [cursoId, setCursoId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [cpfStatus, setCpfStatus] = useState({ mensagem: "", existe: false, verificando: false });
  const cpfTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const carregarDados = async () => {
      const c = await getDocs(collection(db, "cursos"));
      setCursos(c.docs.map(d => ({ id: d.id, nome: d.data().nome })));
      const t = await getDocs(collection(db, "tiposAtendimento"));
      setTiposAtendimento(t.docs.map(d => ({ id: d.id, nome: d.data().nome })));
    };
    carregarDados();
  }, []);

  useEffect(() => {
    if (!cursoId) { setTurmas([]); setTurmaId(""); return; }
    const carregarTurmas = async () => {
      const snap = await getDocs(collection(db, "cursos", cursoId, "turmas"));
      setTurmas(snap.docs.map(d => {
        const data = d.data();
        const alunosBruto = data.alunos || [];
        const alunosUnicos = Array.from(new Set(alunosBruto));
        const capacidade = data.vagasTotais || data.totalVagas || data.vagas || data.capacidade || 0;
        let dataFim = null;
        if (data.dataFim) {
          dataFim = data.dataFim.toDate ? data.dataFim.toDate() : new Date(data.dataFim);
        }
        return { 
          id: d.id, 
          ...data, 
          vagasDisponiveis: Math.max(0, capacidade - alunosUnicos.length),
          encerrada: dataFim ? dataFim < new Date() : false
        };
      }));
    };
    carregarTurmas();
  }, [cursoId]);

  useEffect(() => {
    const cpf = dadosAluno.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) {
      setCpfStatus({ mensagem: "", existe: false, verificando: false });
      return;
    }
    if (cpfTimeoutRef.current) clearTimeout(cpfTimeoutRef.current);
    setCpfStatus(prev => ({ ...prev, verificando: true }));
    cpfTimeoutRef.current = setTimeout(async () => {
      try {
        const existe = await verificarCpfDuplicado(cpf);
        setCpfStatus({ mensagem: existe ? "⚠️ CPF já cadastrado" : "✅ CPF disponível", existe, verificando: false });
      } catch (error) {
        console.error(error);
        setCpfStatus({ mensagem: "Erro ao verificar", existe: false, verificando: false });
      }
    }, 500);
    return () => { if (cpfTimeoutRef.current) clearTimeout(cpfTimeoutRef.current); };
  }, [dadosAluno.cpf]);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setDadosAluno((prev: any) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const toggleServico = (id: string) => {
    setServicosSelecionados(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const salvar = async () => {
    if (cpfStatus.existe) return alert("CPF já cadastrado.");
    if (!dadosAluno.nomeCompleto.trim()) return alert("Informe o nome.");
    if (!dadosAluno.cpf.trim()) return alert("Informe o CPF.");

    setSalvando(true);
    try {
      // GERA MATRÍCULA AUTOMÁTICA
      const countSnap = await getCountFromServer(collection(db, "alunos"));
      const proximoNumero = countSnap.data().count + 1;
      const matriculaGerada = `IJP-${String(proximoNumero).padStart(5, "0")}`;

      const novoAluno = {
        ...dadosAluno,
        matricula: matriculaGerada,
        cursos: [],
        servicosAtivos: servicosSelecionados.map(s => ({ tipoId: s, modalidade: "presencial" })),
        createdAt: new Date(),
      };

      const alunoRef = await addDoc(collection(db, "alunos"), novoAluno);

      if (cursoId && turmaId) {
        const turmaRef = doc(db, "cursos", cursoId, "turmas", turmaId);
        
        await runTransaction(db, async (transaction) => {
          const turmaSnap = await transaction.get(turmaRef);
          if (!turmaSnap.exists()) throw new Error("Turma não encontrada");
          const turmaData = turmaSnap.data();
          const alunosAtuais = turmaData.alunos || [];
          const capacidadeTotal = turmaData.vagasTotais || turmaData.totalVagas || turmaData.vagas || turmaData.capacidade || 0;
          const vagas = Math.max(0, capacidadeTotal - alunosAtuais.length);
          
          if (vagas <= 0) throw new Error("Turma sem vagas disponíveis");
          
          transaction.update(turmaRef, { alunos: arrayUnion(alunoRef.id), vagasTotais: capacidadeTotal });
        });

        await updateDoc(doc(db, "alunos", alunoRef.id), {
          cursos: [{ cursoId, turmaId, data: new Date() }]
        });
      }

      alert(`Aluno cadastrado com sucesso! Matrícula: ${matriculaGerada}`);
      navigate("/alunos");
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const inputStyle = { width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8, marginBottom: 12 };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, color: "#1a2a4f" }}>Novo Aluno</h2>
      
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input placeholder="Nome completo" value={dadosAluno.nomeCompleto} onChange={handleChange} name="nomeCompleto" style={inputStyle} />
          <input placeholder="CPF" value={dadosAluno.cpf} onChange={handleChange} name="cpf" style={inputStyle} />
          {cpfStatus.mensagem && <div style={{ gridColumn: "span 2", color: cpfStatus.existe ? "red" : "green", fontSize: 14, marginBottom: 8 }}>{cpfStatus.verificando ? "Verificando..." : cpfStatus.mensagem}</div>}
          <input placeholder="Endereço" value={dadosAluno.endereco} onChange={handleChange} name="endereco" style={inputStyle} />
          <input placeholder="Email" value={dadosAluno.email} onChange={handleChange} name="email" style={inputStyle} />
          <input placeholder="Telefone" value={dadosAluno.telefone} onChange={handleChange} name="telefone" style={inputStyle} />
          <input type="date" value={dadosAluno.nascimento} onChange={handleChange} name="nascimento" style={inputStyle} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
          <input type="checkbox" checked={dadosAluno.menor} onChange={handleChange} name="menor" /> Menor de idade
        </label>
        {dadosAluno.menor && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input placeholder="Responsável" value={dadosAluno.responsavelNome} onChange={handleChange} name="responsavelNome" style={inputStyle} />
            <input placeholder="CPF resp." value={dadosAluno.responsavelCpf} onChange={handleChange} name="responsavelCpf" style={inputStyle} />
            <input placeholder="Telefone resp." value={dadosAluno.responsavelTelefone} onChange={handleChange} name="responsavelTelefone" style={inputStyle} />
            <input placeholder="Email resp." value={dadosAluno.responsavelEmail} onChange={handleChange} name="responsavelEmail" style={inputStyle} />
          </div>
        )}
        <select value={dadosAluno.status} onChange={handleChange} name="status" style={inputStyle}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select>
        <textarea placeholder="Observações" value={dadosAluno.observacoes} onChange={handleChange} name="observacoes" style={{ ...inputStyle, minHeight: 60 }} />
        <button onClick={salvar} disabled={salvando} style={{ padding: "12px 24px", background: salvando ? "#999" : "#0070f3", color: "#fff", border: "none", borderRadius: 8, cursor: salvando ? "wait" : "pointer", fontWeight: 600 }}>
          {salvando ? "Salvando..." : "Salvar Aluno"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Curso (opcional)</h3>
          <select value={cursoId} onChange={e => setCursoId(e.target.value)} style={inputStyle}>
            <option value="">Curso</option>
            {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={turmaId} onChange={e => setTurmaId(e.target.value)} disabled={!cursoId} style={inputStyle}>
            <option value="">Turma</option>
            {turmas.map(t => (
              <option key={t.id} value={t.id} disabled={t.vagasDisponiveis <= 0 || t.encerrada}>
                {t.nome} {t.encerrada ? "(Encerrada)" : t.vagasDisponiveis <= 0 ? "(Sem Vagas)" : `(Vagas: ${t.vagasDisponiveis})`}
              </option>
            ))}
          </select>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Serviços de Saúde</h3>
          {tiposAtendimento.map(t => (
            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input type="checkbox" checked={servicosSelecionados.includes(t.id)} onChange={() => toggleServico(t.id)} /> {t.nome}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}