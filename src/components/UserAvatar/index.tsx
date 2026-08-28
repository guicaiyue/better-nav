'use client'
import { useRouter } from '@bprogress/next/app'
import { GearDot } from '@gravity-ui/icons'
import { Button, Tooltip } from '@heroui/react'

export default function UserAvatar() {
  const router = useRouter()
  return (
    <Tooltip>
      <Button aria-label="管理后台" size="sm" variant="ghost" isIconOnly onPress={() => router.push('/admin')}><GearDot /></Button>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        管理后台
      </Tooltip.Content>
    </Tooltip>
  )
}
