interface ProviderIconProps {
  className?: string
  provider?: "gmail" | "outlook"
}

export function ProviderIcon({ className, provider = "gmail" }: ProviderIconProps) {
  if (provider === "outlook") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M2 4.5 14 2v20L2 19.5V4.5Zm13 2h7v11h-7v-2h5V8.5h-5v-2Zm1 3h3v5h-3v-5ZM5.2 9.1c-1.5 0-2.4 1.2-2.4 3s.9 3 2.4 3 2.4-1.2 2.4-3-.9-3-2.4-3Zm0 1.4c.5 0 .8.6.8 1.6s-.3 1.6-.8 1.6-.8-.6-.8-1.6.3-1.6.8-1.6Z" />
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.366l8.073-5.873C21.69 2.28 24 3.434 24 5.457z"
        fill="currentColor"
      />
    </svg>
  )
}
