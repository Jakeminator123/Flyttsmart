function luhnCheck(nineDigits: string): number {
  let total = 0
  for (let i = 0; i < nineDigits.length; i += 1) {
    let digit = Number(nineDigits[i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    total += digit
  }
  return (10 - (total % 10)) % 10
}

export function normalizePersonalNumber(rawValue: string): string | null {
  const raw = rawValue.trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, "")
  let separator: "-" | "+" = "-"
  if (raw.includes("+")) separator = "+"

  let normalized = digits
  if (digits.length === 10) {
    const yearPart = Number(digits.slice(0, 2))
    const now = new Date()
    const currentCentury = Math.floor(now.getFullYear() / 100)
    const currentYear = now.getFullYear() % 100

    let fullYear = currentCentury * 100 + yearPart
    if (separator === "+") {
      fullYear -= 100
    } else if (yearPart > currentYear) {
      fullYear -= 100
    }

    normalized = `${String(fullYear).padStart(4, "0")}${digits.slice(2)}`
  }

  if (!/^\d{12}$/.test(normalized)) return null

  const yyyy = Number(normalized.slice(0, 4))
  const mm = Number(normalized.slice(4, 6))
  const dd = Number(normalized.slice(6, 8))
  const candidate = new Date(yyyy, mm - 1, dd)
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getFullYear() !== yyyy ||
    candidate.getMonth() !== mm - 1 ||
    candidate.getDate() !== dd
  ) {
    return null
  }

  const lastTen = normalized.slice(2)
  if (luhnCheck(lastTen.slice(0, 9)) !== Number(lastTen[9])) {
    return null
  }

  return `${normalized.slice(0, 8)}-${normalized.slice(8)}`
}

export function isPersonalNumberLike(rawValue: string): boolean {
  return normalizePersonalNumber(rawValue) !== null
}
