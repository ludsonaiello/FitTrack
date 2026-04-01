import { createContext, useCallback, useContext, useRef, useState } from 'react'

const NumericKeyboardContext = createContext(null)

export function NumericKeyboardProvider({ children }) {
  const [state, setState] = useState({
    isOpen: false,
    label: '',
    value: '',
    isLastField: false,
  })

  // Mutable refs for callbacks — avoids stale closures without re-creating functions
  const valueRef = useRef('')
  const isLastRef = useRef(false)
  const cbRef = useRef({ onChange: null, onNext: null, onDone: null })

  const open = useCallback((config) => {
    const val = String(config.value ?? '')
    valueRef.current = val
    isLastRef.current = config.isLastField ?? false
    cbRef.current = {
      onChange: config.onChange ?? null,
      onNext: config.onNext ?? null,
      onDone: config.onDone ?? null,
    }
    setState({
      isOpen: true,
      label: config.label ?? '',
      value: val,
      isLastField: isLastRef.current,
    })
  }, [])

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }))
  }, [])

  const append = useCallback((char) => {
    const newVal = valueRef.current + char
    valueRef.current = newVal
    setState(prev => ({ ...prev, value: newVal }))
    cbRef.current.onChange?.(newVal)
  }, [])

  const backspace = useCallback(() => {
    const newVal = valueRef.current.slice(0, -1)
    valueRef.current = newVal
    setState(prev => ({ ...prev, value: newVal }))
    cbRef.current.onChange?.(newVal)
  }, [])

  const confirm = useCallback(() => {
    if (isLastRef.current) {
      cbRef.current.onDone?.()
      setState(prev => ({ ...prev, isOpen: false }))
    } else {
      cbRef.current.onNext?.()
    }
  }, [])

  return (
    <NumericKeyboardContext.Provider value={{ state, open, close, append, backspace, confirm }}>
      {children}
    </NumericKeyboardContext.Provider>
  )
}

export function useNumericKeyboard() {
  return useContext(NumericKeyboardContext)
}
