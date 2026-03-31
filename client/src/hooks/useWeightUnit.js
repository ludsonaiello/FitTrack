import { useState, useCallback } from 'react'

const KEY = 'ft_weight_unit'

export function getWeightUnit() {
  return localStorage.getItem(KEY) || 'kg'
}

export function saveWeightUnit(unit) {
  localStorage.setItem(KEY, unit)
}

/** Convert a stored-kg value to display value in user's unit */
export function toDisplay(kg, unit) {
  if (kg == null || kg === '') return ''
  const n = parseFloat(kg)
  if (isNaN(n)) return ''
  if (unit === 'lbs') return Math.round(n * 2.2046 * 10) / 10
  return n
}

/** Convert a user-entered display value back to kg for storage */
export function toKg(val, unit) {
  if (val == null || val === '') return null
  const n = parseFloat(val)
  if (isNaN(n)) return null
  if (unit === 'lbs') return Math.round((n / 2.2046) * 100) / 100
  return n
}

export function useWeightUnit() {
  const [unit, setUnit] = useState(getWeightUnit)

  const update = useCallback((u) => {
    saveWeightUnit(u)
    setUnit(u)
  }, [])

  return [unit, update]
}
