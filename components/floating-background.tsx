"use client"

/**
 * Subtle animated background overlay with floating blurred shapes and a dot
 * grid. Sits ON TOP of page content at very low opacity so it creates a soft,
 * ambient "living" feel without blocking interaction.
 */
export function FloatingBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden="true"
    >
      {/* Subtle dot grid */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Floating blurred blobs — slow, ambient movement */}
      <div className="absolute top-[8%] left-[3%] h-80 w-80 rounded-full bg-primary/10 animate-float blur-[120px]" />
      <div className="absolute top-[35%] right-[5%] h-96 w-96 rounded-full bg-accent/15 animate-float-delayed blur-[140px]" />
      <div className="absolute bottom-[15%] left-[35%] h-72 w-72 rounded-full bg-primary/8 animate-float blur-[100px]" />
      <div className="absolute top-[60%] left-[8%] h-56 w-56 rounded-full bg-accent/10 animate-float-delayed blur-[100px]" />
      <div className="absolute top-[15%] right-[30%] h-64 w-64 rounded-full bg-primary/8 animate-float blur-[110px]" />
    </div>
  )
}
