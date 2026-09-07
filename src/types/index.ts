/** @description: 网站分类 */
export type Category = Columns & {
  name: string // 分类名称
  websites: Website[] // 网站列表
}

/** @description: 公共列 */
export interface Columns {
  id: string // 主键
  user_id: string // 登录用户 id
  emial: string // 邮箱
  sort: number // 排序
  created_at: string // 创建时间
  updated_at: string // 更新时间
}

/** @description: 响应体 */
export interface IResponse<T = unknown> {
  code: number // 状态码
  data: T // 数据
  msg: string // 消息
  timestamp: number // 时间戳
}

/** @description: 网站列表 */
export type Website = Columns & {
  name: string // 分类名称
  desc: string | null // 描述
  logo: string | null // logo
  url: string // 链接
  tags: string[] // 站点标签
  metadata: Record<string, unknown> // n8n 分类、内容分析与来源元数据
  pinned: boolean // 是否置顶
  recommend: boolean // 是否推荐
  vpn: boolean // 是否需要 vpn
  visitCount: number // 访问次数
  commonlyUsed: boolean // 是否常用
  archived_at: string | null // 归档时间，非空表示已下线
  category_id: string // 分类 id
  category?: Category
  category_name?: string
}
