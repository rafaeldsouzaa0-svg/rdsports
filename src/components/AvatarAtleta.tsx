// Círculo da atleta (visual "Álbum", 21/11/2026): foto quando tiver, senão as
// iniciais do nome. `ouro` coloca o anel dourado de destaque.
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export default function AvatarAtleta({ nome, fotoUrl, tamanho = 44, ouro = false }: { nome: string; fotoUrl?: string; tamanho?: number; ouro?: boolean }) {
  return (
    <span
      className={`rd-avatar ${ouro ? 'rd-avatar-ouro' : ''}`}
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.32), borderWidth: tamanho >= 64 ? 3 : 2 }}
    >
      {fotoUrl ? <img src={fotoUrl} alt={nome} /> : iniciais(nome)}
    </span>
  )
}
