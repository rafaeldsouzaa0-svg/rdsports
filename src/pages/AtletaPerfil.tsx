import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Printer, KeyRound, RefreshCw, Copy, Check, MapPin, TrendingUp, Camera } from 'lucide-react'
import { useStore } from '../store'
import { Card, Button, Field, BotaoVoltar } from '../components/ui'
import AvatarAtleta from '../components/AvatarAtleta'
import { LogoUpload } from '../components/LogoUpload'
import { POSICOES, normalizarPosicao, type Posicao } from '../types'
import { calcularRating, agregarScoutAtleta, partidasComParticipacao, setsFinalizados } from '../rating'
import { gerarHtmlPerfilAtleta, gerarHtmlRelatorioAtleta, baixarHtml, abrirParaImprimir, slugify } from '../htmlReport'
import { analisePorAtletaEPosicao } from '../scoutEngine'
import { formatDate } from '../utils'
import { calcularIdade } from '../convocacao'
import GraficoEvolucao from '../components/GraficoEvolucao'

const ROMANO_POS = ['I', 'II', 'III', 'IV', 'V', 'VI']

function corEficienciaPos(ef: number): string {
  if (ef >= 50) return 'text-[var(--rd-positivo)]'
  if (ef >= 0) return 'text-[var(--rd-neutro)]'
  return 'text-[var(--rd-erro)]'
}

function SecaoPosicaoAtleta({ atletaId, partidasDaTurma }: { atletaId: string; partidasDaTurma: import('../types').Partida[] }) {
  const sets = setsFinalizados(partidasDaTurma)
  const porAtleta = analisePorAtletaEPosicao(sets)[atletaId]
  if (!porAtleta) return null
  const comDados = [0, 1, 2, 3, 4, 5].filter((i) => porAtleta[i].total > 0)
  if (comDados.length === 0) return null
  const melhor = comDados.length >= 2 ? comDados.reduce((a, b) => (porAtleta[b].eficiencia > porAtleta[a].eficiencia ? b : a)) : null
  const pior = comDados.length >= 2 ? comDados.reduce((a, b) => (porAtleta[b].eficiencia < porAtleta[a].eficiencia ? b : a)) : null

  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><MapPin size={16} className="rd-accent-text" /> Desempenho por posição</div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const l = porAtleta[i]
          const semDados = l.total === 0
          return (
            <div key={i} className="rounded-lg border p-2 text-center" style={{ borderColor: 'var(--rd-border)' }}>
              <div className="text-[10px] font-bold text-[var(--rd-text-dim)]">{ROMANO_POS[i]}</div>
              {semDados ? (
                <div className="text-xs text-[var(--rd-text-dim)] mt-1">sem dados</div>
              ) : (
                <div className={`text-sm font-black mt-1 ${corEficienciaPos(l.eficiencia)}`}>{l.eficiencia}%</div>
              )}
              {i === melhor && <div className="text-[9px] font-bold mt-1 text-[var(--rd-positivo)]">melhor</div>}
              {i === pior && <div className="text-[9px] font-bold mt-1 text-[var(--rd-erro)]">pior</div>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function corEficiencia(ef: number): string {
  if (ef >= 50) return 'text-[var(--rd-positivo)]'
  if (ef >= 0) return 'text-[var(--rd-neutro)]'
  return 'text-[var(--rd-erro)]'
}

function corEficienciaBg(ef: number): string {
  if (ef >= 50) return 'var(--rd-positivo)'
  if (ef >= 0) return 'var(--rd-neutro)'
  return 'var(--rd-erro)'
}

/** Evolução individual na temporada (pedido 30/10/2026) — mesma ideia da
 *  "Evolução da eficiência geral" que já existe pro TIME na tela de
 *  Temporada, só que agora por atleta: eficiência geral dela jogo a jogo, do
 *  mais antigo pro mais recente. Reaproveita `partidasComParticipacao`
 *  (já existente, usada em "Números por partida" logo abaixo) — só muda a
 *  ordem (mais antigo primeiro) e o jeito de mostrar. Só aparece com 2+
 *  jogos com participação dela. */
function EvolucaoIndividual({ atletaId, partidas }: { atletaId: string; partidas: import('../types').Partida[] }) {
  const porPartida = partidasComParticipacao(atletaId, partidas)
  const cronologico = [...porPartida].sort((a, b) => a.partida.data.localeCompare(b.partida.data))
  if (cronologico.length < 2) return null
  return (
    <Card className="mb-5">
      <div className="text-xs font-bold mb-3 flex items-center gap-1.5 text-[var(--rd-text-dim)] uppercase tracking-wide">
        <TrendingUp size={13} /> Evolução na temporada (do jogo mais antigo pro mais recente)
      </div>
      <GraficoEvolucao
        cor={corEficienciaBg}
        pontos={cronologico.map(({ partida, totalGeral }) => ({ partida, eficiencia: totalGeral.eficiencia, detalhe: `${totalGeral.total} ações dela` }))}
      />
      <p className="text-[11px] text-[var(--rd-text-dim)] mt-2">Eficiência geral da atleta em cada partida — todas as ações dela, positivo − erro ÷ total.</p>
    </Card>
  )
}

// Escala 6.0-10.0 (pedido 30/10/2026). Limiares escolhidos pra ficar
// intuitivo pra quem já conhece nota de boletim/súmula: 8+ é bom desempenho,
// 7-8 é mediano, abaixo de 7 chama atenção.
function corRating(rating: number): string {
  if (rating >= 8) return 'var(--rd-positivo)'
  if (rating >= 7) return 'var(--rd-neutro)'
  return 'var(--rd-erro)'
}

/** Gera um código curto, fácil de digitar em qualquer teclado (sem 0/O, 1/I/l
 *  pra não confundir), pro Portal da Atleta. Não é segredo forte — é um
 *  acesso simples por código, decisão explícita do Henrique — então o que
 *  importa aqui é não ter ambiguidade visual, não entropia máxima. */
function gerarCodigoAcesso(): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let codigo = ''
  for (let i = 0; i < 6; i++) codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)]
  return codigo
}

export default function AtletaPerfil() {
  const { id } = useParams()
  const { atletas, turmas, partidas, updateAtleta } = useStore()
  const [copiado, setCopiado] = useState(false)
  const atleta = atletas.find((a) => a.id === id)

  if (!atleta) return <p>Atleta não encontrada.</p>

  const turma = turmas.find((t) => t.id === atleta.turmaId)
  // Defensivo: atletas recuperadas do Supabase antes de 23/10/2026 (ou com
  // dados locais salvos nessa janela) podem ter `posicaoPrincipal` com um
  // valor antigo ("Ponteira", "Central", "6x0" etc.) que não existe mais no
  // enum atual. Normaliza aqui pra exibir certo e pro rating não travar a
  // tela (bug real encontrado em produção em 23/10/2026).
  const posicaoNormalizada = normalizarPosicao(atleta.posicaoPrincipal)
  const posicaoSecundariaNormalizada = normalizarPosicao(atleta.posicaoSecundaria)
  const scoutAgregado = agregarScoutAtleta(atleta.id, partidas)
  const rating = calcularRating(scoutAgregado, posicaoNormalizada, posicaoSecundariaNormalizada)
  const partidasInfo = partidasComParticipacao(atleta.id, partidas)
  // Inclui jogos em que ela foi convocada como reforço de outra turma (11/11/2026).
  const partidasDaTurma = partidas.filter((p) => p.turmaId === atleta.turmaId || p.convocadas?.includes(atleta.id))

  // Visual "Álbum" (21/11/2026): posição dela no ranking de rating da turma
  // (só entre colegas que já têm ações registradas) e 3 números de destaque.
  const colocacaoNaTurma = (() => {
    if (rating.totalAcoes === 0) return null
    const notas = atletas
      .filter((a) => !a.deletedAt && a.turmaId === atleta.turmaId)
      .map((a) => calcularRating(agregarScoutAtleta(a.id, partidas), normalizarPosicao(a.posicaoPrincipal), normalizarPosicao(a.posicaoSecundaria)))
      .filter((r) => r.totalAcoes > 0)
      .map((r) => r.rating)
    if (notas.length < 2) return null
    return notas.filter((n) => n > rating.rating).length + 1
  })()
  const nomePosicao = POSICOES.find((p) => p.valor === posicaoNormalizada)?.label
  const nomePosicaoSec = posicaoSecundariaNormalizada && posicaoSecundariaNormalizada !== posicaoNormalizada
    ? POSICOES.find((p) => p.valor === posicaoSecundariaNormalizada)?.label
    : undefined
  const numerosDestaque = [
    { rotulo: 'Ataque', valor: `${scoutAgregado.ataque.eficiencia}%`, cor: corEficienciaBg(scoutAgregado.ataque.eficiencia), tem: scoutAgregado.ataque.total > 0 },
    { rotulo: 'Recepção', valor: `${scoutAgregado.recepcao.eficiencia}%`, cor: corEficienciaBg(scoutAgregado.recepcao.eficiencia), tem: scoutAgregado.recepcao.total > 0 },
    { rotulo: 'Erros de saque', valor: String(scoutAgregado.saque.erro), cor: scoutAgregado.saque.erro > 0 ? 'var(--rd-erro)' : 'var(--rd-positivo)', tem: scoutAgregado.saque.total > 0 },
  ]

  function compartilhar(modo: 'html' | 'pdf') {
    const html = gerarHtmlPerfilAtleta({ ...atleta!, posicaoPrincipal: posicaoNormalizada, posicaoSecundaria: posicaoSecundariaNormalizada }, scoutAgregado, rating, partidasInfo)
    if (modo === 'html') baixarHtml(html, `RDSports_perfil_${slugify(atleta!.nome)}.html`)
    else abrirParaImprimir(html)
  }

  function copiarCodigo() {
    if (!atleta?.codigoAcesso) return
    navigator.clipboard?.writeText(atleta.codigoAcesso).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    })
  }

  return (
    <div className="rd-album">
      <BotaoVoltar to={`/turmas/${atleta.turmaId}`} label={turma?.nome ?? 'Turma'} />

      {/* Cabeçalho "Álbum": foto/iniciais com anel dourado, nome, etiquetas e a nota. */}
      <div className="text-center mb-5">
        <AvatarAtleta nome={atleta.nome} fotoUrl={atleta.fotoUrl} tamanho={96} ouro />
        <h1 className="text-2xl font-black tracking-tight mt-3">{atleta.nome}</h1>
        <div className="flex flex-wrap justify-center gap-1.5 mt-2">
          {nomePosicao && <span className="rd-chip">{nomePosicao}{nomePosicaoSec ? ` + ${nomePosicaoSec}` : ''}</span>}
          {atleta.numero && <span className="rd-chip">nº {atleta.numero}</span>}
          {turma && <span className="rd-chip">{turma.nome}</span>}
        </div>
        <div className="text-6xl font-black tracking-tight mt-3 leading-none rd-accent-text">
          {rating.rating.toFixed(1).replace('.', ',')}
        </div>
        <div className="flex flex-wrap justify-center items-center gap-1.5 mt-2">
          <span className="rd-chip" style={{ color: corRating(rating.rating) }}>
            {rating.totalAcoes === 0 ? 'sem partidas finalizadas ainda' : rating.rating >= 8 ? 'rating bom' : rating.rating >= 7 ? 'rating mediano' : 'rating pede atenção'}
          </span>
          {colocacaoNaTurma === 1 && <span className="rd-chip rd-chip-gold">melhor da turma</span>}
          {colocacaoNaTurma !== null && colocacaoNaTurma > 1 && <span className="rd-chip">{colocacaoNaTurma}ª da turma</span>}
        </div>
        <div className="text-xs text-[var(--rd-text-dim)] mt-2">
          {rating.totalAcoes} ações registradas
          {rating.confianca < 1 && rating.totalAcoes > 0 && ` • amostra ainda pequena (confiança ${Math.round(rating.confianca * 100)}%)`}
        </div>
      </div>

      {rating.totalAcoes > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5 max-w-md mx-auto">
          {numerosDestaque.map((n) => (
            <Card key={n.rotulo} className="text-center !px-2 !py-3">
              <div className="text-2xl font-black leading-tight" style={{ color: n.tem ? n.cor : 'var(--rd-text-dim)' }}>{n.tem ? n.valor : '—'}</div>
              <div className="text-[11px] text-[var(--rd-text-dim)] mt-0.5">{n.rotulo}</div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mb-5">
        <div className="font-bold text-sm mb-3 flex items-center gap-2"><Camera size={16} className="rd-accent-text" /> Foto</div>
        <LogoUpload
          logoUrl={atleta.fotoUrl} prefixo="atleta" id={atleta.id} nome={atleta.nome} tamanho={56}
          onEnviado={(url) => updateAtleta(atleta.id, { fotoUrl: url })}
        />
      </Card>

      <Card className="mb-5">
        <div className="font-bold text-sm mb-3">📋 Cadastro</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Data de nascimento junto com a idade (pedido 11/11/2026): com a
              data preenchida, a idade é calculada sozinha e o campo de idade
              fica só pra leitura; sem data, a idade continua digitada à mão. */}
          <Field label="Data de nascimento">
            <input
              type="date" className="rd-input"
              value={atleta.nascimento ?? ''}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                const nascimento = e.target.value || undefined
                updateAtleta(atleta.id, nascimento
                  ? { nascimento, idade: calcularIdade(nascimento) }
                  : { nascimento: undefined })
              }}
            />
          </Field>
          <Field label={atleta.nascimento ? 'Idade (calculada pela data)' : 'Idade'}>
            <input
              type="number" min={0} className="rd-input"
              value={(atleta.nascimento ? calcularIdade(atleta.nascimento) : atleta.idade) ?? ''}
              readOnly={!!atleta.nascimento}
              onChange={(e) => updateAtleta(atleta.id, { idade: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
          <Field label="Altura (cm)">
            <input
              type="number" min={0} className="rd-input"
              value={atleta.alturaCm ?? ''}
              onChange={(e) => updateAtleta(atleta.id, { alturaCm: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
          <Field label="Função principal">
            <select
              className="rd-input"
              value={posicaoNormalizada ?? ''}
              onChange={(e) => updateAtleta(atleta.id, { posicaoPrincipal: (e.target.value || undefined) as Posicao | undefined })}
            >
              <option value="">Não definida</option>
              {POSICOES.map((p) => (
                <option key={p.valor} value={p.valor}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Função secundária (opcional)">
            <select
              className="rd-input"
              value={posicaoSecundariaNormalizada ?? ''}
              onChange={(e) => updateAtleta(atleta.id, { posicaoSecundaria: (e.target.value || undefined) as Posicao | undefined })}
            >
              <option value="">Nenhuma</option>
              {POSICOES.map((p) => (
                <option key={p.valor} value={p.valor}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Número">
            <input
              className="rd-input"
              value={atleta.numero ?? ''}
              onChange={(e) => updateAtleta(atleta.id, { numero: e.target.value || undefined })}
            />
          </Field>
          {/* Apelidos (21/11/2026): o scout por voz reconhece a atleta por eles. */}
          <Field label="Apelidos (pro scout por voz)">
            <input
              className="rd-input"
              placeholder="Cacau, Clau"
              value={atleta.apelidos ?? ''}
              onChange={(e) => updateAtleta(atleta.id, { apelidos: e.target.value || undefined })}
            />
            <span className="block text-[11px] text-[var(--rd-text-dim)] mt-1">Separe por vírgula. No scout por voz, falar o apelido ou o sobrenome também acha a atleta.</span>
          </Field>
        </div>
      </Card>

      <Card className="mb-5">
        <div className="font-bold text-sm mb-3 flex items-center gap-2"><KeyRound size={16} className="rd-accent-text" /> Portal da Atleta</div>
        <p className="text-xs text-[var(--rd-text-dim)] mb-3">
          Com este código, a própria atleta pode entrar no Portal da Atleta (em outra aba/dispositivo) e ver só o rating e o scout dela, sem precisar de login do treinador.
        </p>
        {atleta.codigoAcesso ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl font-black tracking-widest px-3 py-1.5 rounded-lg" style={{ background: 'rgba(212,175,55,.12)', color: 'var(--rd-gold)' }}>
              {atleta.codigoAcesso}
            </span>
            <Button onClick={copiarCodigo}>{copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Copiar'}</Button>
            <Button onClick={() => updateAtleta(atleta.id, { codigoAcesso: gerarCodigoAcesso() })}><RefreshCw size={16} /> Gerar novo</Button>
            <Button variant="danger" onClick={() => updateAtleta(atleta.id, { codigoAcesso: undefined })}>Desativar acesso</Button>
          </div>
        ) : (
          <Button variant="gold" onClick={() => updateAtleta(atleta.id, { codigoAcesso: gerarCodigoAcesso() })}>
            <KeyRound size={16} /> Gerar código de acesso
          </Button>
        )}
      </Card>

      <Card className="mb-5 flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-bold flex items-center gap-2"><Download size={16} className="rd-accent-text" /> Compartilhar perfil</span>
        <div className="flex gap-2">
          <button className="rd-btn text-xs" onClick={() => compartilhar('html')}><Download size={14} /> Baixar HTML</button>
          <button className="rd-btn text-xs" onClick={() => compartilhar('pdf')}><Printer size={14} /> Baixar PDF</button>
        </div>
      </Card>

      <EvolucaoIndividual atletaId={atleta.id} partidas={partidas} />

      <SecaoPosicaoAtleta atletaId={atleta.id} partidasDaTurma={partidasDaTurma} />

      <Card>
        <div className="font-bold text-sm mb-3">🏐 Números por partida</div>
        <p className="text-[11px] text-[var(--rd-text-dim)] mb-2">Toque numa partida pra ver só os dados dela aqui — nunca o scout das colegas de turma.</p>
        {partidasInfo.length === 0 ? (
          <p className="text-xs text-[var(--rd-text-dim)]">Nenhuma partida finalizada com ações registradas ainda.</p>
        ) : (
          <div className="grid gap-2">
            {partidasInfo.map(({ partida, totalGeral }) => (
              <button
                key={partida.id}
                onClick={() => {
                  const html = gerarHtmlRelatorioAtleta(partida, partida.setsPartida, { id: atleta.id, nome: atleta.nome }, 'Todos os sets')
                  abrirParaImprimir(html)
                }}
                className="w-full flex items-center justify-between text-xs border-t border-[var(--rd-border)] pt-2 first:border-t-0 first:pt-0 hover:opacity-80 text-left"
              >
                <span>
                  <strong>vs {partida.adversarioNome ?? 'Adversário'}</strong>
                  <span className="text-[var(--rd-text-dim)]"> — {formatDate(partida.data)} — {partida.setsGanhosCasa}×{partida.setsGanhosAdversario}</span>
                </span>
                <span className={`font-bold ${corEficiencia(totalGeral.eficiencia)}`}>{totalGeral.total} ações • {totalGeral.eficiencia}%</span>
              </button>
            ))}
          </div>
        )}
      </Card>

    </div>
  )
}
