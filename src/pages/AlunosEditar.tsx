import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, getDocs, arrayUnion, runTransaction, addDoc, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { verificarCpfDuplicado } from "../services/validarCpf";

export default function AlunosEditar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dadosAluno, setDadosAluno] = useState<any>({
    nomeCompleto: "", cpf: "", cep: "", endereco: "", email: "", telefone: "", nascimento: "", menor: false,
    responsavelNome: "", responsavelEmail: "", responsavelTelefone: "", responsavelCpf: "",
    status: "ativo", observacoes: "", cursos: [],
    servicosAtivos: [] as any[],
  });
  
  const [cursos, setCursos] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [tiposAtendimento, setTiposAtendimento] = useState<any[]>([]);
  const [senhasDisponiveis, setSenhasDisponiveis] = useState<Record<string, any[]>>({});
  const [novoCursoId, setNovoCursoId] = useState("");
  const [novaTurmaId, setNovaTurmaId] = useState("");
  const [novoServicoId, setNovoServicoId] = useState("");
  const [novaSenhaId, setNovaSenhaId] = useState("");
  const [processando, setProcessando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [cursosAtivos, setCursosAtivos] = useState<any[]>([]);
  const [cursosConcluidos, setCursosConcluidos] = useState<any[]>([]);
  const [cpfStatus, setCpfStatus] = useState({ mensagem: "", existe: false, verificando: false });
  const cpfTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    carregarDados();
  }, [id]);

  async function carregarDados() {
    if (!id) return;
    const alunoSnap = await getDoc(doc(db, "alunos", id));
    if (alunoSnap.exists()) {
      const data = alunoSnap.data();
      setDadosAluno({
        nomeCompleto: data.nomeCompleto || "", cpf: data.cpf || "", cep: data.cep || "", endereco: data.endereco || "",
        email: data.email || "", telefone: data.telefone || "", nascimento: data.nascimento || "", menor: data.menor || false,
        responsavelNome: data.responsavelNome || "", responsavelEmail: data.responsavelEmail || "",
        responsavelTelefone: data.responsavelTelefone || "", responsavelCpf: data.responsavelCpf || "",
        status: data.status || "ativo", observacoes: data.observacoes || "",
        cursos: data.cursos || [],
        servicosAtivos: data.servicosAtivos || [],
      });
    }
    
    const cursosSnap = await getDocs(collection(db, "cursos"));
    setCursos(cursosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    
    const tiposSnap = await getDocs(collection(db, "tiposAtendimento"));
    setTiposAtendimento(tiposSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    
    await carregarHistoricoEAtivos();
  }

  async function carregarHistoricoEAtivos() {
    if (!id) return;
    
    const ativos: any[] = [];
    const concluidos: any[] = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const cursosSnap = await getDocs(collection(db, "cursos"));

    for (const cursoDoc of cursosSnap.docs) {
      const cursoData = cursoDoc.data();
      const turmasSnap = await getDocs(collection(db, "cursos", cursoDoc.id, "turmas"));
      
      for (const turmaDoc of turmasSnap.docs) {
        const t = turmaDoc.data();
        const alunosArr: string[] = t.alunos || [];
        
        if (alunosArr.includes(id)) {
          const totalAulas = t.totalAulas || 0;
          const statusTurma = t.status || "ativa";
          
          let isHistorico = statusTurma === "encerrada";
          
          if (t.dataFim) {
            const dataFimObj = t.dataFim.toDate ? t.dataFim.toDate() : new Date(t.dataFim);
            dataFimObj.setHours(0, 0, 0, 0);
            if (dataFimObj < hoje) {
              isHistorico = true;
            }
          }

          let presencas = 0;
          if (totalAulas > 0) {
            const presSnap = await getDocs(query(
              collection(db, "presencas"),
              where("alunoId", "==", id),
              where("cursoId", "==", cursoDoc.id),
              where("turmaId", "==", turmaDoc.id),
              where("presente", "==", true)
            ));
            presencas = presSnap.size;
          }
          const frequencia = totalAulas > 0 ? Math.round((presencas / totalAulas) * 100) : 0;

          const info = { cursoId: cursoDoc.id, cursoNome: cursoData.nome || "Curso", turmaId: turmaDoc.id, turmaNome: t.nome || "Turma", frequencia, totalAulas, presencas, status: statusTurma };

          if (isHistorico) concluidos.push(info);
          else ativos.push(info);
        }
      }
    }
    setCursosAtivos(ativos);
    setCursosConcluidos(concluidos);
  }

  useEffect(() => {
    if (!novoCursoId) { setTurmas([]); setNovaTurmaId(""); return; }
    const carregarTurmas = async () => {
      const snap = await getDocs(collection(db, "cursos", novoCursoId, "turmas"));
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
  }, [novoCursoId]);

  useEffect(() => {
    if (!novoServicoId) return;
    const carregarSenhas = async () => {
      const snap = await getDocs(collection(db, "tiposAtendimento", novoServicoId, "senhas"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSenhasDisponiveis({ [novoServicoId]: lista });
    };
    carregarSenhas();
  }, [novoServicoId]);

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
        const existe = await verificarCpfDuplicado(cpf, id);
        setCpfStatus({ mensagem: existe ? "⚠️ CPF já cadastrado" : "✅ CPF disponível", existe, verificando: false });
      } catch (error) {
        console.error("Erro ao verificar CPF:", error);
        setCpfStatus({ mensagem: "Erro ao verificar CPF", existe: false, verificando: false });
      }
    }, 500);
    return () => { if (cpfTimeoutRef.current) clearTimeout(cpfTimeoutRef.current); };
  }, [dadosAluno.cpf, id]);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setDadosAluno((prev: any) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // 👇 FUNÇÃO MÁGICA DO CEP
  const buscarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;

    setBuscandoCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setDadosAluno((prev: any) => ({
          ...prev,
          endereco: `${data.logradouro || ""}, ${data.bairro || ""} - ${data.localidade || ""}/${data.uf || ""}`.trim()
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleCepChange = (e: any) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 5) valor = valor.replace(/^(\d{5})(\d)/, "$1-$2");
    setDadosAluno((prev: any) => ({ ...prev, cep: valor }));
    
    if (valor.replace(/\D/g, "").length === 8) {
      buscarCep(valor);
    }
  };

  const adicionarCurso = async () => {
    if (!novoCursoId || !novaTurmaId) return alert("Selecione curso e turma");
    const jaVinculado = dadosAluno.cursos.some((c: any) => c.cursoId === novoCursoId && c.turmaId === novaTurmaId);
    if (jaVinculado) return alert("Aluno já está nesta turma");

    try {
      const turmaRef = doc(db, "cursos", novoCursoId, "turmas", novaTurmaId);
      await runTransaction(db, async (transaction) => {
        const turmaSnap = await transaction.get(turmaRef);
        if (!turmaSnap.exists()) throw new Error("Turma não existe");
        const turmaData = turmaSnap.data();
        const alunosAtuais = turmaData.alunos || [];
        const capacidadeTotal = turmaData.vagasTotais || turmaData.totalVagas || turmaData.vagas || turmaData.capacidade || 0;
        const vagas = Math.max(0, capacidadeTotal - alunosAtuais.length);
        if (vagas <= 0) throw new Error("Sem vagas");
        transaction.update(turmaRef, { alunos: arrayUnion(id), vagasTotais: capacidadeTotal });
      });
      const novosCursos = [...dadosAluno.cursos, { cursoId: novoCursoId, turmaId: novaTurmaId, data: new Date() }];
      await updateDoc(doc(db, "alunos", id!), { cursos: novosCursos });
      setDadosAluno({ ...dadosAluno, cursos: novosCursos });
      alert("Curso adicionado com sucesso!");
      setNovoCursoId("");
      setNovaTurmaId("");
      carregarHistoricoEAtivos(); 
    } catch (error: any) {
      alert(error.message);
    }
  };

  const adicionarServico = async () => {
    if (!novoServicoId) return alert("Selecione um serviço");
    if (dadosAluno.servicosAtivos.some((s: any) => s.tipoId === novoServicoId)) return alert("Aluno já está neste serviço");
    setProcessando(true);
    try {
      const servico = tiposAtendimento.find(t => t.id === novoServicoId);
      const novoServico: any = { tipoId: novoServicoId, modalidade: "presencial" };
      if (servico?.tipoAgendamento === "fila") {
        if (!novaSenhaId) { setProcessando(false); return alert("Selecione uma senha"); }
        const senhaDoc = await getDoc(doc(db, "tiposAtendimento", novoServicoId, "senhas", novaSenhaId));
        if (!senhaDoc.exists()) { setProcessando(false); return alert("Senha inválida"); }
        const senhaData = senhaDoc.data();
        if (senhaData.usado) { setProcessando(false); return alert("Senha já utilizada"); }
        await updateDoc(doc(db, "tiposAtendimento", novoServicoId, "senhas", novaSenhaId), { usado: true, alunoId: id });
        novoServico.senhaId = novaSenhaId;
        novoServico.senhaNumero = senhaData.numero;
        novoServico.prioridade = senhaData.tipo === "prioridade";
        await addDoc(collection(db, "filaEspera"), { alunoId: id, tipoId: novoServicoId, dataSolicitacao: new Date(), status: "aguardando", modalidade: "presencial", senhaNumero: senhaData.numero, prioridade: senhaData.tipo === "prioridade" });
      } else {
        await addDoc(collection(db, "filaEspera"), { alunoId: id, tipoId: novoServicoId, dataSolicitacao: new Date(), status: "aguardando", modalidade: "presencial" });
      }
      const novosServicos = [...dadosAluno.servicosAtivos, novoServico];
      await updateDoc(doc(db, "alunos", id!), { servicosAtivos: novosServicos });
      setDadosAluno({ ...dadosAluno, servicosAtivos: novosServicos });
      alert("Serviço adicionado com sucesso!");
      setNovoServicoId(""); setNovaSenhaId(""); setSenhasDisponiveis({});
    } catch (error: any) { alert(error.message); } finally { setProcessando(false); }
  };

  const removerServico = async (tipoId: string) => {
    if (!window.confirm("Remover este serviço?")) return;
    setProcessando(true);
    try {
      const novosServicos = dadosAluno.servicosAtivos.filter((s: any) => s.tipoId !== tipoId);
      await updateDoc(doc(db, "alunos", id!), { servicosAtivos: novosServicos });
      const filaSnap = await getDocs(collection(db, "filaEspera"));
      for (const f of filaSnap.docs) {
        const fd = f.data();
        if (fd.alunoId === id && fd.tipoId === tipoId && (fd.status === "aguardando" || fd.status === "vinculado")) await updateDoc(f.ref, { status: "cancelado" });
      }
      setDadosAluno({ ...dadosAluno, servicosAtivos: novosServicos });
      alert("Serviço removido!");
    } catch (e: any) { alert(`Erro: ${e.message}`); } finally { setProcessando(false); }
  };

  const reenviarParaFila = async (tipoId: string) => {
    if (!window.confirm("Reenviar este aluno para a fila de espera?")) return;
    setProcessando(true);
    try {
      const filaSnap = await getDocs(collection(db, "filaEspera"));
      const jaNaFila = filaSnap.docs.some(f => { const fd = f.data(); return fd.alunoId === id && fd.tipoId === tipoId && (fd.status === "aguardando" || fd.status === "vinculado"); });
      if (jaNaFila) { alert("Este aluno já está na fila deste serviço!"); setProcessando(false); return; }
      await addDoc(collection(db, "filaEspera"), { alunoId: id, tipoId, dataSolicitacao: new Date(), status: "aguardando", modalidade: "presencial" });
      alert("Aluno reenviado para a fila!");
    } catch (e: any) { alert(`Erro: ${e.message}`); } finally { setProcessando(false); }
  };

  const salvar = async () => {
    if (cpfStatus.existe) return alert("CPF já cadastrado. Não é possível salvar.");
    await updateDoc(doc(db, "alunos", id!), {
      nomeCompleto: dadosAluno.nomeCompleto, cpf: dadosAluno.cpf, cep: dadosAluno.cep, endereco: dadosAluno.endereco, email: dadosAluno.email,
      telefone: dadosAluno.telefone, nascimento: dadosAluno.nascimento, menor: dadosAluno.menor,
      responsavelNome: dadosAluno.responsavelNome, responsavelEmail: dadosAluno.responsavelEmail,
      responsavelTelefone: dadosAluno.responsavelTelefone, responsavelCpf: dadosAluno.responsavelCpf,
      status: dadosAluno.status, observacoes: dadosAluno.observacoes,
    });
    alert("Dados atualizados");
    navigate("/alunos");
  };

  const getServicoNome = (tipoId: string) => tiposAtendimento.find(t => t.id === tipoId)?.nome || "Serviço não encontrado";
  const inputStyle = { width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8, marginBottom: 8 };
  const buttonStyle = (type: "primary" | "secondary") => ({ padding: "8px 16px", border: "none", borderRadius: 8, background: type === "primary" ? "#0070f3" : "#28a745", color: "#fff", cursor: "pointer", marginTop: 8 });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, color: "#1a2a4f" }}>Editar Aluno</h2>
      
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 24 }}>
         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input placeholder="Nome" value={dadosAluno.nomeCompleto} onChange={handleChange} name="nomeCompleto" style={inputStyle} />
          <input placeholder="CPF" value={dadosAluno.cpf} onChange={handleChange} name="cpf" style={inputStyle} />
          {cpfStatus.mensagem && <div style={{ gridColumn: "span 2", color: cpfStatus.existe ? "red" : "green", fontSize: 14, marginBottom: 8 }}>{cpfStatus.verificando ? "Verificando..." : cpfStatus.mensagem}</div>}
          
          {/* 👇 CAMPO DE CEP NOVO */}
          <div style={{ position: "relative" }}>
            <input 
              placeholder="CEP (Ex: 40000-000)" 
              value={dadosAluno.cep || ""} 
              onChange={handleCepChange} 
              name="cep" 
              maxLength={9}
              style={inputStyle} 
            />
            {buscandoCep && <span style={{ position: "absolute", right: 10, top: 8, fontSize: 12, color: "#0070f3" }}>Buscando...</span>}
          </div>
          
          <input placeholder="Endereço (preenchido pelo CEP)" value={dadosAluno.endereco} onChange={handleChange} name="endereco" style={inputStyle} />
          
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
        <button onClick={salvar} disabled={cpfStatus.existe} style={buttonStyle("primary")}>Salvar Alterações</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, margin: "0 0 12px", color: "#28a745" }}>📚 Cursos e Turmas Ativas</h3>
          {cursosAtivos.length === 0 && <p style={{ fontSize: 13, color: "#6b7a8f" }}>Nenhum curso ativo no momento.</p>}
          {cursosAtivos.map(c => (
            <div key={`${c.cursoId}_${c.turmaId}`} style={{ background: "#f8f9fa", padding: 12, borderRadius: 8, marginBottom: 8, borderLeft: "4px solid #28a745" }}>
              <strong style={{ display: "block", color: "#1a2a4f" }}>{c.cursoNome}</strong>
              <span style={{ fontSize: 12, color: "#6b7a8f" }}>Turma: {c.turmaNome}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, margin: "0 0 12px", color: "#0070f3" }}>🎓 Histórico de Cursos</h3>
          {cursosConcluidos.length === 0 && <p style={{ fontSize: 13, color: "#6b7a8f" }}>Nenhum curso concluído ainda.</p>}
          {cursosConcluidos.map(c => (
            <div key={`${c.cursoId}_${c.turmaId}`} style={{ background: "#f8f9fa", padding: 12, borderRadius: 8, marginBottom: 8, borderLeft: "4px solid #0070f3" }}>
              <strong style={{ display: "block", color: "#1a2a4f" }}>{c.cursoNome}</strong>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7a8f", marginTop: 4 }}>
                <span>Turma: {c.turmaNome}</span>
                <span style={{ fontWeight: 600, color: c.frequencia >= 70 ? "#28a745" : "#dc3545" }}>{c.frequencia}% Freq. ({c.presencas}/{c.totalAulas})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Adicionar Curso</h3>
          <select value={novoCursoId} onChange={e => setNovoCursoId(e.target.value)} style={inputStyle}>
            <option value="">Curso</option>
            {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          
          <select value={novaTurmaId} onChange={e => setNovaTurmaId(e.target.value)} disabled={!novoCursoId} style={inputStyle}>
            <option value="">Turma</option>
            {turmas.map(t => (
              <option key={t.id} value={t.id} disabled={t.vagasDisponiveis <= 0 || t.encerrada}>
                {t.nome} {t.encerrada ? "(Encerrada)" : t.vagasDisponiveis <= 0 ? "(Sem Vagas)" : `(Vagas: ${t.vagasDisponiveis})`}
              </option>
            ))}
          </select>
          <button onClick={adicionarCurso} style={buttonStyle("secondary")}>Matricular em Curso</button>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Serviços de Saúde</h3>
          <select value={novoServicoId} onChange={e => setNovoServicoId(e.target.value)} style={inputStyle}>
            <option value="">Adicionar serviço...</option>
            {tiposAtendimento.filter(t => !dadosAluno.servicosAtivos.some((s: any) => s.tipoId === t.id)).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          {senhasDisponiveis[novoServicoId] && (
            <select value={novaSenhaId} onChange={e => setNovaSenhaId(e.target.value)} style={inputStyle}>
              <option value="">Senha</option>
              {senhasDisponiveis[novoServicoId].map(s => <option key={s.id} value={s.id}>{s.numero} - {s.tipo}</option>)}
            </select>
          )}
          {novoServicoId && <button onClick={adicionarServico} disabled={processando} style={buttonStyle("secondary")}>Adicionar Serviço</button>}
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: "#6b7a8f", margin: "0 0 8px", fontWeight: 600 }}>Serviços ativos:</p>
            {dadosAluno.servicosAtivos.map((s: any) => (
              <div key={s.tipoId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f8f9fa", borderRadius: 6, marginBottom: 6, gap: 8 }}>
                <span style={{ fontSize: 13, flex: 1 }}>• {getServicoNome(s.tipoId)}</span>
                <button onClick={() => reenviarParaFila(s.tipoId)} style={{ padding: "4px 8px", fontSize: 11, background: "#17a2b8", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>🔄 Fila</button>
                <button onClick={() => removerServico(s.tipoId)} style={{ padding: "4px 8px", fontSize: 11, background: "#dc3545", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>❌</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}