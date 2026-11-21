// Painel do scout por voz (pedido 21/11/2026). Aparece no scout ao vivo
// quando o professor escolhe "🎙️ Voz" no seletor (no lugar dos botões de
// fundamento). Toca no microfone, fala a jogada, e:
// - se deu pra entender tudo, marca na hora e fala a confirmação;
// - se faltou algo (quem foi, o resultado…), pergunta com botões.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Undo2, Volume2, VolumeX, Keyboard } from 'lucide-react'
import {
  interpretarFalaVarias, fraseConfirmacao, resultadosPossiveis, SEM_RESULTADO, LABEL_FUNDAMENTO_VOZ, LABEL_RESULTADO_VOZ,
  type AtletaVoz, type Jogada,
} from '../scoutVoz'
import { useReconhecimentoVoz, falar } from '../useReconhecimentoVoz'
import type { FundamentoScout, ResultadoEvento } from '../types'

export interface MarcacaoVoz {
  lado: 'CASA' | 'ADVERSARIO'
  fundamento: FundamentoScout
  resultado: ResultadoEvento
  atletaId?: string
  numeroAdversario?: string
}

/** Preenche o que faltava numa jogada e recalcula o que ainda falta. */
function completarJogada(base: Jogada, patch: Partial<Jogada>, sacadoraId?: string | null): Jogada {
  const j: Jogada = { ...base, ...patch }
  if (j.fundamento && SEM_RESULTADO.includes(j.fundamento)) j.resultado = j.fundamento === 'nao_deslocou' ? 'ERRO' : 'ACERTO'
  if (j.fundamento === 'saque' && !j.atletaId && j.lado === 'CASA' && sacadoraId) j.atletaId = sacadoraId
  if (j.fundamento && j.resultado && j.lado === 'CASA' && !SEM_RESULTADO.includes(j.fundamento) && !resultadosPossiveis(j.fundamento).includes(j.resultado)) j.resultado = undefined
  const faltando: Jogada['faltando'] = []
  if (!j.fundamento) faltando.push('fundamento')
  if (j.lado === 'CASA' && !j.atletaId) faltando.push('atleta')
  if (!j.resultado) faltando.push('resultado')
  return { ...j, faltando }
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

const paraMarcacao = (j: Jogada): MarcacaoVoz => ({ lado: j.lado, fundamento: j.fundamento!, resultado: j.resultado!, atletaId: j.atletaId, numeroAdversario: j.numeroAdversario })

const FUNDAMENTOS_CASA: FundamentoScout[] = ['saque', 'recepcao', 'levantamento', 'ataque', 'bloqueio', 'defesa', 'bola_de_graca', 'bola_de_segunda', 'nao_deslocou']
const ADV_PONTO: FundamentoScout[] = ['ataque', 'saque', 'bloqueio', 'bola_de_segunda']
const ADV_ERRO: FundamentoScout[] = ['ataque', 'saque', 'recepcao', 'nao_deslocou']

const EXEMPLOS = [
  ['"Ataque Marina ponto"', 'ataque certo'],
  ['"Saque erro"', 'quem saca já é conhecida'],
  ['"Recepção Sofia boa"', 'boa / média / erro'],
  ['"Bloqueio Carol ponto"', ''],
  ['"Ponto deles, ataque"', 'ponto do adversário'],
  ['"Erro deles, saque"', 'erro do adversário'],
  ['"Desfaz"', 'apaga a última'],
  ['"Recepção Sofia boa, levantamento Júlia boa, ataque Marina ponto"', 'várias de uma vez → confirma'],
  ['"… ataque Marina ponto, confirma"', 'marca direto, sem perguntar'],
]

function lerPreferencia(chave: string, padrao: boolean): boolean {
  try { const v = localStorage.getItem(chave); return v === null ? padrao : v === '1' } catch { return padrao }
}
function salvarPreferencia(chave: string, v: boolean) {
  try { localStorage.setItem(chave, v ? '1' : '0') } catch { /* sem armazenamento: só não lembra */ }
}

export default function PainelVoz({
  emQuadra, todas, sacadoraId, onMarcar, onDesfazer, aoComecar, podeDesfazer, onUsarBotoes,
}: {
  emQuadra: AtletaVoz[]
  todas: AtletaVoz[]
  sacadoraId?: string | null
  /** Marca uma ou várias jogadas, nessa ordem (várias = falou tudo de uma vez). */
  onMarcar: (m: MarcacaoVoz[]) => void
  onDesfazer: () => void
  /** Chamado ao tocar no microfone (no scout pelo vídeo: pausa o vídeo e
   *  guarda o minuto do lance). */
  aoComecar?: () => void
  podeDesfazer: boolean
  onUsarBotoes: () => void
}) {
  const [ouvido, setOuvido] = useState<string | null>(null)
  const [pendente, setPendente] = useState<Jogada | null>(null)
  // Várias jogadas na mesma fala (pedido 21/11/2026): ficam numa lista pra
  // conferir e só são marcadas quando o professor confirma.
  const [lista, setLista] = useState<Jogada[] | null>(null)
  const [marcado, setMarcado] = useState<{ frase: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [comSom, setComSom] = useState(() => lerPreferencia('rdsports_voz_som', true))
  const [digitando, setDigitando] = useState(false)
  const [texto, setTexto] = useState('')
  const [mostrarExemplos, setMostrarExemplos] = useState(false)

  const nomeDe = (id?: string) => todas.find((a) => a.id === id)?.nome

  const concluir = useCallback((js: Jogada[]) => {
    const prontas = js.filter((j) => j.fundamento && j.resultado)
    if (prontas.length === 0) return
    const ms = prontas.map(paraMarcacao)
    onMarcar(ms)
    const frase = ms.length === 1 ? fraseConfirmacao(ms[0], nomeDe(ms[0].atletaId)) : `${ms.length} jogadas marcadas`
    setMarcado({ frase: ms.map((m) => fraseConfirmacao(m, nomeDe(m.atletaId), true)).join(' · ') })
    setPendente(null)
    setLista(null)
    if (comSom) falar(frase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMarcar, comSom, todas])

  const processar = useCallback((fala: string) => {
    setOuvido(fala)
    setAviso(null)
    setMarcado(null)
    const c = interpretarFalaVarias(fala, { emQuadra, todas, sacadoraId }, listaRef.current !== null)
    if (c.tipo === 'vazio') { setAviso('Não entendi. Toque e fale de novo.'); return }
    if (c.tipo === 'confirmar') {
      const atual = listaRef.current
      if (atual && atual.every((j) => j.faltando.length === 0)) concluir(atual)
      else if (atual) setAviso('Ainda falta completar alguma jogada da lista.')
      return
    }
    if (c.tipo === 'cancelar') { setLista(null); setPendente(null); setAviso('Cancelado. Nada foi marcado.'); return }
    if (c.tipo === 'desfazer') {
      if (podeDesfazer) { onDesfazer(); setMarcado({ frase: 'Última marcação desfeita' }); if (comSom) falar('Desfeito') }
      else setAviso('Não tem nada pra desfazer.')
      setPendente(null)
      setLista(null)
      return
    }
    const completas = c.jogadas.every((j) => j.faltando.length === 0)
    if (c.jogadas.length === 1 && !lista) {
      // Uma jogada só: igual antes (marca na hora ou pergunta o que faltou).
      setLista(null)
      if (completas) concluir(c.jogadas)
      else setPendente(c.jogadas[0])
      return
    }
    // Com uma lista já esperando, o que for falado agora entra no fim dela
    // (dá pra ir falando o rally aos pedaços e confirmar no final).
    const nova = [...(listaRef.current ?? []), ...c.jogadas]
    if (c.confirmarNoFim && nova.every((j) => j.faltando.length === 0)) { concluir(nova); return }
    setPendente(null)
    setLista(nova)
    if (comSom) falar(`${nova.length === 1 ? 'Uma jogada' : `${nova.length} jogadas`}. Confirma?`)
  }, [emQuadra, todas, sacadoraId, podeDesfazer, onDesfazer, comSom, concluir, lista])

  const { ouvindo, parcial, erro, ouvir, parar, disponivel } = useReconhecimentoVoz(processar)
  // `processar` precisa saber se tem lista esperando confirmação ("confirma").
  const listaRef = useRef<Jogada[] | null>(null)
  useEffect(() => { listaRef.current = lista }, [lista])

  function tocarMicrofone() {
    if (ouvindo) { parar(); return }
    if (!listaRef.current) aoComecar?.()
    setPendente(null)
    setMarcado(null)
    setAviso(null)
    ouvir()
  }

  // Índice da jogada da lista que está sendo completada (a primeira incompleta).
  const idxIncompleta = lista ? lista.findIndex((j) => j.faltando.length > 0) : -1
  const emPergunta: Jogada | null = lista ? (idxIncompleta >= 0 ? lista[idxIncompleta] : null) : pendente

  function completar(patch: Partial<Jogada>) {
    if (lista && idxIncompleta >= 0) {
      setLista(lista.map((j, i) => (i === idxIncompleta ? completarJogada(j, patch, sacadoraId) : j)))
      return
    }
    if (!pendente) return
    const j = completarJogada(pendente, patch, sacadoraId)
    if (j.faltando.length === 0) concluir([j])
    else setPendente(j)
  }

  function enviarTexto(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    if (!listaRef.current) aoComecar?.()
    processar(texto.trim())
    setTexto('')
  }

  // Próxima pergunta, na ordem: (adversário) ponto ou erro → fundamento → atleta → resultado.
  let pergunta: React.ReactNode = null
  if (emPergunta) {
    const p = emPergunta
    if (p.lado === 'ADVERSARIO' && !p.resultado) {
      pergunta = (
        <Pergunta titulo="Foi ponto ou erro do adversário?">
          <button className="rd-btn" onClick={() => completar({ resultado: 'ACERTO' })}>🎯 Ponto deles</button>
          <button className="rd-btn" onClick={() => completar({ resultado: 'ERRO' })}>❌ Erro deles</button>
        </Pergunta>
      )
    } else if (!p.fundamento) {
      const opcoes = p.lado === 'ADVERSARIO' ? (p.resultado === 'ERRO' ? ADV_ERRO : ADV_PONTO) : FUNDAMENTOS_CASA
      pergunta = (
        <Pergunta titulo={p.lado === 'ADVERSARIO' ? 'Em que fundamento?' : 'Qual fundamento?'}>
          {opcoes.map((f) => (
            <button key={f} className="rd-btn" onClick={() => completar({ fundamento: f })}>
              {p.lado === 'ADVERSARIO' && f === 'nao_deslocou' ? 'Largada de 2ª (errada)' : LABEL_FUNDAMENTO_VOZ[f]}
            </button>
          ))}
        </Pergunta>
      )
    } else if (p.lado === 'CASA' && !p.atletaId) {
      pergunta = (
        <Pergunta titulo="Quem foi?">
          {emQuadra.map((a) => <button key={a.id} className="rd-btn" onClick={() => completar({ atletaId: a.id })}>{a.nome}</button>)}
        </Pergunta>
      )
    } else if (!p.resultado) {
      pergunta = (
        <Pergunta titulo={`${LABEL_FUNDAMENTO_VOZ[p.fundamento]}${p.atletaId ? ` · ${nomeDe(p.atletaId)?.split(' ')[0]}` : ''}: como foi?`}>
          {resultadosPossiveis(p.fundamento).map((r) => (
            <button key={r} className="rd-btn" onClick={() => completar({ resultado: r })}
              style={{ borderColor: r === 'ERRO' ? 'var(--rd-erro)' : r === 'ACERTO' || r === 'BOM' ? 'var(--rd-positivo)' : 'var(--rd-neutro)' }}>
              {LABEL_RESULTADO_VOZ[r][0].toUpperCase() + LABEL_RESULTADO_VOZ[r].slice(1)}
            </button>
          ))}
        </Pergunta>
      )
    }
  }

  return (
    <div>
      <div className="flex flex-col items-center gap-2 py-2">
        <button
          type="button"
          onClick={tocarMicrofone}
          aria-label={ouvindo ? 'Parar de ouvir' : 'Falar a jogada'}
          className="rounded-full flex items-center justify-center transition-transform active:scale-95"
          style={{
            width: 112, height: 112,
            background: ouvindo ? 'var(--rd-erro)' : 'var(--rd-gold)',
            color: ouvindo ? '#fff' : '#1a1300',
            boxShadow: ouvindo
              ? '0 0 0 10px rgba(231,76,60,.25), 0 0 0 22px rgba(231,76,60,.10)'
              : '0 0 0 10px rgba(212,175,55,.18), 0 0 0 22px rgba(212,175,55,.08)',
          }}
        >
          <Mic size={48} />
        </button>
        <div className="font-bold text-base mt-2">{ouvindo ? 'Ouvindo…' : lista ? 'Toque e fale "confirma"' : 'Toque e fale a jogada'}</div>
        {!ouvindo && !lista && <div className="text-xs text-[var(--rd-text-dim)] text-center">Pode falar várias jogadas seguidas — o app mostra a lista pra você confirmar.</div>}
        {!disponivel && <p className="text-xs text-center text-[var(--rd-erro)]">Este navegador não tem reconhecimento de voz. Dá pra digitar a jogada aqui embaixo.</p>}
      </div>

      {(ouvindo && parcial) || ouvido ? (
        <div className="rounded-xl p-3 text-center mb-3" style={{ border: `2px dashed ${ouvindo ? 'var(--rd-erro)' : 'var(--rd-border)'}` }}>
          <div className="text-[11px] text-[var(--rd-text-dim)]">Você disse:</div>
          <div className="text-lg font-bold">"{ouvindo ? parcial : ouvido}"</div>
        </div>
      ) : null}

      {erro && <p className="text-sm text-center mb-3 text-[var(--rd-erro)]">{erro}</p>}
      {aviso && <p className="text-sm text-center mb-3" style={{ color: '#f6b93b' }}>{aviso}</p>}

      {marcado && (
        <div className="rounded-xl p-3 mb-3 flex items-center justify-between gap-2" style={{ border: '2px solid var(--rd-positivo)' }}>
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--rd-positivo)' }}>✅ Marcado</div>
            <div className="font-bold">{marcado.frase}</div>
          </div>
          {podeDesfazer && <button className="rd-btn text-xs shrink-0" onClick={() => { onDesfazer(); setMarcado(null) }}><Undo2 size={14} /> Desfazer</button>}
        </div>
      )}

      {lista && (
        <div className="rounded-xl p-3 mb-3" style={{ border: '2px solid var(--rd-gold)' }}>
          <div className="text-xs font-bold mb-2 rd-accent-text">📋 Confira antes de marcar ({lista.length})</div>
          {lista.map((j, i) => {
            const nome = j.lado === 'ADVERSARIO' ? `Adversário${j.numeroAdversario ? ` (camisa ${j.numeroAdversario})` : ''}` : nomeDe(j.atletaId) ?? '❓ quem?'
            const res = j.resultado ? (j.lado === 'ADVERSARIO' ? (j.resultado === 'ERRO' ? 'Erro deles' : 'Ponto deles') : LABEL_RESULTADO_VOZ[j.resultado]) : '❓ como foi?'
            const corRes = !j.resultado ? '#f6b93b' : (j.lado === 'CASA') === (j.resultado === 'ERRO') ? 'var(--rd-erro)' : j.resultado === 'MEDIO' || j.resultado === 'EM_JOGO' ? 'var(--rd-neutro)' : 'var(--rd-positivo)'
            return (
              <div key={i} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0 text-sm" style={{ borderColor: 'var(--rd-border)', background: i === idxIncompleta ? 'rgba(246,185,59,.10)' : undefined }}>
                <span className="min-w-0">
                  <b>{i + 1}.</b> {j.fundamento ? maiuscula(LABEL_FUNDAMENTO_VOZ[j.fundamento]) : '❓ fundamento?'} · {nome} · <b style={{ color: corRes }}>{maiuscula(res)}</b>
                </span>
                <button className="text-[var(--rd-text-dim)] shrink-0 px-2" aria-label="Tirar esta jogada" onClick={() => setLista(lista.length > 1 ? lista.filter((_, k) => k !== i) : null)}>✕</button>
              </div>
            )
          })}
          {idxIncompleta >= 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--rd-border)' }}>
              <div className="text-xs font-bold mb-2" style={{ color: '#f6b93b' }}>🤔 Jogada {idxIncompleta + 1}: falta um detalhe</div>
              {pergunta}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button className="rd-btn rd-btn-gold flex-1" disabled={idxIncompleta >= 0} onClick={() => concluir(lista)}>✅ Confirmar {lista.length > 1 ? `as ${lista.length}` : ''}</button>
            <button className="rd-btn" onClick={() => { setLista(null); setAviso('Cancelado. Nada foi marcado.') }}>Cancelar</button>
          </div>
          <p className="text-xs text-[var(--rd-text-dim)] mt-2">Ou toque no microfone e fale <b>"confirma"</b> (ou "cancela").</p>
        </div>
      )}

      {pendente && !lista && (
        <div className="rounded-xl p-3 mb-3" style={{ border: '2px solid #f6b93b' }}>
          <div className="text-xs font-bold mb-2" style={{ color: '#f6b93b' }}>🤔 Falta só um detalhe</div>
          {pergunta}
          <button className="text-xs underline text-[var(--rd-text-dim)] mt-2" onClick={() => setPendente(null)}>Cancelar esta jogada</button>
        </div>
      )}

      {digitando && (
        <form onSubmit={enviarTexto} className="flex gap-2 mb-3">
          <input className="rd-input" placeholder='Ex.: ataque Marina ponto' value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
          <button className="rd-btn rd-btn-gold" type="submit">OK</button>
        </form>
      )}

      <div className="flex gap-2 flex-wrap justify-center">
        <button className="rd-btn text-xs" onClick={() => { const v = !comSom; setComSom(v); salvarPreferencia('rdsports_voz_som', v) }}>
          {comSom ? <Volume2 size={14} /> : <VolumeX size={14} />} {comSom ? 'Confirmação falada' : 'Sem som'}
        </button>
        <button className="rd-btn text-xs" onClick={() => setDigitando((v) => !v)}><Keyboard size={14} /> Digitar</button>
        <button className="rd-btn text-xs" onClick={() => setMostrarExemplos((v) => !v)}>🗣️ O que falar</button>
        <button className="rd-btn text-xs" onClick={onUsarBotoes}>👆 Usar botões</button>
      </div>

      {mostrarExemplos && (
        <div className="mt-3">
          {EXEMPLOS.map(([frase, dica]) => (
            <div key={frase} className="flex justify-between gap-2 py-1.5 text-sm border-b last:border-b-0" style={{ borderColor: 'var(--rd-border)' }}>
              <span>{frase}</span><span className="text-xs text-[var(--rd-text-dim)] text-right">{dica}</span>
            </div>
          ))}
          <p className="text-xs text-[var(--rd-text-dim)] mt-2">Pode falar o número da camisa ("camisa 7") no lugar do nome. Em ginásio barulhento, fale perto do celular.</p>
        </div>
      )}
    </div>
  )
}

function Pergunta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2">{titulo}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
