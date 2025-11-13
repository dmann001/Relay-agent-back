import { Mail } from "lucide-react"

interface ProviderIconProps {
  provider: "gmail" | "outlook"
  className?: string
}

export function ProviderIcon({ provider, className }: ProviderIconProps) {
  if (provider === "gmail") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.366l8.073-5.873C21.69 2.28 24 3.434 24 5.457z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (provider === "outlook") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M24 7.387v9.226c0 .792-.641 1.433-1.433 1.433h-7.621v4.521h-1.892v-4.521H5.433A1.433 1.433 0 0 1 4 16.613V7.387c0-.792.641-1.433 1.433-1.433h7.621V1.433h1.892v4.521h7.621c.792 0 1.433.641 1.433 1.433z"
          fill="currentColor"
        />
        <path
          d="M12 8.5c-1.933 0-3.5 1.567-3.5 3.5s1.567 3.5 3.5 3.5 3.5-1.567 3.5-3.5-1.567-3.5-3.5-3.5z"
          fill="currentColor"
        />
      </svg>
    )
  }

  return <Mail className={className} />
}
