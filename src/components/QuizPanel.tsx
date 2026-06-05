import type { Card } from '../types'

type QuizState = {
  questionCard: Card
  options: string[]
  answered: boolean
  selectedAnswer: string | null
}

type QuizPanelProps = {
  quiz: QuizState
  quizScore: {
    correct: number
    total: number
  }
  onAnswer: (answer: string) => void
  onNextQuestion: () => void
  onStop: () => void
}

export default function QuizPanel({
  quiz,
  quizScore,
  onAnswer,
  onNextQuestion,
  onStop,
}: QuizPanelProps) {
  return (
    <section className="quiz-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Тест</p>
          <h2>Выберите правильный перевод</h2>
        </div>
        <div className="quiz-score">
          <span>Счёт: {quizScore.correct}/{quizScore.total}</span>
        </div>
      </div>

      <div className="quiz-question">
        <span className="quiz-question-label">Русский</span>
        <p className="quiz-question-text">{quiz.questionCard.russian}</p>
        {quiz.questionCard.imageUrl ? (
          <img
            className="quiz-question-image"
            src={quiz.questionCard.imageUrl}
            alt=""
          />
        ) : null}
      </div>

      <div className="quiz-options">
        {quiz.options.map((option) => {
          let optionClass = 'quiz-option'
          if (quiz.answered) {
            if (option === quiz.questionCard.english) {
              optionClass += ' is-correct'
            } else if (option === quiz.selectedAnswer) {
              optionClass += ' is-wrong'
            }
          }

          return (
            <button
              key={option}
              type="button"
              className={optionClass}
              onClick={() => onAnswer(option)}
              disabled={quiz.answered}
            >
              {option}
            </button>
          )
        })}
      </div>

      {quiz.answered ? (
        <div className="quiz-feedback">
          {quiz.selectedAnswer === quiz.questionCard.english ? (
            <p className="quiz-feedback-correct">✅ Верно!</p>
          ) : (
            <p className="quiz-feedback-wrong">
              ❌ Неверно. Правильный ответ: <strong>{quiz.questionCard.english}</strong>
            </p>
          )}
        </div>
      ) : null}

      <div className="quiz-actions">
        {quiz.answered ? (
          <button
            type="button"
            className="primary-button"
            onClick={onNextQuestion}
          >
            Следующий вопрос →
          </button>
        ) : null}
        <button
          type="button"
          className="ghost-button"
          onClick={onStop}
        >
          Завершить тест
        </button>
      </div>
    </section>
  )
}
