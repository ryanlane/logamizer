import styles from "./Stepper.module.css";

export type Step = {
  id: string;
  title: string;
  description: string;
};

type Props = {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
};

export function Stepper({ steps, currentStep, onStepClick }: Props) {
  return (
    <div className={styles.stepper}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = onStepClick && index <= currentStep;

        return (
          <div key={step.id} className={styles.stepWrapper}>
            <button
              type="button"
              className={`${styles.step} ${isCompleted ? styles.completed : ""} ${isCurrent ? styles.current : ""}`}
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
            >
              <div className={styles.indicator}>
                {isCompleted ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13.5 4.5L6 12L2.5 8.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className={styles.content}>
                <div className={styles.title}>{step.title}</div>
                <div className={styles.description}>{step.description}</div>
              </div>
            </button>
            {index < steps.length - 1 && <div className={`${styles.connector} ${isCompleted ? styles.completed : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}
