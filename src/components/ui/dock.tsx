import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

type DockContextValue = {
  mouseX: number | null
  magnification: number
  distance: number
  baseSize: number
  origin: string
}

const DockContext = createContext<DockContextValue | null>(null)

function useDock() {
  const ctx = useContext(DockContext)
  if (!ctx) throw new Error("DockIcon must be used within Dock")
  return ctx
}

type DockProps = {
  children: ReactNode
  className?: string
  magnification?: number
  distance?: number
  iconSize?: number
  direction?: "top" | "middle" | "bottom"
}

/**
 * MacOS-style dock — fixed shell; icons scale via transform only.
 */
export function Dock({
  children,
  className,
  magnification = 0.55,
  distance = 120,
  iconSize = 44,
  direction = "middle",
}: DockProps) {
  const [mouseX, setMouseX] = useState<number | null>(null)

  const onMove = useCallback((e: React.MouseEvent) => {
    setMouseX(e.clientX)
  }, [])

  const onLeave = useCallback(() => setMouseX(null), [])

  const origin =
    direction === "top" ? "top center" : direction === "bottom" ? "bottom center" : "center"

  const value = useMemo(
    () => ({
      mouseX,
      magnification,
      distance,
      baseSize: iconSize,
      origin,
    }),
    [mouseX, magnification, distance, iconSize, origin],
  )

  return (
    <DockContext.Provider value={value}>
      <div
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={cn(
          "supports-backdrop-filter:bg-background/75 relative mx-auto flex h-[64px] w-max items-end gap-2 overflow-visible rounded-2xl border border-border/60 bg-background/85 px-3 py-2 shadow-lg backdrop-blur-xl transition-colors duration-200 hover:border-white",
          direction === "top" && "items-start",
          direction === "middle" && "items-center",
          direction === "bottom" && "items-end",
          className,
        )}
      >
        {children}
      </div>
    </DockContext.Provider>
  )
}

type DockIconProps = {
  children: ReactNode
  className?: string
}

export function DockIcon({ children, className }: DockIconProps) {
  const { mouseX, magnification, distance, baseSize, origin } = useDock()
  const ref = useRef<HTMLDivElement>(null)

  let displayScale = 1
  if (mouseX != null && ref.current) {
    const rect = ref.current.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    const dist = Math.abs(mouseX - center)
    if (dist < distance) {
      const t = 1 - dist / distance
      displayScale = 1 + magnification * Math.sin((t * Math.PI) / 2)
    }
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative z-10 flex shrink-0 cursor-pointer items-center justify-center overflow-visible rounded-full p-2.5 transition-transform duration-75 ease-out will-change-transform",
        className,
      )}
      style={
        {
          width: baseSize,
          height: baseSize,
          transform: `scale(${displayScale})`,
          transformOrigin: origin,
        } as CSSProperties
      }
    >
      <div className="flex size-full items-center justify-center rounded-full">{children}</div>
    </div>
  )
}
