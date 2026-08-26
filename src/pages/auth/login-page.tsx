import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { SignInPage, Testimonial } from "@/components/ui/sign-in"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { signup } from "@/lib/api/agency"

const testimonials: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg",
    name: "Sarah Chen",
    handle: "@sarahdigital",
    text: "Amazing platform! The user experience is seamless and the features are exactly what I needed.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",
    name: "Marcus Johnson",
    handle: "@marcustech",
    text: "This service has transformed how I work. Clean design, powerful features, and excellent support.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "David Martinez",
    handle: "@davidcreates",
    text: "I've tried many platforms, but this one stands out. Intuitive, reliable, and genuinely helpful for productivity.",
  },
]

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      await login(email, password)
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in")
    } finally {
      setPending(false)
    }
  }

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    const name = (formData.get("name") as string)?.trim()
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!name) {
      setError("Please enter your name")
      setPending(false)
      return
    }

    try {
      await signup(name, email, password)
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create account")
    } finally {
      setPending(false)
    }
  }

  return (
    <SignInPage
      heroImageSrc="/astra_portal.jpeg"
      testimonials={testimonials}
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onGoogleSignIn={() => {}}
      onResetPassword={() => {}}
      error={error}
      pending={pending}
    />
  )
}
