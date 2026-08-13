import { toast } from "sonner"

type MutationFeedback = {
  loading: string
  success: string
  error: string | ((error: unknown) => string)
}

function withMutationFeedback<T>(
  mutation: Promise<T> | (() => Promise<T>),
  feedback: MutationFeedback,
) {
  return toast.promise(mutation, {
    loading: feedback.loading,
    success: feedback.success,
    error: feedback.error,
  })
}

export { withMutationFeedback, type MutationFeedback }
