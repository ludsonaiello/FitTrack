export const WHO_BANDS = [
  { label: 'Underweight', min: 0,    max: 18.5, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { label: 'Normal',      min: 18.5, max: 25,   color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  { label: 'Overweight',  min: 25,   max: 30,   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { label: 'Obese I',     min: 30,   max: 35,   color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  { label: 'Obese II',    min: 35,   max: 40,   color: '#dc2626', bg: 'rgba(220,38,38,0.12)'  },
  { label: 'Obese III',   min: 40,   max: 60,   color: '#991b1b', bg: 'rgba(153,27,27,0.12)'  },
]

/** BMI = kg / m² — returns null if inputs invalid */
export function calculateBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

/** Returns the WHO band object for a given BMI */
export function classifyBmi(bmi) {
  if (bmi === null || bmi === undefined) return null
  return WHO_BANDS.find(b => bmi >= b.min && bmi < b.max) ?? WHO_BANDS[WHO_BANDS.length - 1]
}

/** Convert cm to { feet, inches } for display */
export function cmToFtIn(cm) {
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return { feet, inches }
}

/** Convert feet + inches to cm */
export function ftInToCm(feet, inches) {
  return Math.round((Number(feet) * 30.48 + Number(inches) * 2.54) * 10) / 10
}
