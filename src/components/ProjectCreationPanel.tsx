import { useEffect, useRef } from 'react'
import type { Folder, MaterialType } from '../types'

type ProjectCreationPanelProps = {
  folders: Folder[]
  isOpen: boolean
  onClose: () => void
  onCreate: (payload: {
    type: MaterialType
    title: string
    sourceValue: string
    folderId?: string
    fileName?: string
  }) => void
}

function suggestTitle(type: MaterialType, sourceValue: string, fileName?: string) {
  if (type === 'youtube') {
    return sourceValue.trim() || 'Новый YouTube проект'
  }

  if (fileName?.trim()) {
    return fileName.replace(/\.txt$/i, '').trim()
  }

  const compact = sourceValue.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return 'Новый текстовый проект'
  }

  return compact.slice(0, 64)
}

export default function ProjectCreationPanel({
  folders,
  isOpen,
  onClose,
  onCreate,
}: ProjectCreationPanelProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }

    if (isOpen && !dialog.open) {
      dialog.showModal()
    }

    if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const type = (formData.get('type') as MaterialType | null) ?? 'youtube'
    const sourceValue = String(formData.get('sourceValue') ?? '')
    const folderId = String(formData.get('folderId') ?? '').trim() || undefined
    const fileInput = event.currentTarget.elements.namedItem('txtFile') as HTMLInputElement | null
    const file = fileInput?.files?.[0]
    const titleInput = String(formData.get('title') ?? '').trim()
    const fileName = file?.name

    if (type === 'text' && file) {
      const reader = new FileReader()
      reader.onload = () => {
        onCreate({
          type,
          title: titleInput || suggestTitle(type, String(reader.result ?? ''), fileName),
          sourceValue: String(reader.result ?? ''),
          folderId,
          fileName,
        })
      }
      reader.readAsText(file, 'utf-8')
      onClose()
      return
    }

    onCreate({
      type,
      title: titleInput || suggestTitle(type, sourceValue, fileName),
      sourceValue,
      folderId,
      fileName,
    })
    onClose()
  }

  return (
    <dialog ref={dialogRef} className="project-creation-dialog" onClose={onClose}>
      <form ref={formRef} className="project-creation-panel" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Новый проект</p>
            <h2>Добавьте первый материал</h2>
            <p className="panel-description">
              По умолчанию проект создаётся из одного материала, а набор создаётся
              автоматически. Папка остаётся в `Дополнительно`.
            </p>
          </div>
          <button type="button" className="ghost-button ghost-button--compact" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <label className="field">
          <span>Тип материала</span>
          <select name="type" className="field-input" defaultValue="youtube">
            <option value="youtube">YouTube видео</option>
            <option value="text">Текст / TXT</option>
          </select>
        </label>

        <label className="field">
          <span>Источник</span>
          <textarea
            name="sourceValue"
            rows={5}
            placeholder="YouTube URL или вставьте текст..."
          />
        </label>

        <label className="field">
          <span>TXT файл</span>
          <input name="txtFile" type="file" className="field-input" accept=".txt,text/plain" />
        </label>

        <label className="field">
          <span>Название проекта</span>
          <input name="title" type="text" className="field-input" placeholder="По умолчанию будет взято из материала" />
        </label>

        <details className="context-scene-section">
          <summary className="context-scene-summary">
            <span className="context-scene-summary-title">Дополнительно</span>
            <span className="context-scene-summary-copy">Папка и базовая организация</span>
          </summary>

          <label className="field">
            <span>Папка</span>
            <select name="folderId" className="field-input" defaultValue="">
              <option value="">Без папки</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
        </details>

        <div className="editor-submit-row">
          <button type="submit" className="primary-button">
            Создать проект
          </button>
        </div>
      </form>
    </dialog>
  )
}
