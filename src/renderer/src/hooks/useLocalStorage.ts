/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'

const useLocalStorage = <T>(
  key: string,
  initialValue: T,
  value: T,
  setValue: React.Dispatch<React.SetStateAction<T>>
): void => {
  const [init, setInit] = useState(false)

  useEffect(() => {
    if (!init) return
    const data = JSON.stringify(value)
    console.log('save', key, data)
    localStorage.setItem(key, data)
  }, [value, init])

  useEffect(() => {
    const item = localStorage.getItem(key)
    console.log('restore', key, item)
    if (item) {
      try {
        setValue(JSON.parse(item))
      } catch (error) {
        console.error('Error parsing localStorage item:', error)
        setValue(initialValue)
      }
    } else {
      setValue(initialValue)
    }
    setInit(true)
  }, [])
}

export default useLocalStorage
