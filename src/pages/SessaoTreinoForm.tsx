// Formulário de montagem da sessão de treino (pedido 29/10/2026) — reproduz a
// tela "Nova sessão de treino" do vídeo que o Henrique mandou (app "H10
// Academy"): turma/data, temas por complexo, problema de jogo + condicionantes,
// e os 11 "quadros" da ficha (Fase 1: cada quadro só guarda nome/objetivo/tempo
// — o desenho animado de quadra fica pra uma 2ª entrega). Exporta a mesma
// ficha em HTML/PDF usada na lista (`treinoHtml.ts`).
import { useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ClipboardList, Download, Printer, ArrowLeft, Save, GripVertical, Presentation } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, Button, Field } from '../components/ui'
import {
  GRUPOS_TEMAS_TREINO, TEMAS_TREINO, PROBLEMAS_JOGO_SUGERIDOS, CONDICIONANTES_TREINO, QUADRO_SLOTS,
  GRUPOS_QUADRO_ORDEM,
} from '../types'
import { gerarHtmlFichaTreino } from '../treinoHtml'
import { baixarHtml, abrirParaImprimir, slugify } from '../htmlReport'
import { QuadroDesenhoEditor, QuadroDesenhoPreview, QuadroDesenhoAnimado } from '../components/QuadroDesenhoEditor'
import { BibliotecaPicker } from '../components/BibliotecaPicker'
import { ModoApresentacao } from '../components/ModoApresentacao'
import type { QuadroDesenho, ExercicioBiblioteca, GrupoQuadroTreino } from '../types'

function chipBtnClass(ativo: boolean): string {
  return `text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
    ativo ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)] hover:bg-black/5 dark:hover:bg-white/10'
  }`
}

export default function SessaoTreinoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const turmas = useStore((s) => s.turmas)
  const escolas = useStore((s) => s.escolas)
  const sessoesTreino = useStore((s) => s.sessoesTreino)
  const atualizarSessaoTreino = useStore((s) => s.atualizarSessaoTreino)
  const atualizarQuadroTreino = useStore((s) => s.atualizarQuadroTreino)
  const trocarQuadrosTreino = useStore((s) => s.trocarQuadrosTreino)
  const addExercicioBiblioteca = useStore((s) => s.addExercicioBiblioteca)
  const [quadroAberto, setQuadroAberto] = useState<string | null>(null)
  const [desenhandoChave, setDesenhandoChave] = useState<string | null>(null)
  const [reproduzindoChave, setReproduzindoChave] = useState<string | null>(null)
  // Banco de exercícios (pedido 31/10/2026) — "usandoBibliotecaChave" guarda
  // qual quadro está com o seletor da biblioteca aberto; "salvoNaBibliotecaChave"
  // só controla um aviso rápido ("Salvo ✓") que some sozinho depois de 2s.
  const [usandoBibliotecaChave, setUsandoBibliotecaChave] = useState<string | null>(null)
  const [salvoNaBibliotecaChave, setSalvoNaBibliotecaChave] = useState<string | null>(null)
  const [apresentando, setApresentando] = useState(false)
  // Arrastar um quadro pra outro lugar da ficha (pedido 31/10/2026: "poder
  // arrastar o exercício para colocar em outra parte do treino") — feito com
  // Pointer Events (não HTML5 drag-and-drop nativo, que não funciona em
  // touch/celular) pra funcionar tanto no mouse quanto no dedo. `arrastando`
  // guarda a chave sendo movida e a posição atual do dedo/cursor;
  // `chaveAlvo` é o quadro que está por baixo do dedo agora (vira destino se
  // soltar ali). Sempre troca os dois quadros de lugar (nunca sobrescreve),
  // então nenhum dado se perde mesmo se o destino já tiver algo.
  const [arrastando, setArrastando] = useState<{ chave: string; x: number; y: number } | null>(null)
  const [chaveAlvo, setChaveAlvo] = useState<string | null>(null)
  const arrastandoRef = useRef<string | null>(null)

  function iniciarArraste(e: React.PointerEvent, chave: string) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    arrastandoRef.current = chave
    setArrastando({ chave, x: e.clientX, y: e.clientY })
    setChaveAlvo(null)
  }

  function moverArraste(e: React.PointerEvent) {
    if (!arrastandoRef.current) return
    e.preventDefault()
    const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-quadro-chave]') as HTMLElement | null
    const chaveSobDedo = alvo?.dataset.quadroChave ?? null
    setArrastando({ chave: arrastandoRef.current, x: e.clientX, y: e.clientY })
    setChaveAlvo(chaveSobDedo && chaveSobDedo !== arrastandoRef.current ? chaveSobDedo : null)
  }

  function soltarArraste() {
    if (arrastandoRef.current && chaveAlvo) {
      trocarQuadrosTreino(sessao!.id, arrastandoRef.current, chaveAlvo)
    }
    arrastandoRef.current = null
    setArrastando(null)
    setChaveAlvo(null)
  }

  /** Preenche um quadro com um exercício escolhido da biblioteca — sempre
   *  confirma antes se o quadro já tiver algo, igual o "copiar desenho de..."
   *  já faz, pra nunca sobrescrever sem avisar. */
  function usarDaBiblioteca(chave: string, ex: ExercicioBiblioteca) {
    const q = sessao!.quadros.find((x) => x.chave === chave)!
    const jaTemAlgo = !!(q.nome || q.objetivo || (q.desenho && q.desenho.elementos.length > 0))
    if (jaTemAlgo && !window.confirm('Isso substitui o conteúdo atual deste quadro. Continuar?')) return
    atualizarQuadroTreino(sessao!.id, chave, {
      nome: ex.nome, objetivo: ex.objetivo, tempoMin: ex.tempoMin, comoFunciona: ex.comoFunciona, desenho: ex.desenho,
    })
    setUsandoBibliotecaChave(null)
  }

  /** Salva o conteúdo atual de um quadro como um novo exercício da
   *  biblioteca, já marcado com os temas/problema de jogo/condicionantes
   *  que o treinador escolheu pra esta sessão (editável depois na aba
   *  Biblioteca). */
  function salvarNaBiblioteca(chave: string, grupo: GrupoQuadroTreino) {
    const q = sessao!.quadros.find((x) => x.chave === chave)!
    addExercicioBiblioteca({
      nome: q.nome || '(sem nome)', objetivo: q.objetivo, tempoMin: q.tempoMin, comoFunciona: q.comoFunciona, desenho: q.desenho,
      grupo, temas: sessao!.temas, problemaJogo: sessao!.problemaJogo, condicionantes: sessao!.condicionantes,
    })
    setSalvoNaBibliotecaChave(chave)
    setTimeout(() => setSalvoNaBibliotecaChave((atual) => (atual === chave ? null : atual)), 2000)
  }

  const sessao = sessoesTreino.find((s) => s.id === id)
  const turmasAtivas = turmas.filter((t) => !t.deletedAt)

  if (!sessao) return <p>Sessão de treino não encontrada.</p>

  const turma = turmas.find((t) => t.id === sessao.turmaId)
  const escola = turma ? escolas.find((e) => e.id === turma.escolaId) : undefined

  function alternarTema(temaId: string) {
    const jaTem = sessao!.temas.includes(temaId)
    atualizarSessaoTreino(sessao!.id, { temas: jaTem ? sessao!.temas.filter((t) => t !== temaId) : [...sessao!.temas, temaId] })
  }

  function alternarCondicionante(condId: string) {
    const jaTem = sessao!.condicionantes.includes(condId)
    atualizarSessaoTreino(sessao!.id, { condicionantes: jaTem ? sessao!.condicionantes.filter((c) => c !== condId) : [...sessao!.condicionantes, condId] })
  }

  function compartilhar(modo: 'html' | 'pdf') {
    if (!turma || !escola) return
    const html = gerarHtmlFichaTreino(sessao!, turma, escola)
    if (modo === 'html') baixarHtml(html, `RDSports_treino_${slugify(turma.nome)}_${sessao!.data}.html`)
    else abrirParaImprimir(html)
  }

  /** Cada campo já salva sozinho a cada letra digitada (autosave, igual o
   *  resto do app) — esse botão existe pra dar uma confirmação clara pro
   *  treinador e levar direto pro Calendário, já no dia certo, mostrando que
   *  a sessão ficou salva lá. */
  function salvarEVerNoCalendario() {
    navigate('/calendario', { state: { abrirDia: sessao!.data } })
  }

  const quadrosPreenchidos = sessao.quadros.filter((q) => q.nome || q.objetivo || (q.desenho && q.desenho.elementos.length > 0)).length

  return (
    <div>
      <PageTitle
        icon={<ClipboardList size={24} />}
        title="Sessão de treino"
        subtitle="Monte o treino na ficha: ela sai pronta pra imprimir ou salvar em PDF."
        action={
          <div className="flex gap-2 flex-wrap">
            <Link to="/treinos" className="rd-btn text-xs"><ArrowLeft size={14} /> Sessões</Link>
            <button className="rd-btn text-xs" onClick={() => setApresentando(true)}><Presentation size={14} /> Modo apresentação</button>
            <button className="rd-btn rd-btn-gold text-xs" onClick={salvarEVerNoCalendario}><Save size={14} /> Salvar</button>
          </div>
        }
      />

      <Card className="mb-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Turma *">
            <select className="rd-input" value={sessao.turmaId} onChange={(e) => atualizarSessaoTreino(sessao.id, { turmaId: e.target.value })}>
              {turmasAtivas.map((t) => {
                const esc = escolas.find((e) => e.id === t.escolaId)
                return <option key={t.id} value={t.id}>{t.nome}{esc ? ` — ${esc.nome}` : ''}</option>
              })}
            </select>
          </Field>
          <Field label="Data do treino *">
            <input type="date" className="rd-input" value={sessao.data} onChange={(e) => atualizarSessaoTreino(sessao.id, { data: e.target.value })} />
          </Field>
          <Field label="Sessão nº">
            <input className="rd-input" value={sessao.numeroSessao ?? ''} onChange={(e) => atualizarSessaoTreino(sessao.id, { numeroSessao: e.target.value })} />
          </Field>
          <Field label="Nº de alunos(as)">
            <input type="number" min={0} className="rd-input" value={sessao.numeroAlunos ?? ''} onChange={(e) => atualizarSessaoTreino(sessao.id, { numeroAlunos: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label="Materiais">
            <input className="rd-input" placeholder="Ex.: 10 bolas, 12 cones" value={sessao.materiais ?? ''} onChange={(e) => atualizarSessaoTreino(sessao.id, { materiais: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="mb-5">
        <div className="font-bold text-sm mb-1">Temas do treino</div>
        <div className="text-xs text-[var(--rd-text-dim)] mb-3">{sessao.temas.length}/{TEMAS_TREINO.length} marcados {sessao.temas.length > 0 && '· o primeiro é o principal'}</div>
        {GRUPOS_TEMAS_TREINO.map((g) => (
          <div key={g.id} className="mb-3 last:mb-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-1.5">{g.id} — {g.label}</div>
            <div className="flex flex-wrap gap-2">
              {TEMAS_TREINO.filter((t) => t.grupo === g.id).map((t) => {
                const ativo = sessao.temas.includes(t.id)
                const principal = sessao.temas[0] === t.id
                return (
                  <button key={t.id} className={chipBtnClass(ativo)} onClick={() => alternarTema(t.id)}>
                    {t.label}{principal && ' ★'}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </Card>

      <Card className="mb-5">
        <Field label="Problema de jogo da sessão">
          <input
            className="rd-input" placeholder="Uma frase: o que o(a) aluno(a) precisa resolver hoje"
            value={sessao.problemaJogo ?? ''} onChange={(e) => atualizarSessaoTreino(sessao.id, { problemaJogo: e.target.value })}
          />
        </Field>
        <div className="flex flex-wrap gap-2 mb-4">
          {PROBLEMAS_JOGO_SUGERIDOS.map((p) => (
            <button key={p} className={chipBtnClass(sessao.problemaJogo === p)} onClick={() => atualizarSessaoTreino(sessao.id, { problemaJogo: p })}>{p}</button>
          ))}
        </div>
        <div className="font-bold text-sm mb-2">Condicionantes que vou manipular</div>
        <div className="flex flex-wrap gap-2">
          {CONDICIONANTES_TREINO.map((c) => (
            <button key={c.id} className={chipBtnClass(sessao.condicionantes.includes(c.id))} onClick={() => alternarCondicionante(c.id)}>{c.label}</button>
          ))}
        </div>
      </Card>

      <Card className="mb-5">
        <div className="font-bold text-sm mb-3">Quadros do treino · {quadrosPreenchidos} de {QUADRO_SLOTS.length} preenchidos</div>
        {GRUPOS_QUADRO_ORDEM.map(({ grupo, label }) => (
          <div key={grupo} className="mb-4 last:mb-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-1.5">{label}</div>
            <div className="grid sm:grid-cols-3 gap-2">
              {QUADRO_SLOTS.filter((q) => q.grupo === grupo).map((slot) => {
                const q = sessao.quadros.find((x) => x.chave === slot.chave)!
                const aberto = quadroAberto === slot.chave
                const preenchido = !!(q.nome || q.objetivo || (q.desenho && q.desenho.elementos.length > 0))
                const temAnimacao = !!(q.desenho?.passos && q.desenho.passos.length > 1)
                const reproduzindo = reproduzindoChave === slot.chave
                const sendoArrastado = arrastando?.chave === slot.chave
                const ehAlvo = chaveAlvo === slot.chave
                return (
                  <div
                    key={slot.chave}
                    data-quadro-chave={slot.chave}
                    className="relative rounded-lg border p-2 transition-colors"
                    style={{
                      borderColor: ehAlvo ? 'var(--rd-gold)' : 'var(--rd-border)',
                      borderWidth: ehAlvo ? 2 : 1,
                      opacity: sendoArrastado ? 0.4 : 1,
                      backgroundColor: ehAlvo ? 'color-mix(in srgb, var(--rd-gold) 12%, transparent)' : undefined,
                    }}
                  >
                    <div
                      className="absolute top-1 right-1 p-1 rounded cursor-grab active:cursor-grabbing text-[var(--rd-text-dim)]"
                      style={{ touchAction: 'none' }}
                      title="Arrastar para outra parte do treino"
                      onPointerDown={(e) => iniciarArraste(e, slot.chave)}
                      onPointerMove={moverArraste}
                      onPointerUp={soltarArraste}
                      onPointerCancel={soltarArraste}
                    >
                      <GripVertical size={14} />
                    </div>
                    {q.desenho && q.desenho.elementos.length > 0 && (
                      <div className="relative mb-1.5">
                        {reproduzindo ? (
                          <QuadroDesenhoAnimado
                            passos={q.desenho.passos!} estiloJogador={q.desenho.estiloJogador}
                            velocidade={q.desenho.velocidade} repetir={q.desenho.repetir}
                          />
                        ) : (
                          <div className="cursor-pointer" onClick={() => setDesenhandoChave(slot.chave)}>
                            <QuadroDesenhoPreview desenho={q.desenho} logoEscolaUrl={escola?.logoUrl} />
                          </div>
                        )}
                        {temAnimacao && (
                          <button
                            className="absolute bottom-1.5 left-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-black/70 text-white border border-white/20"
                            onClick={(e) => { e.stopPropagation(); setReproduzindoChave(reproduzindo ? null : slot.chave) }}
                          >
                            {reproduzindo ? '■ Parar' : '▶ Ver animação'}
                          </button>
                        )}
                      </div>
                    )}
                    <button className="w-full text-left pr-5" onClick={() => setQuadroAberto(aberto ? null : slot.chave)}>
                      <div className="text-xs font-semibold truncate">{q.nome || (preenchido ? '(sem nome)' : '+ Preencher')}</div>
                      <div className="text-[10px] text-[var(--rd-text-dim)] truncate">{preenchido ? (q.objetivo || 'Em branco no papel') : 'Em branco no papel'}</div>
                    </button>
                    {aberto && (
                      <div className="mt-2 flex flex-col gap-2">
                        <input className="rd-input text-xs" placeholder="Nome do exercício" value={q.nome ?? ''} onChange={(e) => atualizarQuadroTreino(sessao.id, slot.chave, { nome: e.target.value })} />
                        <input className="rd-input text-xs" placeholder="O que este exercício busca" value={q.objetivo ?? ''} onChange={(e) => atualizarQuadroTreino(sessao.id, slot.chave, { objetivo: e.target.value })} />
                        <input type="number" min={0} className="rd-input text-xs" placeholder="Tempo (min)" value={q.tempoMin ?? ''} onChange={(e) => atualizarQuadroTreino(sessao.id, slot.chave, { tempoMin: e.target.value ? Number(e.target.value) : undefined })} />
                        <textarea className="rd-input text-xs" rows={2} placeholder="Como funciona (opcional)" value={q.comoFunciona ?? ''} onChange={(e) => atualizarQuadroTreino(sessao.id, slot.chave, { comoFunciona: e.target.value })} />
                        <div className="flex flex-wrap gap-1.5">
                          <button className="rd-btn text-xs" onClick={() => setDesenhandoChave(slot.chave)}>{q.desenho ? 'Editar desenho' : '✏️ Desenhar na quadra'}</button>
                          <button className="rd-btn text-xs" onClick={() => setUsandoBibliotecaChave(slot.chave)}>📚 Usar da biblioteca</button>
                          {preenchido && (
                            <button className="rd-btn text-xs" onClick={() => salvarNaBiblioteca(slot.chave, slot.grupo)}>
                              {salvoNaBibliotecaChave === slot.chave ? 'Salvo ✓' : '💾 Salvar na biblioteca'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </Card>

      <Card className="mb-5">
        <div className="font-bold text-sm mb-3">Registro pedagógico <span className="font-normal text-xs text-[var(--rd-text-dim)]">— preenche depois do treino</span></div>
        <Field label="1. O comportamento que eu queria ver apareceu?">
          <div className="flex flex-wrap gap-2">
            {([
              ['sozinho', 'Sozinho'], ['com_pergunta', 'Com pergunta'], ['so_com_instrucao', 'Só com instrução'], ['nao_apareceu', 'Não apareceu'],
            ] as const).map(([v, label]) => (
              <button key={v} className={chipBtnClass(sessao.registroPedagogico.comportamentoApareceu === v)} onClick={() => atualizarSessaoTreino(sessao.id, { registroPedagogico: { ...sessao.registroPedagogico, comportamentoApareceu: v } })}>{label}</button>
            ))}
          </div>
        </Field>
        <Field label="2. O que a turma resolveu hoje que não resolvia antes?">
          <input className="rd-input" value={sessao.registroPedagogico.problemaResolvido ?? ''} onChange={(e) => atualizarSessaoTreino(sessao.id, { registroPedagogico: { ...sessao.registroPedagogico, problemaResolvido: e.target.value } })} />
        </Field>
        <Field label="3. Camada mais observada hoje">
          <div className="flex flex-wrap gap-2">
            {([
              ['leitura_ajuste', 'Leitura/ajuste'], ['execucao', 'Execução'], ['decisao', 'Decisão'], ['cooperacao_conduta', 'Cooperação/conduta'],
            ] as const).map(([v, label]) => (
              <button key={v} className={chipBtnClass(sessao.registroPedagogico.camadaObservada === v)} onClick={() => atualizarSessaoTreino(sessao.id, { registroPedagogico: { ...sessao.registroPedagogico, camadaObservada: v } })}>{label}</button>
            ))}
          </div>
        </Field>
        <Field label="4. Alunos(as) observados(as) e estágio (descoberta/construção/consolidação/autonomia)">
          <textarea className="rd-input" rows={2} value={sessao.registroPedagogico.alunosObservados ?? ''} onChange={(e) => atualizarSessaoTreino(sessao.id, { registroPedagogico: { ...sessao.registroPedagogico, alunosObservados: e.target.value } })} />
        </Field>
        <Field label="5. Que condicionante eu mudaria?">
          <input className="rd-input" value={sessao.registroPedagogico.condicionanteMudaria ?? ''} onChange={(e) => atualizarSessaoTreino(sessao.id, { registroPedagogico: { ...sessao.registroPedagogico, condicionanteMudaria: e.target.value } })} />
        </Field>
        <Field label="6. Compromisso para o próximo treino">
          <input className="rd-input" value={sessao.registroPedagogico.compromissoProximoTreino ?? ''} onChange={(e) => atualizarSessaoTreino(sessao.id, { registroPedagogico: { ...sessao.registroPedagogico, compromissoProximoTreino: e.target.value } })} />
        </Field>
        <Field label="Ajustes feitos durante o treino — o que eu mudei e por quê">
          <textarea className="rd-input" rows={2} value={sessao.registroPedagogico.ajustesFeitos ?? ''} onChange={(e) => atualizarSessaoTreino(sessao.id, { registroPedagogico: { ...sessao.registroPedagogico, ajustesFeitos: e.target.value } })} />
        </Field>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => navigate('/treinos')}>Voltar</Button>
        <Button onClick={() => compartilhar('html')}><Download size={16} /> Baixar HTML</Button>
        <Button onClick={() => compartilhar('pdf')}><Printer size={16} /> Salvar em PDF</Button>
        <Button variant="gold" onClick={salvarEVerNoCalendario}><Save size={16} /> Salvar e ver no Calendário</Button>
      </div>

      {arrastando && (() => {
        const slotArrastado = QUADRO_SLOTS.find((s) => s.chave === arrastando.chave)!
        const qArrastado = sessao.quadros.find((x) => x.chave === arrastando.chave)!
        return (
          <div
            className="fixed z-50 pointer-events-none rd-btn text-xs shadow-lg"
            style={{ left: arrastando.x + 12, top: arrastando.y + 12, backgroundColor: 'var(--rd-gold)', color: '#1a1300', borderColor: 'var(--rd-gold)' }}
          >
            {qArrastado.nome || slotArrastado.grupoLabel}
          </div>
        )
      })()}

      {apresentando && <ModoApresentacao sessao={sessao} escola={escola} onFechar={() => setApresentando(false)} />}

      {usandoBibliotecaChave && (() => {
        const slot = QUADRO_SLOTS.find((s) => s.chave === usandoBibliotecaChave)!
        return (
          <BibliotecaPicker
            grupoAlvo={slot.grupo}
            temasSessao={sessao.temas}
            problemaJogoSessao={sessao.problemaJogo}
            condicionantesSessao={sessao.condicionantes}
            onEscolher={(ex) => usarDaBiblioteca(usandoBibliotecaChave, ex)}
            onFechar={() => setUsandoBibliotecaChave(null)}
          />
        )
      })()}

      {desenhandoChave && (() => {
        const slot = QUADRO_SLOTS.find((s) => s.chave === desenhandoChave)!
        const q = sessao.quadros.find((x) => x.chave === desenhandoChave)!
        // outros quadros da mesma sessão que já têm desenho (pedido
        // 31/10/2026, fase 3: "copiar desenho entre quadros") — pra oferecer
        // no editor em vez de redesenhar do zero
        const desenhosDisponiveis = sessao.quadros
          .filter((x) => x.chave !== desenhandoChave && x.desenho && x.desenho.elementos.length > 0)
          .map((x) => {
            const s = QUADRO_SLOTS.find((sl) => sl.chave === x.chave)!
            return { label: `${s.grupoLabel}${x.nome ? ` — ${x.nome}` : ''}`, desenho: x.desenho! }
          })
        return (
          <QuadroDesenhoEditor
            titulo={`${slot.grupoLabel}${q.nome ? ` — ${q.nome}` : ''}`}
            desenhoInicial={q.desenho}
            logoEscolaUrl={escola?.logoUrl}
            desenhosDisponiveis={desenhosDisponiveis}
            onFechar={() => setDesenhandoChave(null)}
            onSalvar={(desenho: QuadroDesenho) => {
              atualizarQuadroTreino(sessao.id, desenhandoChave, { desenho })
              setDesenhandoChave(null)
            }}
          />
        )
      })()}
    </div>
  )
}
