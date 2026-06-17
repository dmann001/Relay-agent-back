import { redirect } from "next/navigation"

export default async function SettingsIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string") qs.set(key, value)
    else if (Array.isArray(value)) value.forEach((item) => qs.append(key, item))
  })

  const hasConnectionCallback =
    params.error ||
    params.calendarConnected ||
    params.calendarError ||
    params.provider

  const target = hasConnectionCallback ? "/settings/connections" : "/settings/profile"
  const query = qs.toString()

  redirect(query ? `${target}?${query}` : target)
}
