import { useMemo, useRef, useState } from 'react'
import type { Material } from '../types'

type TextMaterialReaderPanelProps = {
  material: Material
  onCreateCardFromSelection: (selection: {
    text: string
    start: number
    end: number
    before: string
    after: string
  }) => Promise<void>
  onProgressChange: (offset: number) => void
}

function trimContext(text: string, maxLength = 160) {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) {
    return compact
  }

  return compact.slice(0, maxLength).trim()
}

export default function TextMaterialReaderPanel({
  material,
  onCreateCardFromSelection,
  onProgressChange,
}: TextMaterialReaderPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const textContent = material.textContent ?? ''

  const selectedText = useMemo(() => {
    if (selectionStart == null || selectionEnd == null || selectionEnd <= selectionStart) {
      return ''
    }

    return textContent.slice(selectionStart, selectionEnd).trim()
  }, [selectionEnd, selectionStart, textContent])

  function captureSelection() {
    const element = textareaRef.current
    if (!element) {
      return
    }

    const start = element.selectionStart
    const end = element.selectionEnd
    setSelectionStart(start)
    setSelectionEnd(end)
    onProgressChange(start)
  }

  async function handleCreateCard() {
    if (!selectedText || selectionStart == null || selectionEnd == null) {
      return
    }

    setIsCreating(true)

    try {
      await onCreateCardFromSelection({
        text: selectedText,
        start: selectionStart,
        end: selectionEnd,
        before: trimContext(textContent.slice(Math.max(0, selectionStart - 220), selectionStart)),
        after: trimContext(textContent.slice(selectionEnd, Math.min(textContent.length, selectionEnd + 220))),
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <section className="text-reader-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Текст</p>
          <h2>{material.title}</h2>
          <p className="panel-description">
            Выделите слово или фразу прямо в тексте, затем отправьте выделение в
            редактор карточки на проверку перед сохранением.
          </p>
        </div>
      </div>

      <div className="text-reader-toolbar">
        <span className="context-chip">Text</span>
        <button
          type="button"
          className="primary-button"
          onClick={() => void handleCreateCard()}
          disabled={!selectedText || isCreating}
        >
          {isCreating ? 'Подготовка...' : 'Сделать карточку из выделения'}
        </button>
      </div>

      <textarea
        ref={textareaRef}
        className="text-reader-content"
        value={textContent}
        readOnly
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
      />

      <div className="text-reader-selection">
        <span className="text-reader-selection-label">Текущее выделение</span>
        <p>{selectedText || 'Пока ничего не выбрано.'}</p>
      </div>
    </section>
  )
}
