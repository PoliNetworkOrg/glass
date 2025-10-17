import { Canvas } from "@react-three/fiber"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { Mesh, Texture } from "three"
import { useGlass } from "./context"
import { GlassMesh } from "./mesh"
import type { GlassOptions } from "./types/glass"
import { type ElementRect, getElementRect } from "./utils/dimensions"

export type GlassProps = {
  children: React.ReactNode
  options: Partial<GlassOptions>
  reducedMotion?: boolean
}

function Glass3D(props: { texture: Texture }) {
  const plane = useRef<Mesh>(null)
  const canv = useRef<HTMLCanvasElement>(null)

  const [bounds, setBounds] = useState<ElementRect>({
    top: 0,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    right: window.innerWidth,
    bottom: window.innerHeight,
  })
  const { width, height } = bounds

  useLayoutEffect(() => {
    if (canv.current?.parentElement) {
      setBounds(getElementRect(canv.current.parentElement))
    }
  }, [canv.current])

  useEffect(() => {
    function onScroll() {
      const rect = canv.current ? getElementRect(canv.current) : bounds
      if (plane.current) {
        const x = rect.left + rect.width / 2 - props.texture.width / 2
        const y = -(rect.top + rect.height / 2 - props.texture.height / 2)
        plane.current.position.setComponent(0, -x)
        plane.current.position.setComponent(1, -y)
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
    }
  }, [canv.current, plane.current, bounds])

  return (
    <Canvas
      orthographic
      camera={{
        position: [0, 0, 512],
        left: -width / 2,
        right: width / 2,
        top: height / 2,
        bottom: -height / 2,
        near: 0.01,
        far: 2048,
      }}
      ref={canv}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <pointLight position={[100, 0, 10]} intensity={1} color={0xff0000} />
      <GlassMesh dimensions={[width, height, 10]} />
      <mesh ref={plane} position={[0, 0, -10]}>
        <planeGeometry args={[props.texture.width, props.texture.height]} />
        <meshBasicMaterial map={props.texture} toneMapped={false} />
      </mesh>
    </Canvas>
  )
}

function GlassFallback() {
  return (
    <div
      glass-ignore=""
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        backdropFilter: "blur(4px)",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
      }}
    />
  )
}

export function Glass(props: GlassProps) {
  // const { options } = props
  const { texture } = useGlass()

  const do3D = !!texture && !props.reducedMotion

  return (
    <div
      glass-ignore=""
      style={{
        display: "flex",
        position: "relative",
        zIndex: 1,
        flex: 1,
      }}
    >
      {do3D ? <Glass3D texture={texture} /> : <GlassFallback />}
      {props.children}
    </div>
  )
}
