import { Folder, Globe } from '@gravity-ui/icons'
import { Tabs } from '@heroui/react'

import Categorys from './components/categorys'
import Websites from './components/websites'

function Admin() {
  return (
    <Tabs>
      <Tabs.ListContainer>
        <Tabs.List aria-label="后台管理">
          <Tabs.Tab id="categorys" className="flex items-center gap-1">
            <Folder />
            网站分类
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="websites" className="flex items-center gap-1">
            <Globe />
            网站列表
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="categorys"><Categorys /></Tabs.Panel>
      <Tabs.Panel id="websites"><Websites /></Tabs.Panel>
    </Tabs>
  )
}
export default Admin
