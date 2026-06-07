import Image from 'next/image'

type CollectraLogoProps = {
  className?: string
  width?: number
  height?: number
  priority?: boolean
}

export function CollectraLogo({
  className = 'h-14 w-auto object-contain',
  width = 220,
  height = 220,
  priority = false,
}: CollectraLogoProps) {
  return (
    <Image
      src="/logo-collectra-02.png"
      alt="Collectra logo"
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized
    />
  )
}
