# 年付整数价格与签到摘要（2026-10-10）

## Change Summary

新购年付按月价 × 12 × 90% 四舍五入至整数元，四档分别为 529、1069、2149、7549 元。套餐列表、报价及下单共用服务端计算后的金额，不能仅在界面隐藏小数。

## Endpoint Details

- `GET /api/plans`：公开、无请求体，套餐字段 `annualPrice` 返回整数金额，如 `{"code":0,"message":"success","data":[{"id":3,"name":"advanced","monthlyPrice":99,"annualPrice":1069}]}`（省略其他字段）。
- `POST /api/payment/quote`：请求中的 `target` 为 `{"orderType":"subscription","planId":3,"billingPeriod":"annual"}`；新购报价中的 `amount` 为 1069，12个月原价 `originalAmount` 为 1188。
- `POST /api/subscription/create`：请求为 `{"planId":3,"billingPeriod":"annual","paymentChannel":"dual"}`；新购订单保存相同的 1069 元金额。

年付升级仍按剩余权益月数（不含当月）× 月价差 × 90% 补款。历史订单及退款结算仍使用原订单金额。

## Frontend Action Items

如展示年付套餐或发起年付支付，使用接口 `annualPrice`，保持界面价格和服务端报价一致。当前请求仅修改 Portal 套餐卡，Electron 无需修改已有签到交互。

同类签到摘要可使用“累计签到30天可得3,000积分”。Portal 已在月付和年付付费卡的加赠积分下方加入此行，使用礼物图标，普通卡青色、推荐卡橙色。

## Auth Requirements

套餐列表无需登录。报价和购买接口沿用 `Authorization: Bearer <accessToken>`；Cookie/session 兼容调用保持不变，无新增权限。

## Notes & Caveats

先发布 server，再发布消费端。V105/V106 的初始化年价采用相同取整规则；已部署环境通过 `PlanService.applyAnnualTerms` 读取时归一化新购价格，不修改已有订单。

2026-10-10 核实生产常驻活动 `daily-check-in-evergreen-prod-20260814`、修订 1 的公开 Context：`rewardCredits=100`、`totalDays=36500`、`timezone=Asia/Shanghai`。服务端每天限领一次，累计次数按活动 ID 封顶，无每月3000积分封顶或连续签到要求。文案表示累计签到30天的奖励总额，不表示固定月赠、一次到账或当前余额；活动日奖励变化后需同步更新文案。
