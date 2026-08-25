"use client"

import { useEffect, useRef, useState } from "react"

interface OrbProps {
  className?: string
  size?: number
  color?: string
  speed?: number
}

export function Orb({ className, size = 300, color = "#6E28FF", speed = 1 }: OrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let time = 0
    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      opacity: number
      hue: number
    }> = []

    const numParticles = 60

    function initParticles() {
      particles.length = 0
      for (let i = 0; i < numParticles; i++) {
        const angle = (Math.PI * 2 * i) / numParticles
        const radius = (size / 2) * (0.3 + Math.random() * 0.4)
        particles.push({
          x: 0,
          y: 0,
          vx: Math.cos(angle) * (0.5 + Math.random() * 0.5),
          vy: Math.sin(angle) * (0.5 + Math.random() * 0.5),
          radius: 1 + Math.random() * 3,
          opacity: 0.3 + Math.random() * 0.5,
          hue: 270 + Math.random() * 60,
        })
      }
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas!.width = size * dpr
      canvas!.height = size * dpr
      canvas!.style.width = `${size}px`
      canvas!.style.height = `${size}px`
      ctx!.scale(dpr, dpr)
    }

    function animate() {
      time += 0.01 * speed
      ctx!.clearRect(0, 0, size, size)

      const centerX = size / 2
      const centerY = size / 2

      // Draw outer glow rings
      for (let i = 3; i >= 0; i--) {
        const ringRadius = (size / 2) * (0.4 + i * 0.15)
        const gradient = ctx!.createRadialGradient(
          centerX, centerY, ringRadius * 0.3,
          centerX, centerY, ringRadius
        )
        gradient.addColorStop(0, `hsla(270, 100%, 60%, ${0.05 * (i + 1)})`)
        gradient.addColorStop(0.5, `hsla(290, 100%, 50%, ${0.03 * (i + 1)})`)
        gradient.addColorStop(1, "hsla(270, 100%, 40%, 0)")
        ctx!.beginPath()
        ctx!.arc(centerX, centerY, ringRadius, 0, Math.PI * 2)
        ctx!.fillStyle = gradient
        ctx!.fill()
      }

      // Draw pulsing core
      const corePulse = Math.sin(time * 2) * 0.15 + 0.85
      const coreRadius = (size / 2) * 0.15 * corePulse
      const coreGradient = ctx!.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreRadius
      )
      coreGradient.addColorStop(0, "hsla(270, 100%, 70%, 0.9)")
      coreGradient.addColorStop(0.5, "hsla(290, 100%, 60%, 0.6)")
      coreGradient.addColorStop(1, "hsla(310, 100%, 50%, 0)")
      ctx!.beginPath()
      ctx!.arc(centerX, centerY, coreRadius, 0, Math.PI * 2)
      ctx!.fillStyle = coreGradient
      ctx!.fill()

      // Update and draw particles
      particles.forEach((p, i) => {
        const angle = (Math.PI * 2 * i) / numParticles + time * 0.3
        const orbitRadius = (size / 2) * (0.35 + Math.sin(time + i * 0.5) * 0.1)
        
        p.x = centerX + Math.cos(angle) * orbitRadius
        p.y = centerY + Math.sin(angle) * orbitRadius
        p.opacity = 0.2 + Math.sin(time * 3 + i) * 0.3

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx!.fillStyle = `hsla(${p.hue}, 100%, 60%, ${p.opacity})`
        ctx!.fill()
      })

      // Draw connecting lines between nearby particles
      ctx!.strokeStyle = `hsla(280, 100%, 60%, 0.08)`
      ctx!.lineWidth = 0.5
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < size * 0.25) {
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.stroke()
          }
        }
      }

      // Draw orbiting rings
      for (let i = 0; i < 3; i++) {
        const ringRadius = (size / 2) * (0.55 + i * 0.1)
        const ringRotation = time * (0.5 + i * 0.3) * (i % 2 === 0 ? 1 : -1)
        ctx!.save()
        ctx!.translate(centerX, centerY)
        ctx!.rotate(ringRotation)
        ctx!.beginPath()
        ctx!.arc(0, 0, ringRadius, 0, Math.PI * 2)
        ctx!.strokeStyle = `hsla(${270 + i * 20}, 100%, 60%, ${0.15 - i * 0.03})`
        ctx!.lineWidth = 1
        ctx!.stroke()
        ctx!.restore()
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    resize()
    initParticles()
    animate()

    window.addEventListener("resize", resize)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener("resize", resize)
    }
  }, [size, color, speed])

  if (!mounted) {
    return (
      <div 
        className={`relative ${className || ""}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6E28FF] to-[#BE46FF] opacity-20 blur-[60px]" />
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className={className || ""}
      width={size}
      height={size}
      aria-hidden="true"
    />
  )
}