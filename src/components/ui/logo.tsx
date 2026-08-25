import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function Logo({ className, size = "md" }: LogoProps) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const effectiveTheme = mounted ? theme : "dark"
  const isDark = effectiveTheme === "dark" || (effectiveTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const sizeClasses = {
    sm: "h-6 w-auto",
    md: "h-8 w-auto",
    lg: "h-10 w-auto",
  }

  const logoSrc = isDark
    ? "/Astra Black Logo Color White_Clear.png"
    : "/Astra Black Logo Color WBG_Clear.png"

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={logoSrc}
        alt="Astra Black logo"
        className={cn(sizeClasses[size], "rounded-md")}
      />
    </div>
  )
}