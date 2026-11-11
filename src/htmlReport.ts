// Exportação de relatórios estáticos (HTML autocontido + impressão/PDF), trazendo
// de volta o recurso que o app tinha antes da perda do código-fonte (Rodadas 21/27):
// "relatório da partida com todos os fundamentos + exportar HTML criativo" e
// "relatório individual por atleta (sem dados de colegas)". Cada arquivo gerado é
// 100% autocontido (CSS inline, sem dependências externas), pra poder ser aberto
// em qualquer navegador/dispositivo mesmo sem o app — igual ao exemplo que o
// Henrique mandou de uma rodada antiga.
import type { Atleta, Partida, SetPartida, FundamentoScout } from './types'
import { LABEL_POSICAO } from './types'
import {
  scoutEquipe, scoutPorAtleta, erroPorFundamentoAdversario, pontosPorFundamentoAdversario, resumoFormato, FUNDAMENTOS_SCOUT, LABEL_FUNDAMENTO,
  porFundamentoVazio, linhaVazia, type LinhaFundamento,
  analisePorPosicaoPartida, listaSubstituicoesDetalhada, pontoAPontoDoSet,
} from './scoutEngine'
import type { RatingAtleta } from './rating'
import { formatDate } from './utils'
import { calcularIdade, formatarDataBR } from './convocacao'

const ROMANO = ['I', 'II', 'III', 'IV', 'V', 'VI']

const CSS_BASE = `
  *{box-sizing:border-box}
  html{background:#000;min-height:100%}
  body{margin:0;background:#000;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;padding:20px;min-height:100vh}
  .wrap{max-width:860px;margin:0 auto}
  .header{background:linear-gradient(135deg,#0a0a0a,#d4af37);border-radius:20px;padding:24px;color:#fff;margin-bottom:20px}
  .header h1{margin:0;font-size:22px;font-weight:900;letter-spacing:-.02em}
  .header p{margin:4px 0 0;font-size:13px;opacity:.85}
  .card{background:#111;border:1px solid #232323;border-radius:14px;padding:16px;margin-bottom:16px}
  .placar{text-align:center}
  .placar .n{font-size:44px;font-weight:900;letter-spacing:-.02em}
  .placar .n .x{color:#d4af37}
  .placar .status{font-size:13px;color:#999;margin-top:2px}
  .badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}
  .badge{font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px}
  h2{font-size:15px;font-weight:900;border-bottom:2px solid #d4af37;padding-bottom:8px;margin:0 0 12px}
  .fund{margin-bottom:12px}
  .fund .label{font-size:12px;font-weight:700;margin-bottom:6px}
  .barra-row{display:grid;grid-template-columns:62px 1fr 28px;align-items:center;gap:8px;font-size:11px;margin-bottom:4px}
  .barra-row .track{height:8px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}
  .barra-row .fill{height:100%;border-radius:999px}
  .dim{color:#999}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;text-transform:uppercase;font-size:10px;color:#999;padding:6px 4px;font-weight:700}
  th.c, td.c{text-align:center}
  td{padding:6px 4px;border-top:1px solid #232323}
  .atleta-card{margin-bottom:12px}
  .atleta-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .atleta-nome{font-weight:700;font-size:14px}
  .atleta-resumo{font-size:11px;font-weight:700}
  .pos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
  .pos-cel{border:1px solid #232323;border-radius:10px;padding:10px;text-align:center}
  .pos-cel .rom{font-size:10px;font-weight:700;color:#999}
  .pos-cel .nums{font-size:12px;font-weight:700;margin-top:2px}
  .pos-destaque{border-radius:999px;font-size:10px;font-weight:700;padding:2px 8px;display:inline-block;margin:0 3px 6px}
  .set-titulo{font-size:12px;font-weight:700;margin:10px 0 6px;color:#d4af37}
  .set-titulo:first-child{margin-top:0}
  .sub-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;border-top:1px solid #232323;padding:6px 0}
  .sub-row:first-of-type{border-top:0}
  .seq-wrap{display:flex;flex-wrap:wrap;gap:4px}
  .seq-item{font-size:10px;font-weight:700;padding:3px 6px;border-radius:6px;background:rgba(255,255,255,.06)}
  footer{text-align:center;font-size:11px;color:#666;margin-top:24px}
  .rd-voltar-wrap{position:sticky;top:0;z-index:50;margin:-20px -20px 16px;padding:10px 20px;background:rgba(10,10,10,.92);backdrop-filter:blur(6px);border-bottom:1px solid #232323}
  .rd-voltar-btn{display:inline-flex;align-items:center;gap:6px;background:#d4af37;color:#0a0a0a;font-weight:800;font-size:13px;padding:8px 16px;border-radius:999px;border:none;cursor:pointer}
  .rd-voltar-btn:active{opacity:.8}
  @media print{
    .rd-voltar-wrap{display:none}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
    body{padding:0;background:#000 !important;color:#f0f0f0}
    .header{background:linear-gradient(135deg,#0a0a0a,#d4af37)}
  }
`

function corDe(tipo: 'positivo' | 'neutro' | 'erro'): string {
  return tipo === 'positivo' ? '#2ecc71' : tipo === 'neutro' ? '#3498db' : '#e74c3c'
}

function corEficienciaHex(ef: number): string {
  if (ef >= 50) return '#2ecc71'
  if (ef >= 0) return '#3498db'
  return '#e74c3c'
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item'
}

function barrasFundamentoHtml(fundamento: string, linha: LinhaFundamento): string {
  const max = Math.max(linha.positivo, linha.neutro, linha.erro, 1)
  const linhas: { label: string; valor: number; tipo: 'positivo' | 'neutro' | 'erro' }[] = [
    { label: 'Positivo', valor: linha.positivo, tipo: 'positivo' },
    { label: 'Neutro', valor: linha.neutro, tipo: 'neutro' },
    { label: 'Erro', valor: linha.erro, tipo: 'erro' },
  ]
  return `
    <div class="fund">
      <div class="label">${escapeHtml(fundamento)}</div>
      ${linhas.map((l) => `
        <div class="barra-row">
          <span class="dim">${l.label}</span>
          <div class="track"><div class="fill" style="width:${(l.valor / max) * 100}%;background:${corDe(l.tipo)}"></div></div>
          <span style="text-align:right;font-weight:600">${l.valor}</span>
        </div>
      `).join('')}
    </div>`
}

function tabelaAtletaHtml(porFundamento: ReturnType<typeof scoutPorAtleta>[number]['porFundamento']): string {
  const linhas = FUNDAMENTOS_SCOUT.filter((f) => porFundamento[f].total > 0)
  if (linhas.length === 0) return `<p class="dim" style="font-size:12px">Nenhum evento registrado.</p>`
  return `
    <table>
      <thead><tr><th>Fundamento</th><th class="c">Positivo</th><th class="c">Neutro</th><th class="c">Erro</th><th class="c">Total</th><th class="c">Efic.</th></tr></thead>
      <tbody>
        ${linhas.map((f) => {
          const l = porFundamento[f]
          return `<tr>
            <td style="font-weight:600">${LABEL_FUNDAMENTO[f]}</td>
            <td class="c" style="color:${corDe('positivo')}">${l.positivo}</td>
            <td class="c" style="color:${corDe('neutro')}">${l.neutro}</td>
            <td class="c" style="color:${corDe('erro')}">${l.erro}</td>
            <td class="c">${l.total}</td>
            <td class="c" style="font-weight:700;color:${corEficienciaHex(l.eficiencia)}">${l.eficiencia}%</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>`
}

function placarHtml(partida: Partida): string {
  return `
    <div class="card placar">
      <div class="n">${partida.setsGanhosCasa} <span class="x">×</span> ${partida.setsGanhosAdversario}</div>
      <div class="status">${partida.status === 'FINALIZADA' ? 'Finalizada' : 'Em andamento'}</div>
      <div class="badges">
        ${partida.setsPartida.map((s) => {
          const cor = s.vencedor === 'CASA' ? '#2ecc71' : s.vencedor === 'ADVERSARIO' ? '#e74c3c' : '#999'
          return `<span class="badge" style="background:${cor}22;color:${cor}">Set ${s.numero}: ${s.placarCasa}-${s.placarAdversario}</span>`
        }).join('')}
      </div>
    </div>`
}

function cabecalhoHtml(titulo: string, subtitulo: string): string {
  return `
    <div class="header">
      <h1>🏐 ${escapeHtml(titulo)}</h1>
      <p>${escapeHtml(subtitulo)}</p>
    </div>`
}

function secaoScoutEquipeHtml(sets: SetPartida[]): string {
  const equipe = scoutEquipe(sets)
  const fundamentosComDados = FUNDAMENTOS_SCOUT.filter((f) => equipe[f].total > 0)
  if (fundamentosComDados.length === 0) return ''
  return `
    <div class="card">
      <h2>📊 Scout da equipe</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">
        ${fundamentosComDados.map((f) => barrasFundamentoHtml(LABEL_FUNDAMENTO[f], equipe[f])).join('')}
      </div>
    </div>`
}

function secaoAtletasHtml(sets: SetPartida[], atletasDaTurma: Pick<Atleta, 'id' | 'nome'>[]): string {
  const comDados = scoutPorAtleta(sets)
  const idsComDados = new Set(comDados.map((p) => p.atletaId))
  const semDados = atletasDaTurma
    .filter((a) => !idsComDados.has(a.id))
    .map((a) => ({ atletaId: a.id, porFundamento: porFundamentoVazio(), totalGeral: linhaVazia() }))
  const porAtleta = [...comDados, ...semDados]
  if (porAtleta.length === 0) return `<div class="card"><p class="dim" style="font-size:12px">Nenhuma atleta cadastrada nessa turma.</p></div>`
  return porAtleta.map(({ atletaId, porFundamento, totalGeral }) => {
    const atleta = atletasDaTurma.find((a) => a.id === atletaId)
    return `
      <div class="card atleta-card">
        <div class="atleta-head">
          <span class="atleta-nome">${escapeHtml(atleta?.nome ?? 'Atleta removida')}</span>
          <span class="atleta-resumo" style="color:${totalGeral.total === 0 ? '#999' : corEficienciaHex(totalGeral.eficiencia)}">${totalGeral.total} ações${totalGeral.total > 0 ? ` • ${totalGeral.eficiencia}%` : ''}</span>
        </div>
        ${totalGeral.total === 0 ? `<p class="dim" style="font-size:12px">Não entrou em quadra (ou nenhuma ação registrada) neste recorte.</p>` : tabelaAtletaHtml(porFundamento)}
      </div>`
  }).join('')
}

function secaoPontosAdversarioHtml(sets: SetPartida[]): string {
  const pontos = pontosPorFundamentoAdversario(sets)
  const comPonto = FUNDAMENTOS_SCOUT.filter((f) => pontos[f].total > 0).sort((a, b) => pontos[b].total - pontos[a].total)
  if (comPonto.length === 0) return ''
  return `
    <div class="card">
      <h2>🎯 O que o adversário mais acertou</h2>
      ${comPonto.map((f) => {
        const numeros = Object.entries(pontos[f].porNumero).sort((a, b) => b[1] - a[1])
        const detalheNumeros = numeros.length > 0 ? ` — nº ${numeros.map(([n, c]) => `${n} (${c}×)`).join(', ')}` : ''
        return `<div style="display:flex;justify-content:space-between;font-size:12px;border-top:1px solid #232323;padding:6px 0">
          <span style="font-weight:600">${LABEL_FUNDAMENTO[f]}</span>
          <span class="dim">${pontos[f].total} ponto(s)${escapeHtml(detalheNumeros)}</span>
        </div>`
      }).join('')}
    </div>`
}

function secaoErrosAdversarioHtml(sets: SetPartida[]): string {
  const erros = erroPorFundamentoAdversario(sets)
  const comErro = FUNDAMENTOS_SCOUT.filter((f) => erros[f].total > 0).sort((a, b) => erros[b].total - erros[a].total)
  if (comErro.length === 0) return ''
  return `
    <div class="card">
      <h2>🛡️ Erros do adversário</h2>
      ${comErro.map((f) => {
        const numeros = Object.entries(erros[f].porNumero).sort((a, b) => b[1] - a[1])
        const detalheNumeros = numeros.length > 0 ? ` — nº ${numeros.map(([n, c]) => `${n} (${c}×)`).join(', ')}` : ''
        return `<div style="display:flex;justify-content:space-between;font-size:12px;border-top:1px solid #232323;padding:6px 0">
          <span style="font-weight:600">${LABEL_FUNDAMENTO[f]}</span>
          <span class="dim">${erros[f].total} erro(s)${escapeHtml(detalheNumeros)}</span>
        </div>`
      }).join('')}
    </div>`
}

/** Desempenho por posição da ficha (pedido 23/10/2026): em qual posição mais
 *  tomamos ponto (erro nosso) e em qual fomos melhores (mais pontos). Destaca
 *  a melhor e a pior posição (só entre as que tiveram pelo menos uma ação). */
function secaoPorPosicaoHtml(sets: SetPartida[]): string {
  const analise = analisePorPosicaoPartida(sets)
  const comDados = [0, 1, 2, 3, 4, 5].filter((i) => analise[i].pontos > 0 || analise[i].erros > 0)
  if (comDados.length === 0) return ''
  let melhor = comDados[0]
  let pior = comDados[0]
  for (const i of comDados) {
    if (analise[i].pontos - analise[i].erros > analise[melhor].pontos - analise[melhor].erros) melhor = i
    if (analise[i].pontos - analise[i].erros < analise[pior].pontos - analise[pior].erros) pior = i
  }
  const destaques = melhor !== pior
    ? `<span class="pos-destaque" style="background:#2ecc7122;color:#2ecc71">🏆 Melhor: posição ${ROMANO[melhor]}</span><span class="pos-destaque" style="background:#e74c3c22;color:#e74c3c">⚠️ Mais pontos tomados: posição ${ROMANO[pior]}</span>`
    : ''
  return `
    <div class="card">
      <h2>📍 Desempenho por posição</h2>
      ${destaques}
      <div class="pos-grid">
        ${[0, 1, 2, 3, 4, 5].map((i) => `
          <div class="pos-cel">
            <div class="rom">Posição ${ROMANO[i]}</div>
            <div class="nums"><span style="color:#2ecc71">+${analise[i].pontos}</span> / <span style="color:#e74c3c">-${analise[i].erros}</span></div>
          </div>`).join('')}
      </div>
      <p class="dim" style="font-size:11px;margin:4px 0 0">+ = pontos que marcamos com a atleta nessa posição • − = pontos perdidos por erro nosso nessa posição.</p>
    </div>`
}

/** Todas as substituições da partida, set a set, com o placar no momento da
 *  troca (pedido 23/10/2026). */
function secaoSubstituicoesHtml(sets: SetPartida[], atletas: Pick<Atleta, 'id' | 'nome'>[]): string {
  const nomeDe = (id: string | null) => (id ? atletas.find((a) => a.id === id)?.nome ?? 'Atleta removida' : '—')
  const comSubs = sets.map((s) => ({ set: s, subs: listaSubstituicoesDetalhada(s) })).filter((x) => x.subs.length > 0)
  if (comSubs.length === 0) return ''
  return `
    <div class="card">
      <h2>🔁 Substituições</h2>
      ${comSubs.map(({ set, subs }) => `
        <div class="set-titulo">Set ${set.numero}</div>
        ${subs.map((s) => `
          <div class="sub-row">
            <span><strong>${escapeHtml(nomeDe(s.atletaEntraId))}</strong> entrou no lugar de <strong>${escapeHtml(nomeDe(s.atletaSaiId))}</strong> (posição ${ROMANO[s.posicaoIndex]})</span>
            <span class="dim">${s.placarCasaNoMomento} × ${s.placarAdversarioNoMomento}</span>
          </div>`).join('')}
      `).join('')}
    </div>`
}

/** Ponto a ponto de cada set (pedido 23/10/2026) — a sequência completa do
 *  placar, pra reconstruir como o set foi se desenrolando. */
function secaoPontoAPontoHtml(sets: SetPartida[]): string {
  const comPontos = sets.map((s) => ({ set: s, pontos: pontoAPontoDoSet(s) })).filter((x) => x.pontos.length > 0)
  if (comPontos.length === 0) return ''
  return `
    <div class="card">
      <h2>🔢 Ponto a ponto</h2>
      ${comPontos.map(({ set, pontos }) => `
        <div class="set-titulo">Set ${set.numero}</div>
        <div class="seq-wrap">
          ${pontos.map((p) => `<span class="seq-item" style="color:${p.ganhouCasa ? '#2ecc71' : '#e74c3c'}">${p.placarCasa}-${p.placarAdversario}</span>`).join('')}
        </div>
      `).join('')}
    </div>`
}

function paginaHtml(conteudoBody: string, titulo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#000000">
<title>${escapeHtml(titulo)}</title>
<style>${CSS_BASE}</style>
</head>
<body>
<div class="wrap">
<div class="rd-voltar-wrap">
<button class="rd-voltar-btn" onclick="rdVoltar()">‹ Voltar ao app</button>
</div>
${conteudoBody}
<footer>Gerado por RDSports em ${new Date().toLocaleString('pt-BR')}</footer>
</div>
<script>
function rdVoltar(){
  try { window.close() } catch (e) {}
  setTimeout(function () {
    if (!window.closed) {
      if (window.history.length > 1) { window.history.back() }
      else { alert('Pra voltar: feche esta aba ou use o botão de voltar do navegador.') }
    }
  }, 250)
}
</script>
</body>
</html>`
}

/** Relatório completo da partida: placar, scout da equipe por fundamento e a
 *  tabela detalhada de todas as atletas que tiveram ação registrada — mesmo
 *  conteúdo mostrado em `Relatorio.tsx`, mas num arquivo HTML autocontido.
 *  `sets` é o recorte que está sendo exibido no app (geral ou um set
 *  específico), pra o arquivo exportado bater exatamente com o que a pessoa
 *  está vendo na tela — `rotuloRecorte` descreve esse recorte no subtítulo. */
export function gerarHtmlRelatorioPartida(partida: Partida, sets: SetPartida[], atletas: Pick<Atleta, 'id' | 'nome' | 'turmaId' | 'deletedAt'>[], rotuloRecorte: string): string {
  const titulo = `vs ${partida.adversarioNome ?? 'Adversário'}`
  const subtitulo = `${formatDate(partida.data)} • ${resumoFormato(partida)} • ${rotuloRecorte}`
  // Jogo com convocação (11/11/2026): a lista é das convocadas, incluindo
  // reforços de turmas de baixo; sem convocação, a turma inteira.
  const atletasDaTurma = partida.convocadas?.length
    ? atletas.filter((a) => partida.convocadas!.includes(a.id) && !a.deletedAt)
    : atletas.filter((a) => a.turmaId === partida.turmaId && !a.deletedAt)
  const body = `
    ${cabecalhoHtml(titulo, subtitulo)}
    ${placarHtml(partida)}
    ${secaoScoutEquipeHtml(sets)}
    ${secaoPorPosicaoHtml(sets)}
    ${secaoPontosAdversarioHtml(sets)}
    ${secaoErrosAdversarioHtml(sets)}
    ${secaoSubstituicoesHtml(sets, atletasDaTurma)}
    ${secaoPontoAPontoHtml(sets)}
    <div class="card" style="padding-bottom:4px"><h2>👤 Scout por atleta</h2></div>
    ${secaoAtletasHtml(sets, atletasDaTurma)}
  `
  return paginaHtml(body, `RDSports — ${titulo} — ${partida.data}`)
}

/** Relatório individual: mesma partida (ou recorte de sets), mas só com os
 *  dados da atleta escolhida — nunca mostra estatística de colegas (mesma
 *  regra de privacidade das rodadas antigas: "relatório individual por atleta
 *  sem dados de colegas"). */
export function gerarHtmlRelatorioAtleta(partida: Partida, sets: SetPartida[], atleta: Pick<Atleta, 'id' | 'nome'>, rotuloRecorte: string): string {
  const titulo = `${atleta.nome} — vs ${partida.adversarioNome ?? 'Adversário'}`
  const subtitulo = `${formatDate(partida.data)} • ${resumoFormato(partida)} • ${rotuloRecorte}`
  const porAtleta = scoutPorAtleta(sets).find((s) => s.atletaId === atleta.id)
  const body = `
    ${cabecalhoHtml(titulo, subtitulo)}
    ${placarHtml(partida)}
    <div class="card">
      <h2>👤 Scout individual — ${escapeHtml(atleta.nome)}</h2>
      ${porAtleta ? `
        <p class="dim" style="font-size:12px;margin:-4px 0 12px">
          ${porAtleta.totalGeral.total} ações no total •
          <span style="font-weight:700;color:${corEficienciaHex(porAtleta.totalGeral.eficiencia)}">${porAtleta.totalGeral.eficiencia}% de eficiência</span>
        </p>
        ${tabelaAtletaHtml(porAtleta.porFundamento)}
      ` : `<p class="dim" style="font-size:12px">Nenhum evento registrado para esta atleta neste recorte.</p>`}
    </div>
  `
  return paginaHtml(body, `RDSports — ${titulo}`)
}

/** Perfil completo e compartilhável de uma atleta (pedido 23/10/2026): dados
 *  de cadastro, rating por posição e o scout agregado de todas as partidas
 *  finalizadas + a lista de partidas em que ela entrou em quadra. Nunca
 *  mostra o código de acesso ao Portal da Atleta (só o treinador vê isso
 *  dentro do app). */
export function gerarHtmlPerfilAtleta(
  atleta: Pick<Atleta, 'nome' | 'idade' | 'nascimento' | 'alturaCm' | 'posicaoPrincipal' | 'posicaoSecundaria'>,
  scoutAgregado: Record<FundamentoScout, LinhaFundamento>,
  rating: RatingAtleta,
  partidasInfo: Array<{ partida: Partida; totalGeral: LinhaFundamento }>,
): string {
  const titulo = atleta.nome
  const dadosCadastro = [
    atleta.posicaoPrincipal ? LABEL_POSICAO[atleta.posicaoPrincipal] : null,
    (calcularIdade(atleta.nascimento) ?? atleta.idade) ? `${calcularIdade(atleta.nascimento) ?? atleta.idade} anos` : null,
    atleta.nascimento ? `nasc. ${formatarDataBR(atleta.nascimento)}` : null,
    atleta.alturaCm ? `${atleta.alturaCm} cm` : null,
  ].filter(Boolean).join(' • ')
  // Escala 6.0-10.0 (pedido 30/10/2026) — mesmos limiares usados na tela.
  const corRating = rating.rating >= 8 ? '#2ecc71' : rating.rating >= 7 ? '#3498db' : '#e74c3c'
  const rotuloPosicoes = [
    atleta.posicaoPrincipal ? LABEL_POSICAO[atleta.posicaoPrincipal] : null,
    atleta.posicaoSecundaria && atleta.posicaoSecundaria !== atleta.posicaoPrincipal ? LABEL_POSICAO[atleta.posicaoSecundaria] : null,
  ].filter(Boolean).join(' + ')

  const body = `
    ${cabecalhoHtml(titulo, dadosCadastro || 'Perfil da atleta')}

    <div class="card" style="text-align:center">
      <div style="font-size:11px;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Rating ${rotuloPosicoes ? `(${rotuloPosicoes})` : ''}</div>
      <div style="font-size:52px;font-weight:900;letter-spacing:-.02em;color:${corRating}">${rating.rating.toFixed(1)}</div>
      <div style="font-size:12px;color:#999;margin-top:2px">
        ${rating.totalAcoes} ações registradas no total
        ${rating.confianca < 1 ? ` • amostra ainda pequena (confiança ${Math.round(rating.confianca * 100)}%)` : ''}
      </div>
    </div>

    <div class="card">
      <h2>📊 Scout acumulado (todas as partidas)</h2>
      ${rating.totalAcoes > 0 ? tabelaAtletaHtml(scoutAgregado) : '<p class="dim" style="font-size:12px">Nenhuma ação registrada ainda.</p>'}
    </div>

    <div class="card">
      <h2>🏐 Partidas</h2>
      ${partidasInfo.length === 0 ? '<p class="dim" style="font-size:12px">Nenhuma partida finalizada com ações registradas ainda.</p>' : `
        <div style="display:grid;gap:0">
          ${partidasInfo.map(({ partida, totalGeral }) => `
            <div class="sub-row">
              <span>
                <strong>vs ${escapeHtml(partida.adversarioNome ?? 'Adversário')}</strong>
                <span class="dim"> — ${formatDate(partida.data)} — ${partida.setsGanhosCasa}×${partida.setsGanhosAdversario}</span>
              </span>
              <span style="font-weight:700;color:${corEficienciaHex(totalGeral.eficiencia)}">${totalGeral.total} ações • ${totalGeral.eficiencia}%</span>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `
  return paginaHtml(body, `RDSports — Perfil de ${titulo}`)
}

/** Baixa o HTML gerado como um arquivo .html de verdade (autocontido, abre em
 *  qualquer navegador sem precisar do app). */
export function baixarHtml(html: string, nomeArquivo: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** "Baixar PDF": abre o relatório numa aba nova e aciona o diálogo de impressão
 *  nativo do navegador, que em qualquer celular/computador tem a opção "Salvar
 *  como PDF" — sem precisar de nenhuma biblioteca extra de geração de PDF no
 *  app (o bundle já estava sendo avisado como grande demais; esse caminho não
 *  adiciona peso nenhum). O CSS da página já tem uma seção `@media print` pra
 *  ficar bonito tanto na tela quanto impresso/exportado. */
export function abrirParaImprimir(html: string): void {
  const win = window.open('', '_blank')
  if (!win) {
    alert('Não consegui abrir a aba de impressão — verifique se o navegador bloqueou o pop-up e tente de novo.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  const tentarImprimir = () => { win.focus(); win.print() }
  if (win.document.readyState === 'complete') setTimeout(tentarImprimir, 300)
  else win.addEventListener('load', () => setTimeout(tentarImprimir, 300))
}
