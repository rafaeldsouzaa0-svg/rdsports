import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { idbStorage } from './storage'
import { uid, nowISO, isoDia } from './utils'
import type {
  Escola, Turma, Equipe, Categoria, Atleta, Adversario, Campeonato,
  Partida, HorarioTreino, JogoAgendado, RegistroPresenca, AvaliacaoPeriodica,
  FormatoPartida, SessaoTreino, QuadroTreino, ExercicioBiblioteca,
} from './types'
import { QUADRO_SLOTS } from './types'
import type { DadosNuvem } from './cloudSync'
import type { BackupDados } from './backup'

/** CORREÇÃO (pedido 30/10/2026 — bug real relatado pelo Henrique: "no meu
 *  celular não atualizou as coisas que tem no tablet"): antes, pra um id que
 *  já existisse localmente, essa função SEMPRE mantinha a versão local e
 *  jogava fora a da nuvem — só aceitava registros com id totalmente novo. Ou
 *  seja: um aparelho nunca enxergava uma EDIÇÃO feita em outro aparelho num
 *  registro que ele já tinha (só via registros criados do zero em outro
 *  lugar). Agora, quando o mesmo id existe dos dois lados, fica com quem foi
 *  atualizado por último (`updatedAt`, marcado pelo PRÓPRIO BANCO via
 *  trigger — nunca pelo relógio do celular/tablet, que podem estar
 *  dessincronizados). Sem `updatedAt` dos dois lados pra comparar (registro
 *  local criado antes dessa coluna existir, por exemplo), mantém o local —
 *  mesmo comportamento conservador de antes, só como última saída. */
export function maisRecente(dataA: string | undefined, dataB: string | undefined): 'a' | 'b' | 'empate' {
  if (!dataA && !dataB) return 'empate'
  if (!dataA) return 'b'
  if (!dataB) return 'a'
  if (dataA === dataB) return 'empate'
  return dataA > dataB ? 'a' : 'b'
}

export function mesclarPorId<T extends { id: string; updatedAt?: string; createdAt?: string }>(local: T[], daNuvem: T[]): T[] {
  const mapaNuvem = new Map<string, T>()
  for (const item of daNuvem) mapaNuvem.set(item.id, item)

  let mudouAlgumRegistro = false
  const resultado = local.map((itemLocal) => {
    const itemNuvem = mapaNuvem.get(itemLocal.id)
    if (!itemNuvem) return itemLocal
    mapaNuvem.delete(itemLocal.id)
    const vencedor = maisRecente(itemLocal.updatedAt ?? itemLocal.createdAt, itemNuvem.updatedAt ?? itemNuvem.createdAt)
    if (vencedor === 'b') { mudouAlgumRegistro = true; return itemNuvem }
    return itemLocal
  })
  // Sobrou na nuvem = id que esse aparelho nunca teve (criado em outro
  // aparelho) — sempre entra.
  if (mapaNuvem.size > 0) mudouAlgumRegistro = true
  const novos = Array.from(mapaNuvem.values())

  // Só cria um array novo se algo realmente mudou — evita disparar uma
  // sincronização nova (via store.subscribe) a cada pull periódico quando
  // nada de fato mudou.
  if (!mudouAlgumRegistro) return local
  return [...resultado, ...novos]
}

interface RDState {
  escolas: Escola[]
  turmas: Turma[]
  equipes: Equipe[]
  categorias: Categoria[]
  atletas: Atleta[]
  adversarios: Adversario[]
  campeonatos: Campeonato[]
  partidas: Partida[]
  horariosTreino: HorarioTreino[]
  jogosAgendados: JogoAgendado[]
  presencas: RegistroPresenca[]
  avaliacoes: AvaliacaoPeriodica[]
  sessoesTreino: SessaoTreino[]
  bibliotecaExercicios: ExercicioBiblioteca[]

  addEscola: (nome: string) => Escola
  updateEscola: (id: string, patch: Partial<Pick<Escola, 'nome' | 'logoUrl'>>) => void
  deleteEscola: (id: string) => void
  restoreEscola: (id: string) => void

  addTurma: (escolaId: string, nome: string) => Turma
  updateTurma: (id: string, patch: Partial<Pick<Turma, 'nome' | 'nivel'>>) => void
  deleteTurma: (id: string) => void
  restoreTurma: (id: string) => void

  addEquipe: (turmaId: string, nome: string) => Equipe
  deleteEquipe: (id: string) => void
  restoreEquipe: (id: string) => void

  addAtleta: (turmaId: string, nome: string, extra?: Partial<Atleta>) => Atleta
  updateAtleta: (id: string, patch: Partial<Atleta>) => void
  deleteAtleta: (id: string) => void
  restoreAtleta: (id: string) => void

  addAdversario: (nome: string) => Adversario
  updateAdversario: (id: string, patch: Partial<Pick<Adversario, 'nome' | 'logoUrl'>>) => void
  addCampeonato: (nome: string, turmaId?: string) => Campeonato
  deleteCampeonato: (id: string) => void

  criarPartida: (turmaId: string, tipo: 'JOGO' | 'TREINO', formato: FormatoPartida, extra?: Partial<Partida>) => Partida
  atualizarPartida: (id: string, patch: Partial<Partida>) => void
  excluirPartida: (id: string) => void
  restaurarPartida: (id: string) => void

  addHorarioTreino: (turmaId: string, diaSemana: number, horario: string, local?: string) => HorarioTreino
  deleteHorarioTreino: (id: string) => void

  addJogoAgendado: (j: Omit<JogoAgendado, 'id' | 'createdAt'>) => JogoAgendado
  updateJogoAgendado: (id: string, patch: Partial<Omit<JogoAgendado, 'id' | 'createdAt'>>) => void
  deleteJogoAgendado: (id: string) => void
  restoreJogoAgendado: (id: string) => void

  registrarPresenca: (turmaId: string, atletaId: string, data: string, presente: boolean) => void

  addAvaliacao: (a: Omit<AvaliacaoPeriodica, 'id'>) => AvaliacaoPeriodica

  criarSessaoTreino: (turmaId: string) => SessaoTreino
  atualizarSessaoTreino: (id: string, patch: Partial<Omit<SessaoTreino, 'id' | 'createdAt'>>) => void
  atualizarQuadroTreino: (sessaoId: string, chave: string, patch: Partial<QuadroTreino>) => void
  /** Troca o conteúdo completo (nome, objetivo, tempo, como funciona,
   *  desenho) entre dois quadros da mesma sessão (pedido 31/10/2026:
   *  "arrastar o exercício para outra parte do treino"). Sempre uma TROCA,
   *  nunca uma sobrescrita — se o destino já tiver algo, ele vai pro lugar
   *  de origem, então nenhum dado se perde. `chave`/posição na ficha de cada
   *  quadro nunca muda, só o conteúdo. */
  trocarQuadrosTreino: (sessaoId: string, chaveA: string, chaveB: string) => void
  excluirSessaoTreino: (id: string) => void
  restaurarSessaoTreino: (id: string) => void

  addExercicioBiblioteca: (e: Omit<ExercicioBiblioteca, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => ExercicioBiblioteca
  atualizarExercicioBiblioteca: (id: string, patch: Partial<Omit<ExercicioBiblioteca, 'id' | 'createdAt'>>) => void
  excluirExercicioBiblioteca: (id: string) => void
  restaurarExercicioBiblioteca: (id: string) => void

  mesclarDaNuvem: (dados: DadosNuvem) => void
  restaurarBackupCompleto: (dados: BackupDados) => void
}

const carimbo = () => nowISO()

export const useStore = create<RDState>()(
  persist(
    (setState, get) => ({
      escolas: [],
      turmas: [],
      equipes: [],
      categorias: [],
      atletas: [],
      adversarios: [],
      campeonatos: [],
      partidas: [],
      horariosTreino: [],
      jogosAgendados: [],
      presencas: [],
      avaliacoes: [],
      sessoesTreino: [],
      bibliotecaExercicios: [],

      addEscola: (nome) => {
        const escola: Escola = { id: uid(), nome, createdAt: nowISO() }
        setState((s) => ({ escolas: [...s.escolas, escola] }))
        return escola
      },
      updateEscola: (id, patch) => {
        setState((s) => ({ escolas: s.escolas.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
      },
      deleteEscola: (id) => {
        const ts = carimbo()
        setState((s) => ({
          escolas: s.escolas.map((e) => (e.id === id ? { ...e, deletedAt: ts } : e)),
          turmas: s.turmas.map((t) => (t.escolaId === id ? { ...t, deletedAt: ts } : t)),
          equipes: s.equipes.map((eq) =>
            s.turmas.some((t) => t.escolaId === id && t.id === eq.turmaId) ? { ...eq, deletedAt: ts } : eq
          ),
          atletas: s.atletas.map((a) =>
            s.turmas.some((t) => t.escolaId === id && t.id === a.turmaId) ? { ...a, deletedAt: ts } : a
          ),
        }))
      },
      restoreEscola: (id) => {
        setState((s) => ({
          escolas: s.escolas.map((e) => (e.id === id ? { ...e, deletedAt: undefined } : e)),
        }))
      },

      addTurma: (escolaId, nome) => {
        const turma: Turma = { id: uid(), escolaId, nome, createdAt: nowISO() }
        setState((s) => ({ turmas: [...s.turmas, turma] }))
        return turma
      },
      updateTurma: (id, patch) => {
        setState((s) => ({ turmas: s.turmas.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
      },
      deleteTurma: (id) => {
        const ts = carimbo()
        setState((s) => ({
          turmas: s.turmas.map((t) => (t.id === id ? { ...t, deletedAt: ts } : t)),
          equipes: s.equipes.map((eq) => (eq.turmaId === id ? { ...eq, deletedAt: ts } : eq)),
          atletas: s.atletas.map((a) => (a.turmaId === id ? { ...a, deletedAt: ts } : a)),
          horariosTreino: s.horariosTreino.filter((h) => h.turmaId !== id),
          presencas: s.presencas.filter((p) => p.turmaId !== id),
        }))
      },
      restoreTurma: (id) => {
        setState((s) => ({ turmas: s.turmas.map((t) => (t.id === id ? { ...t, deletedAt: undefined } : t)) }))
      },

      addEquipe: (turmaId, nome) => {
        const equipe: Equipe = { id: uid(), turmaId, nome, createdAt: nowISO() }
        setState((s) => ({ equipes: [...s.equipes, equipe] }))
        return equipe
      },
      deleteEquipe: (id) => {
        const ts = carimbo()
        setState((s) => ({
          equipes: s.equipes.map((e) => (e.id === id ? { ...e, deletedAt: ts } : e)),
          categorias: s.categorias.filter((c) => c.equipeId !== id),
        }))
      },
      restoreEquipe: (id) => {
        setState((s) => ({ equipes: s.equipes.map((e) => (e.id === id ? { ...e, deletedAt: undefined } : e)) }))
      },

      addAtleta: (turmaId, nome, extra) => {
        const atleta: Atleta = { id: uid(), turmaId, nome, status: 'ATIVA', createdAt: nowISO(), ...extra }
        setState((s) => ({ atletas: [...s.atletas, atleta] }))
        return atleta
      },
      updateAtleta: (id, patch) => {
        setState((s) => ({ atletas: s.atletas.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
      },
      deleteAtleta: (id) => {
        const ts = carimbo()
        setState((s) => ({
          atletas: s.atletas.map((a) => (a.id === id ? { ...a, deletedAt: ts } : a)),
          presencas: s.presencas.filter((p) => p.atletaId !== id),
          avaliacoes: s.avaliacoes.filter((av) => av.atletaId !== id),
        }))
      },
      restoreAtleta: (id) => {
        setState((s) => ({ atletas: s.atletas.map((a) => (a.id === id ? { ...a, deletedAt: undefined } : a)) }))
      },

      addAdversario: (nome) => {
        const existente = get().adversarios.find((a) => a.nome.toLowerCase() === nome.toLowerCase())
        if (existente) return existente
        const adv: Adversario = { id: uid(), nome, createdAt: nowISO() }
        setState((s) => ({ adversarios: [...s.adversarios, adv] }))
        return adv
      },
      updateAdversario: (id, patch) => {
        setState((s) => ({ adversarios: s.adversarios.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
      },

      addCampeonato: (nome, turmaId) => {
        const camp: Campeonato = { id: uid(), nome, turmaId, createdAt: nowISO() }
        setState((s) => ({ campeonatos: [...s.campeonatos, camp] }))
        return camp
      },
      deleteCampeonato: (id) => {
        const ts = carimbo()
        setState((s) => ({ campeonatos: s.campeonatos.map((c) => (c.id === id ? { ...c, deletedAt: ts } : c)) }))
      },

      criarPartida: (turmaId, tipo, formato, extra) => {
        const partida: Partida = {
          id: uid(),
          tipo,
          turmaId,
          formato,
          data: nowISO().slice(0, 10),
          status: 'EM_ANDAMENTO',
          setsPartida: [],
          setsGanhosCasa: 0,
          setsGanhosAdversario: 0,
          createdAt: nowISO(),
          ...extra,
        }
        setState((s) => ({ partidas: [...s.partidas, partida] }))
        return partida
      },
      atualizarPartida: (id, patch) => {
        setState((s) => ({ partidas: s.partidas.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
      },
      excluirPartida: (id) => {
        setState((s) => ({ partidas: s.partidas.map((p) => (p.id === id ? { ...p, deletedAt: carimbo() } : p)) }))
      },
      restaurarPartida: (id) => {
        setState((s) => ({ partidas: s.partidas.map((p) => (p.id === id ? { ...p, deletedAt: undefined } : p)) }))
      },

      addHorarioTreino: (turmaId, diaSemana, horario, local) => {
        const h: HorarioTreino = { id: uid(), turmaId, diaSemana, horario, local }
        setState((s) => ({ horariosTreino: [...s.horariosTreino, h] }))
        return h
      },
      deleteHorarioTreino: (id) => {
        setState((s) => ({ horariosTreino: s.horariosTreino.filter((h) => h.id !== id) }))
      },

      addJogoAgendado: (j) => {
        const jogo: JogoAgendado = { ...j, id: uid(), createdAt: nowISO() }
        setState((s) => ({ jogosAgendados: [...s.jogosAgendados, jogo] }))
        return jogo
      },
      updateJogoAgendado: (id, patch) => {
        setState((s) => ({ jogosAgendados: s.jogosAgendados.map((j) => (j.id === id ? { ...j, ...patch } : j)) }))
      },
      deleteJogoAgendado: (id) => {
        setState((s) => ({ jogosAgendados: s.jogosAgendados.map((j) => (j.id === id ? { ...j, deletedAt: carimbo() } : j)) }))
      },
      restoreJogoAgendado: (id) => {
        setState((s) => ({ jogosAgendados: s.jogosAgendados.map((j) => (j.id === id ? { ...j, deletedAt: undefined } : j)) }))
      },

      registrarPresenca: (turmaId, atletaId, data, presente) => {
        setState((s) => {
          const existente = s.presencas.find((p) => p.turmaId === turmaId && p.atletaId === atletaId && p.data === data)
          if (existente) {
            return { presencas: s.presencas.map((p) => (p.id === existente.id ? { ...p, presente } : p)) }
          }
          return { presencas: [...s.presencas, { id: uid(), turmaId, atletaId, data, presente }] }
        })
      },

      addAvaliacao: (a) => {
        const av: AvaliacaoPeriodica = { ...a, id: uid() }
        setState((s) => ({ avaliacoes: [...s.avaliacoes, av] }))
        return av
      },

      criarSessaoTreino: (turmaId) => {
        const agora = carimbo()
        const sessao: SessaoTreino = {
          // `agora.slice(0, 10)` pegaria a data em UTC (bug de fuso horário já
          // documentado em utils.ts) — à noite no Brasil isso já vira o dia
          // seguinte e a sessão "some" do dia certo no Calendário.
          id: uid(), turmaId, data: isoDia(new Date()),
          temas: [], condicionantes: [],
          quadros: QUADRO_SLOTS.map((q) => ({ chave: q.chave })),
          registroPedagogico: {},
          createdAt: agora, updatedAt: agora,
        }
        setState((s) => ({ sessoesTreino: [...s.sessoesTreino, sessao] }))
        return sessao
      },

      atualizarSessaoTreino: (id, patch) => {
        setState((s) => ({
          sessoesTreino: s.sessoesTreino.map((sess) => (sess.id === id ? { ...sess, ...patch, updatedAt: carimbo() } : sess)),
        }))
      },

      atualizarQuadroTreino: (sessaoId, chave, patch) => {
        setState((s) => ({
          sessoesTreino: s.sessoesTreino.map((sess) =>
            sess.id === sessaoId
              ? { ...sess, updatedAt: carimbo(), quadros: sess.quadros.map((q) => (q.chave === chave ? { ...q, ...patch } : q)) }
              : sess
          ),
        }))
      },

      trocarQuadrosTreino: (sessaoId, chaveA, chaveB) => {
        if (chaveA === chaveB) return
        setState((s) => ({
          sessoesTreino: s.sessoesTreino.map((sess) => {
            if (sess.id !== sessaoId) return sess
            const qa = sess.quadros.find((q) => q.chave === chaveA)
            const qb = sess.quadros.find((q) => q.chave === chaveB)
            if (!qa || !qb) return sess
            return {
              ...sess,
              updatedAt: carimbo(),
              quadros: sess.quadros.map((q) => {
                if (q.chave === chaveA) return { ...qb, chave: chaveA }
                if (q.chave === chaveB) return { ...qa, chave: chaveB }
                return q
              }),
            }
          }),
        }))
      },

      // Apagar e restaurar marcam `updatedAt` (11/11/2026, junto com a
      // sincronização dos treinos): sem isso, a cópia não apagada do outro
      // aparelho parecia "mais nova" e o treino apagado voltava sozinho.
      excluirSessaoTreino: (id) => {
        const agora = carimbo()
        setState((s) => ({ sessoesTreino: s.sessoesTreino.map((sess) => (sess.id === id ? { ...sess, deletedAt: agora, updatedAt: agora } : sess)) }))
      },

      restaurarSessaoTreino: (id) => {
        setState((s) => ({ sessoesTreino: s.sessoesTreino.map((sess) => (sess.id === id ? { ...sess, deletedAt: undefined, updatedAt: carimbo() } : sess)) }))
      },

      addExercicioBiblioteca: (e) => {
        const agora = carimbo()
        const exercicio: ExercicioBiblioteca = { ...e, id: uid(), createdAt: agora, updatedAt: agora }
        setState((s) => ({ bibliotecaExercicios: [...s.bibliotecaExercicios, exercicio] }))
        return exercicio
      },

      atualizarExercicioBiblioteca: (id, patch) => {
        setState((s) => ({
          bibliotecaExercicios: s.bibliotecaExercicios.map((ex) => (ex.id === id ? { ...ex, ...patch, updatedAt: carimbo() } : ex)),
        }))
      },

      excluirExercicioBiblioteca: (id) => {
        const agora = carimbo()
        setState((s) => ({ bibliotecaExercicios: s.bibliotecaExercicios.map((ex) => (ex.id === id ? { ...ex, deletedAt: agora, updatedAt: agora } : ex)) }))
      },

      restaurarExercicioBiblioteca: (id) => {
        setState((s) => ({ bibliotecaExercicios: s.bibliotecaExercicios.map((ex) => (ex.id === id ? { ...ex, deletedAt: undefined, updatedAt: carimbo() } : ex)) }))
      },

      mesclarDaNuvem: (dados) => {
        const s = get()
        const proximo = {
          escolas: mesclarPorId(s.escolas, dados.escolas),
          turmas: mesclarPorId(s.turmas, dados.turmas),
          atletas: mesclarPorId(s.atletas, dados.atletas),
          adversarios: mesclarPorId(s.adversarios, dados.adversarios),
          campeonatos: mesclarPorId(s.campeonatos, dados.campeonatos),
          partidas: mesclarPorId(s.partidas, dados.partidas),
          jogosAgendados: mesclarPorId(s.jogosAgendados, dados.jogosAgendados),
          avaliacoes: mesclarPorId(s.avaliacoes, dados.avaliacoes),
          sessoesTreino: mesclarPorId(s.sessoesTreino, dados.sessoesTreino),
          bibliotecaExercicios: mesclarPorId(s.bibliotecaExercicios, dados.bibliotecaExercicios),
        }
        // `mesclarPorId` devolve a MESMA referência de array quando nada
        // mudou naquela lista — se nenhuma das listas mudou, nem chama setState,
        // pra não disparar o `store.subscribe` (que agendaria um push à toa
        // a cada pull periódico, mesmo sem nenhuma mudança real).
        const mudouAlgo = (Object.keys(proximo) as (keyof typeof proximo)[]).some((k) => proximo[k] !== s[k])
        if (mudouAlgo) setState(proximo)
      },

      // Restaurar um backup .json SUBSTITUI todos os dados do aparelho pelos
      // dados do arquivo (não mescla) — é o que faz sentido pra "voltar pra
      // como tava" depois de um problema. A tela que chama isso já confirma
      // com o usuário antes, porque os dados atuais são perdidos.
      restaurarBackupCompleto: (dados) => {
        setState(() => ({
          escolas: dados.escolas,
          turmas: dados.turmas,
          equipes: dados.equipes,
          categorias: dados.categorias,
          atletas: dados.atletas,
          adversarios: dados.adversarios,
          campeonatos: dados.campeonatos,
          partidas: dados.partidas,
          horariosTreino: dados.horariosTreino,
          jogosAgendados: dados.jogosAgendados,
          presencas: dados.presencas,
          avaliacoes: dados.avaliacoes,
          sessoesTreino: dados.sessoesTreino,
          bibliotecaExercicios: dados.bibliotecaExercicios ?? [],
        }))
      },
    }),
    {
      name: 'rdsports-storage',
      storage: {
        getItem: async (name) => {
          const raw = await idbStorage.getItem(name)
          return raw ? JSON.parse(raw) : null
        },
        setItem: async (name, value) => {
          await idbStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: async (name) => {
          await idbStorage.removeItem(name)
        },
      },
      version: 2,
    }
  )
)
